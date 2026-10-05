const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createStorage,KEYS}=require('../app-storage.js');
const {createSyncClient}=require('../supabase-sync.js');
const Core=require('../sync-core.js');
const memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const answer=()=>({eventId:crypto.randomUUID(),wordId:'test-word',mode:'ja',correct:true,answeredAt:new Date().toISOString(),sessionId:'test-session'});
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
async function fixture({duplicate=false,failVerification=false}={}){
 const local=memory(),auth=memory(),store=createStorage(local),tables=Object.fromEntries(Core.TABLES.map(t=>[t,new Map()])),gets=[],posts=[];
 let owner='owner-a';
 const fetch=async(url,options={})=>{
  if(url==='config/supabase.json')return response({url:'https://mock.supabase.co',anonKey:'public-test'});
  if(url==='config/sync-policy.json')return response({deltaOverlapMs:600000});
  const parsed=new URL(url),q=parsed.searchParams,table=parsed.pathname.split('/').pop();
  if(parsed.pathname.includes('/token'))return response({user:{id:owner},access_token:'fixture',refresh_token:'fixture',expires_in:3600});
  if(parsed.pathname.includes('/logout'))return response(null,204);
  if(options.method==='POST'){const row=JSON.parse(options.body),key=row.user_id+':'+Core.rowKey(table,row);posts.push({table,row});const old=tables[table].get(key);if(!old)tables[table].set(key,{...row,server_updated_at:new Date().toISOString()});return response(old||duplicate?[]:[tables[table].get(key)],201);}
  gets.push({table,q});
  if(table==='answer_logs'&&[q.get('event_id'),q.get('or')].filter(Boolean).some(v=>v.includes('"')))return response({code:'22P02'},400);
  if(failVerification&&q.has('event_id'))return response({code:'invalid_filter'},400);
  let rows=[...tables[table].values()].filter(r=>'eq.'+r.user_id===q.get('user_id'));
  for(const column of Core.PRIMARY_KEYS[table])if(q.has(column)){const filter=q.get(column);if(filter.startsWith('in.(')){const ids=filter.slice(4,-1).split(',').map(x=>x.startsWith('"')?JSON.parse(x):x);rows=rows.filter(r=>ids.includes(r[column]));}else rows=rows.filter(r=>r[column]===filter.slice(3));}
  return response(rows);
 };
 const sync=createSyncClient({fetch,authStorage:auth,online:()=>true});await sync.init({storage:store});
 return {local,auth,store,sync,tables,gets,posts,setOwner:id=>owner=id};
}
test('login automatically merges seven guest answers and unset goals with a single unquoted UUID in query',async()=>{
 const f=await fixture();f.store.setItem(KEYS.quizAnswers,JSON.stringify(Array.from({length:7},answer)));f.store.setItem(KEYS.goals,'{"daily":null,"weekly":null}');
 await f.sync.login('x','secret');assert.equal(f.tables.answer_logs.size,7);assert.equal(f.store.pending().length,0);assert.equal(f.store.snapshot().migration.importResult.failureCount,0);
 const checks=f.gets.filter(x=>x.table==='answer_logs'&&x.q.has('event_id'));assert.equal(checks.length,1);assert.match(checks[0].q.get('event_id'),/^in\.\([0-9a-f,-]+\)$/);
 await f.sync.logout();f.store.setItem(KEYS.quizAnswers,JSON.stringify([...JSON.parse(f.store.getItem(KEYS.quizAnswers)||'[]'),answer()]));await f.sync.login('x','secret');assert.equal(f.tables.answer_logs.size,8);assert.equal(f.posts.filter(p=>p.table==='answer_logs').length,8);
});
test('new guest activity never reassigns previously integrated records to another account',async()=>{
 const f=await fixture();f.store.setItem(KEYS.quizAnswers,JSON.stringify([answer()]));f.store.setItem(KEYS.settings,'{"mode":"en"}');await f.sync.login('x','secret');await f.sync.logout();
 f.store.setItem(KEYS.quizAnswers,JSON.stringify([...JSON.parse(f.store.getItem(KEYS.quizAnswers)||'[]'),answer()]));f.setOwner('owner-b');await f.sync.login('x','secret');assert.equal(JSON.parse(f.store.getItem(KEYS.quizAnswers)||'[]').length,1);assert.equal(f.store.snapshot().rows.preferences.mode,undefined);assert.equal(f.tables.answer_logs.size,2);
});
test('accepted duplicate writes and failed verification do not create blocked or failed imports',async()=>{
 const f=await fixture({duplicate:true,failVerification:true});f.store.setItem(KEYS.quizAnswers,JSON.stringify([answer()]));await f.sync.login('x','secret');assert.equal(f.store.pending().length,0);assert.equal(f.store.blocked().length,0);assert.equal(f.sync.getState().status,'synced');assert.equal(f.store.snapshot().migration.importResult.failureCount,0);
});
test('old completed snapshots seed row ownership before new guest changes are integrated',()=>{
 const local=memory(),a=answer(),store=createStorage(local);store.setItem(KEYS.quizAnswers,JSON.stringify([a]));store.setUser('owner-a');const old=store.importGuest();store.markGuestImported(old.snapshotId);local.removeItem('english-notes.guest.claims.v1');store.setUser(null);store.setItem(KEYS.quizAnswers,JSON.stringify([a,answer()]));store.setUser('owner-b');const result=store.importGuest();assert.equal(result.targetRows.answer_logs.length,1);
});
test('local integration reservation survives a failed account write and is private to its original owner',()=>{
 const local=memory(),store=createStorage(local);store.setItem(KEYS.quizAnswers,JSON.stringify([answer()]));store.setUser('owner-a');const original=local.setItem;local.setItem=(key,value)=>{if(key==='english-notes.user.owner-a.state.v1')throw Error('quota');original(key,value);};assert.throws(()=>store.importGuest(),/quota/);local.setItem=original;store.setUser('owner-b');assert.equal(store.migrationPreview().available,false);store.setUser('owner-a');assert.equal(store.migrationPreview().available,true);const recovered=store.importGuest();assert.equal(recovered.targetRows.answer_logs.length,1);
});
test('integrated guest records are hidden after logout but preserved in the owner backup',async()=>{
 const f=await fixture();f.store.setItem(KEYS.quizAnswers,JSON.stringify([answer()]));await f.sync.login('x','secret');assert.ok(Object.values(f.store.snapshot().migration.importSnapshots).some(s=>Object.keys(s.snapshot.rows.answer_logs).length===1));await f.sync.logout();assert.equal(JSON.parse(f.store.getItem(KEYS.quizAnswers)||'[]').length,0);
});
test('restored authenticated sessions integrate guest data locally even when offline',async()=>{
 const f=await fixture();await f.sync.login('x','secret');f.store.setUser(null);f.store.setItem(KEYS.quizAnswers,JSON.stringify([answer()]));const restored=createSyncClient({fetch:async url=>url==='config/supabase.json'?response({url:'https://mock.supabase.co',anonKey:'public-test'}):response({deltaOverlapMs:600000}),authStorage:f.auth,online:()=>false});await restored.init({storage:f.store});assert.equal(f.store.getUser(),'owner-a');assert.equal(JSON.parse(f.store.getItem(KEYS.quizAnswers)).length,1);assert.equal(f.store.pending().length,1);assert.equal(restored.getState().status,'pending');
});
test('rebuilding a guest envelope from retained legacy keys cannot reassign old mutable records',()=>{
 const local=memory();local.setItem(KEYS.settings,'{"mode":"en"}');const store=createStorage(local);store.setUser('owner-a');const batch=store.importGuest();store.markGuestImported(batch.snapshotId);local.removeItem('english-notes.guest.state.v1');const restored=createStorage(local);assert.equal(restored.migrationPreview().available,false);assert.equal(JSON.parse(restored.getItem(KEYS.settings)||'{}').mode,'ja');restored.setUser('owner-b');assert.equal(restored.importGuest().imported,false);
});
test('unresolved old saved words can integrate after their vocabulary catalog arrives',async()=>{
 const f=await fixture();f.store.setItem(KEYS.bookmarks,'["article-word-1"]');await f.sync.login('x','secret');f.store.setCatalog([{id:'article-word-1',headword:'retention',meaning:'維持'}]);await f.sync.sync();assert.equal(f.tables.saved_words.size,1);assert.deepEqual(JSON.parse(f.store.getItem(KEYS.bookmarks)),['article-word-1']);
});
test('old completed index-based article saves cannot resurrect when the vocabulary arrives after upgrade',()=>{
 const local=memory(),word={id:'article-word-1',headword:'retention',meaning:'維持'};local.setItem(KEYS.articleSaves,'[0]');const before=createStorage(local);before.setCatalog([word],[word]);const guest=before.snapshot();before.setUser('owner-a');const batch=before.importGuest();before.markGuestImported(batch.snapshotId);
 guest.migration.importedSnapshots[batch.snapshotId]={userId:'owner-a'};local.setItem('english-notes.guest.state.v1',JSON.stringify(guest));local.removeItem('english-notes.guest.claims.v1');const upgraded=createStorage(local);upgraded.setCatalog([word],[word]);assert.deepEqual(JSON.parse(upgraded.getItem(KEYS.articleSaves)),[]);upgraded.setUser('owner-b');assert.equal(upgraded.migrationPreview().available,false);
 // A new, explicit save of the same word remains a new guest operation.
 upgraded.setUser(null);upgraded.setItem(KEYS.articleSaves,'[0]');upgraded.setUser('owner-b');assert.equal(upgraded.importGuest().targetRows.saved_words.length,1);
});

test('guest exports never reveal integrated internal backups',()=>{
 const local=memory(),store=createStorage(local);store.setItem(KEYS.settings,'{"mode":"en","autoAdvance":true}');
 store.setUser('owner-a');const batch=store.importGuest();store.markGuestImported(batch.snapshotId);store.setUser(null);
 const exported=store.exportData();assert.equal(exported.migration,undefined);
 assert.equal(Object.values(exported.learningData.rows.preferences).some(row=>row.value==='en'),false);
 assert.ok(local.getItem('english-notes.user.owner-a.state.v1').includes('importSnapshots'));
});
