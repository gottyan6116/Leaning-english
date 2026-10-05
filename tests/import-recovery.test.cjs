const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createStorage,KEYS}=require('../app-storage.js');
const Core=require('../sync-core.js');const {createSyncClient}=require('../supabase-sync.js');
function memory(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
const response=(value,status=200)=>({ok:status<400,status,json:async()=>value});
async function fixture({seed=true}={}){
 const local=memory(),auth=memory(),tables=Object.fromEntries(Core.TABLES.map(t=>[t,new Map()]));
 const posts=[],rejects=new Map();let failGet=false,downloaded=0,refreshStatus=0;
 if(seed){local.setItem(KEYS.quizAnswers,JSON.stringify(Array.from({length:7},(_,i)=>({eventId:crypto.randomUUID(),wordId:'word-'+i,mode:'ja',correct:i<5,answeredAt:'2026-10-05T01:00:00Z',sessionId:'session'}))));local.setItem(KEYS.goals,JSON.stringify({daily:null,weekly:null}));}
 const store=createStorage(local);const fetch=async(url,options={})=>{
  if(url==='config/supabase.json')return response({url:'https://mock.supabase.co',anonKey:'public-fixture'});
  if(url==='config/sync-policy.json')return response({deltaOverlapMs:600000});
  const path=new URL(url);
  if(path.pathname.includes('/token')){if(path.searchParams.get('grant_type')==='refresh_token'&&refreshStatus)return response({code:'refresh_token_not_found'},refreshStatus);return response({user:{id:'owner-a',email:'learner@example.test'},access_token:'mock-token',refresh_token:'mock-refresh',expires_in:3600});}
  if(path.pathname.includes('/logout'))return response(null,204);
  const table=path.pathname.split('/').pop(),q=path.searchParams;
  if(options.method==='POST'){
   const row=JSON.parse(options.body),key=Core.rowKey(table,row);posts.push({table,key,row});
   const status=rejects.get(table+':'+key);if(status==='network')throw new TypeError('Failed to fetch');if(status){if(status==='once401'){rejects.delete(table+':'+key);return response({code:'jwt_expired'},401);}return response({code:'check_violation'},status);}
   const old=tables[table].get(key);if(old&&(Core.isAppendOnly(table)||old.updated_at>=row.updated_at))return response([]);
   const saved={...row,server_updated_at:new Date().toISOString()};tables[table].set(key,saved);return response([saved],201);
  }
  if(failGet)throw new TypeError('Failed to fetch');
  let rows=[...tables[table].values()];for(const col of Core.PRIMARY_KEYS[table])if(q.has(col)){const value=q.get(col).slice(3);rows=rows.filter(r=>r[col]===(value.startsWith('"')?JSON.parse(value):value));}return response(rows);
 };
 const sync=createSyncClient({fetch,authStorage:auth,online:()=>true,download:()=>{downloaded++;}});await sync.init({storage:store});await sync.login('x','password');
 return {sync,store,local,auth,tables,posts,rejects,downloaded:()=>downloaded,setFailGet:value=>{failGet=value},setRefreshStatus:value=>{refreshStatus=value}};
}

test('authentication refresh errors never quarantine a valid learning row',async()=>{
 const f=await fixture({seed:false});f.store.setItem(KEYS.settings,'{"mode":"en"}');f.rejects.set('preferences:mode',401);f.setRefreshStatus(400);await f.sync.sync();assert.equal(f.store.blocked().length,0);assert.equal(f.store.pending().length,1);f.rejects.clear();f.setRefreshStatus(0);await f.sync.login('x','password');assert.equal(f.store.pending().length,0);assert.equal(f.tables.preferences.get('mode').value,'en');
});

test('401 retries after authentication refresh and does not quarantine the answer',async()=>{
 const f=await fixture({seed:false});f.store.setItem(KEYS.settings,'{"mode":"en"}');f.rejects.set('preferences:mode','once401');await f.sync.sync();assert.equal(f.store.blocked().length,0);assert.equal(f.store.pending().length,0);assert.equal(f.tables.preferences.get('mode').value,'en');
});
test('unset goals import without download and repeated attempts never duplicate seven answer IDs',async()=>{
 const f=await fixture();const first=await f.sync.importGuest();assert.equal(first.success,true);assert.equal(first.successCount,9);assert.equal(f.downloaded(),0);assert.equal(f.tables.answer_logs.size,7);for(const key of ['daily','weekly'])assert.equal(f.tables.preferences.get(key).value,null);await f.sync.importGuest();await f.sync.resync();assert.equal(f.tables.answer_logs.size,7);assert.equal(f.store.pending().length,0);
});
test('permanent failed row is quarantined while remaining import rows send and partial counts survive reload',async()=>{
 const f=await fixture();f.rejects.set('preferences:daily',400);await assert.rejects(f.sync.importGuest(),e=>e.partialImport===true);const result=f.sync.getState().migrationResult;assert.equal(result.successCount,8);assert.equal(result.failureCount,1);assert.equal(f.tables.answer_logs.size,7);assert.equal(f.tables.preferences.get('weekly').value,null);assert.equal(f.store.pending().length,0);assert.equal(f.store.blocked().length,1);
 const count=()=>f.posts.filter(p=>p.key==='daily').length;assert.equal(count(),1);await f.sync.sync();await f.sync.resync();assert.equal(count(),1);const reloaded=createStorage(f.local,{userId:'owner-a'});assert.equal(reloaded.blocked().length,1);assert.equal(reloaded.snapshot().migration.importResult.failureCount,1);assert.equal(f.sync.getState().status,'failed');assert.equal(f.downloaded(),0);
});
test('every non401 4xx is excluded from automatic retry, whereas server and network failures retry',async()=>{
 for(const status of [400,403,409,422,429]){const f=await fixture({seed:false});f.store.setItem(KEYS.settings,'{"mode":"en"}');f.rejects.set('preferences:mode',status);await f.sync.sync();await f.sync.sync();assert.equal(f.posts.filter(p=>p.key==='mode').length,1);assert.equal(f.store.blocked().length,1);}
 for(const status of [503,'network']){const f=await fixture({seed:false});f.store.setItem(KEYS.settings,'{"mode":"en"}');f.rejects.set('preferences:mode',status);await f.sync.sync();assert.equal(f.store.blocked().length,0);assert.equal(f.store.pending().length,1);f.rejects.delete('preferences:mode');await f.sync.sync();assert.equal(f.store.pending().length,0);assert.equal(f.tables.preferences.get('mode').value,'en');}
});
test('retry after transient partial import confirms targets without resending accepted answers',async()=>{
 const f=await fixture();f.rejects.set('preferences:daily',503);await assert.rejects(f.sync.importGuest(),e=>e.partialImport===true);assert.equal(f.sync.getState().migrationResult.successCount,7);assert.equal(f.sync.getState().migrationResult.failureCount,2);f.rejects.clear();const result=await f.sync.importGuest();assert.equal(result.success,true);assert.equal(result.successCount,9);assert.equal(f.tables.answer_logs.size,7);assert.equal(f.posts.filter(p=>p.table==='answer_logs').length,7);assert.equal(f.downloaded(),0);
});
test('unverifiable server state never reports import success and keeps its local snapshot',async()=>{
 const f=await fixture();f.setFailGet(true);await assert.rejects(f.sync.importGuest(),e=>e.partialImport===true);assert.equal(f.sync.getState().migrationResult.success,false);assert.equal(f.store.snapshot().migration.pendingGuestImport.snapshot.rows.answer_logs!==undefined,true);assert.equal(f.store.migrationPreview().alreadyImported,false);
});
test('blocked data removal clears only the transmission and needs matching revision',async()=>{
 const f=await fixture({seed:false});f.store.setItem(KEYS.settings,'{"mode":"en"}');f.rejects.set('preferences:mode',400);await f.sync.sync();const entry=f.sync.blockedData()[0];assert.equal(f.sync.discardBlocked(entry.table,entry.key,'old'),false);assert.equal(f.sync.discardBlocked(entry.table,entry.key,entry.revision),true);assert.equal(f.sync.getState().blockedCount,0);assert.equal(JSON.parse(f.store.getItem(KEYS.settings)).mode,'en');await f.sync.sync();assert.equal(f.posts.filter(p=>p.key==='mode').length,1);
});
