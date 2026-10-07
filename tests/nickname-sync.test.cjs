const test = require('node:test');
const assert = require('node:assert/strict');
const {createSyncClient} = require('../supabase-sync.js');
const memory = () => { const values=new Map(); return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}; };
function storage(){let uid=null,pending=[],cursors={};const rows={};return {getUser:()=>uid,setUser:id=>uid=id,pending:()=>pending,acknowledge:(table,key,rev)=>{pending=pending.filter(p=>!(p.table===table&&p.key===key&&p.revision===rev));},merge:(table,r)=>{rows[table]=r;},cursor:(t,v)=>v===undefined?cursors[t]:(cursors[t]=v),subscribe:()=>()=>{},migrationPreview:()=>({available:false,counts:{}}),exportData:()=>({learningData:{},pendingData:pending}),getItem:()=>null,setItem:()=>{},enqueue:p=>pending.push(p),rows};}
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
async function client(store,rest,extra={}){const c=createSyncClient({fetch:async(url,opts)=>{if(url.includes('config/supabase'))return response({url:'https://unit.supabase.co',anonKey:'public-test'});if(url.includes('sync-policy'))return response({deltaOverlapMs:600000});if(url.includes('/token'))return response({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:'user-a',email:'learner@example.invalid'}});return rest(url,opts);},authStorage:memory(),online:()=>true,pageSize:2,...extra});await c.init({storage:store});return c;}
test('the nickname is read from Auth user_metadata at login and restored from the saved session',async()=>{
 const s=storage(),auth=memory();
 const c=await client(s,()=>response([]),{authStorage:auth,fetch:async url=>{
  if(url.includes('config/supabase'))return response({url:'https://unit.supabase.co',anonKey:'public-test'});
  if(url.includes('sync-policy'))return response({deltaOverlapMs:600000});
  if(url.includes('/token'))return response({access_token:'t',refresh_token:'r',expires_in:3600,user:{id:'user-a',email:'learner@example.invalid',user_metadata:{nickname:'  Bridge '}}});
  return response([]);}});
 await c.login('x','secret');assert.deepEqual(c.getState().user,{id:'user-a',email:'learner@example.invalid',nickname:'Bridge'});
 const again=createSyncClient({fetch:async url=>url.includes('config/supabase')?response({url:'https://unit.supabase.co',anonKey:'k'}):url.includes('sync-policy')?response({deltaOverlapMs:1}):response([]),authStorage:auth,online:()=>true});
 await again.init({storage:storage()});assert.equal(again.getState().user.nickname,'Bridge','offline start still shows the last known nickname');
 const unset=await client(storage(),()=>response([]),{fetch:async url=>url.includes('config/supabase')?response({url:'https://unit.supabase.co',anonKey:'k'}):url.includes('sync-policy')?response({deltaOverlapMs:1}):url.includes('/token')?response({access_token:'t',refresh_token:'r',expires_in:3600,user:{id:'user-b',email:'b@example.invalid'}}):response([])});
 await unset.login('x','secret');assert.equal(unset.getState().user.nickname,'','no metadata means unset');
});
test('updateNickname calls the Auth user endpoint, keeps the saved session in step and validates input',async()=>{
 const s=storage(),auth=memory(),calls=[];
 const c=await client(s,()=>response([]),{authStorage:auth,fetch:async(url,opts={})=>{
  if(url.includes('config/supabase'))return response({url:'https://unit.supabase.co',anonKey:'public-test'});
  if(url.includes('sync-policy'))return response({deltaOverlapMs:600000});
  if(url.includes('/token'))return response({access_token:'t',refresh_token:'r',expires_in:3600,user:{id:'user-a',email:'learner@example.invalid',user_metadata:{}}});
  if(url.includes('/auth/v1/user')){calls.push({method:opts.method,body:JSON.parse(opts.body),auth:opts.headers.Authorization});return response({id:'user-a',email:'learner@example.invalid',user_metadata:{nickname:JSON.parse(opts.body).data.nickname}});}
  return response([]);}});
 await c.login('x','secret');const seen=[];c.subscribe(state=>seen.push(state.user?.nickname));
 await c.updateNickname('  Taka  ');
 assert.deepEqual(calls,[{method:'PUT',body:{data:{nickname:'Taka'}},auth:'Bearer t'}]);assert.equal(c.getState().user.nickname,'Taka');assert.ok(seen.includes('Taka'));
 assert.equal(JSON.parse(auth.getItem('english-notes.auth.session.v1')).user.user_metadata.nickname,'Taka');
 for(const bad of ['','   ','a\nb','x'.repeat(21)])await assert.rejects(c.updateNickname(bad));assert.equal(calls.length,1,'invalid names never reach the server');
 await c.updateNickname('あ'.repeat(20));assert.equal(c.getState().user.nickname,'あ'.repeat(20),'20 characters, counted as characters not bytes');
});
test('a failed nickname update changes nothing and a guest cannot update',async()=>{
 const s=storage();let fail=false;
 const c=await client(s,()=>response([]),{fetch:async(url,opts={})=>{
  if(url.includes('config/supabase'))return response({url:'https://unit.supabase.co',anonKey:'k'});if(url.includes('sync-policy'))return response({deltaOverlapMs:1});
  if(url.includes('/token'))return response({access_token:'t',refresh_token:'r',expires_in:3600,user:{id:'user-a',email:'a@example.invalid',user_metadata:{nickname:'Old'}}});
  if(url.includes('/auth/v1/user')){if(fail)throw new TypeError('Failed to fetch');return response({id:'user-a',user_metadata:{nickname:JSON.parse(opts.body).data.nickname}});}
  return response([]);}});
 await assert.rejects(c.updateNickname('New'),/ログイン/);
 await c.login('x','secret');fail=true;await assert.rejects(c.updateNickname('New'));assert.equal(c.getState().user.nickname,'Old','offline: the last known nickname stays');
 fail=false;await c.updateNickname('New');assert.equal(c.getState().user.nickname,'New');
});
