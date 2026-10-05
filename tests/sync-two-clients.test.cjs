const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createStorage,KEYS}=require('../app-storage.js');
const Core=require('../sync-core.js');
const {createSyncClient}=require('../supabase-sync.js');
const {AppState}=require('../app-state.js');
const {QuizStore,QuizSession}=require('../quiz-core.js');
const unit=require('../materials/vocabulary/c1-unit-01.json');
function memory(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
const clone=Core.clone;
function server(){
 const tables=Object.fromEntries(Core.TABLES.map(t=>[t,new Map()]));let clock=Date.parse('2026-10-05T12:00:00Z');
 const response=(body,status=200)=>({ok:status<400,status,json:async()=>clone(body)});
 async function fetch(url,opts={}){
  if(url==='config/supabase.json')return response({url:'https://mock.supabase.co',publishableKey:'public-test-key'});
  if(url==='config/sync-policy.json')return response({deltaOverlapMs:600000});
  const parsed=new URL(url),q=parsed.searchParams;
  if(parsed.pathname.includes('/token'))return response({user:{id:'account-a',email:'learner@example.invalid'},access_token:'test-token',refresh_token:'test-refresh',expires_in:3600});
  if(parsed.pathname.includes('/logout'))return response(null,204);
  const table=parsed.pathname.split('/').at(-1);if(!tables[table])return response({},404);
  if(opts.method==='POST'){
   const row=JSON.parse(opts.body);Core.validateRow(table,row);assert.equal(row.user_id,'account-a');
   const key=row.user_id+':'+Core.rowKey(table,row),old=tables[table].get(key);
   if(old&&(Core.isAppendOnly(table)||Date.parse(old.updated_at)>=Date.parse(row.updated_at)))return response([]);
   const accepted={...row,server_updated_at:new Date(++clock).toISOString()};tables[table].set(key,accepted);return response([accepted]);
  }
  let rows=[...tables[table].values()].filter(r=>r.user_id===q.get('user_id').slice(3));
  for(const col of Core.PRIMARY_KEYS[table])if(q.has(col)){const value=q.get(col).slice(3);rows=rows.filter(r=>r[col]===(value.startsWith('"')?JSON.parse(value):value));}
  if(q.has('server_updated_at'))rows=rows.filter(r=>Date.parse(r.server_updated_at)>=Date.parse(q.get('server_updated_at').slice(4)));
  rows.sort((a,b)=>a.server_updated_at.localeCompare(b.server_updated_at)||Core.rowKey(table,a).localeCompare(Core.rowKey(table,b)));
  return response(rows.slice(0,Number(q.get('limit')||500)));
 }
 return {fetch,tables};
}
async function device(remote,{learning=memory(),auth=memory(),connectivity={online:true},date=Date.parse('2026-10-05T10:00:00Z')}={}){
 let tick=date;const storage=createStorage(learning,{now:()=>new Date(++tick).toISOString()});storage.setCatalog(unit.items);
 const sync=createSyncClient({fetch:(url,opts)=>{if(!connectivity.online&&url.startsWith('https:'))return Promise.reject(new Error('Offline'));return remote.fetch(url,opts);},authStorage:auth,online:()=>connectivity.online,download:()=>{}});
 await sync.init({storage});
 return {storage,sync,learning,auth,connectivity,app:()=>new AppState(storage,unit),quiz:()=>new QuizStore(storage)};
}
test('two independent clients propagate saved words, removal, answers and settings through real data adapters',async()=>{
 const remote=server(),phone=await device(remote),pc=await device(remote,{date:Date.parse('2026-10-05T11:00:00Z')});
 await phone.sync.login('x','password');await pc.sync.login('x','password');
 phone.quiz().toggleBookmark(unit.items[0].id);await phone.sync.sync();await pc.sync.sync();
 assert.deepEqual(pc.quiz().bookmarks,[unit.items[0].id]);assert.equal(pc.app().savedVocabulary(pc.quiz().bookmarks).length,1);
 const session=new QuizSession(unit.items,'en',phone.quiz(),()=>Date.parse('2026-10-05T12:00:00Z'));session.answerChoice(session.correctId);
 phone.app().savePreferences(phone.quiz(),{daily:20,weekly:120},{mode:'en',autoAdvance:false});
 await phone.sync.sync();await pc.sync.sync();
 assert.equal(pc.quiz().logs.length,1);assert.equal(pc.quiz().logs[0].eventId,session.answers[0].eventId);assert.equal(pc.quiz().logs[0].correct,true);
 assert.deepEqual(pc.quiz().settings,{mode:'en',autoAdvance:false});assert.deepEqual(pc.app().goals,{daily:20,weekly:120});
 pc.quiz().toggleBookmark(unit.items[0].id);await pc.sync.sync();await phone.sync.sync();assert.deepEqual(phone.quiz().bookmarks,[]);assert.equal(phone.app().savedVocabulary(phone.quiz().bookmarks).length,0);
 assert.equal(remote.tables.saved_words.size,1);assert.equal([...remote.tables.saved_words.values()][0].saved,false);
 await phone.sync.sync();assert.equal(remote.tables.answer_logs.size,1);
});
test('completed unit best score, article read state, comprehension and opinion drafts reach second client',async()=>{
 const remote=server(),phone=await device(remote),pc=await device(remote);await phone.sync.login('x','password');await pc.sync.login('x','password');
 const session=new QuizSession(unit.items,'ja',phone.quiz());for(let n=0;n<10;n++){if(n<8)session.answerChoice(session.correctId);else session.skip();session.next();}
 assert.equal(phone.app().completeUnit(session),true);
 const date='2026-10-05T12:00:00Z';phone.storage.setItem(KEYS.reads,JSON.stringify({'work-four-day-week':{articleId:'work-four-day-week',version:1,completedAt:date}}));
 phone.storage.setItem(KEYS.opinions,JSON.stringify({'work-four-day-week':{articleId:'work-four-day-week',version:1,text:'A shorter week could help.',updatedAt:date}}));
 const event={eventId:crypto.randomUUID(),questionId:'q1',articleId:'work-four-day-week',kind:'comprehension',mode:'en',correct:true,skipped:false,answeredAt:date,sessionId:'reading-1',selectedChoiceId:'q1-b',correctChoiceId:'q1-b'};
 phone.storage.setItem(KEYS.articleAnswers,JSON.stringify({[event.eventId]:event}));
 await phone.sync.sync();await pc.sync.sync();assert.equal(pc.app().best('ja'),8);assert.equal(pc.quiz().logs.length,10);assert.equal(pc.app().reviewCandidates(pc.quiz().logs,[],'ja').length,2);
 assert.equal(JSON.parse(pc.storage.getItem(KEYS.reads))['work-four-day-week'].completedAt,date);
 assert.equal(JSON.parse(pc.storage.getItem(KEYS.opinions))['work-four-day-week'].text,'A shorter week could help.');
 assert.equal(Object.values(JSON.parse(pc.storage.getItem(KEYS.articleAnswers)))[0].eventId,event.eventId);
 const worse={id:'later-unit',mode:'ja',answers:unit.items.map((w,n)=>({wordId:w.id,correct:n<3}))};pc.app().completeUnit(worse);await pc.sync.sync();await phone.sync.sync();assert.equal(phone.app().best('ja'),8);
});
test('offline local operation survives app restart and sends once after reconnection',async()=>{
 const remote=server(),phone=await device(remote);await phone.sync.login('x','password');phone.connectivity.online=false;
 phone.app().addCustomWord({en:'bespoke',ja:'特注の',def:'made for a particular purpose',example:'We ordered a bespoke tool.'});
 const session=new QuizSession(unit.items,'ja',phone.quiz());session.skip();await phone.sync.sync();assert.ok(phone.storage.pending().length>=2);
 const restarted=await device(remote,{learning:phone.learning,auth:phone.auth,connectivity:phone.connectivity});assert.equal(restarted.app().customWords[0].en,'bespoke');assert.equal(restarted.quiz().logs.length,1);
 restarted.connectivity.online=true;await restarted.sync.sync();await restarted.sync.sync();assert.equal(restarted.storage.pending().length,0);assert.equal(remote.tables.answer_logs.size,1);assert.equal(remote.tables.saved_words.size,1);
 const pc=await device(remote);await pc.sync.login('x','password');assert.equal(pc.app().savedVocabulary(pc.quiz().bookmarks)[0].headword,'bespoke');
});
test('guest and legacy migration is explicit, backed up, reconciles target IDs and leaves old keys intact',async()=>{
 const remote=server(),learning=memory(),original=JSON.stringify([unit.items[0].id]);learning.setItem(KEYS.bookmarks,original);
 const phone=await device(remote,{learning});phone.app().addCustomWord({en:'custom-note',ja:'手入力'});const guestCounts=phone.storage.migrationPreview();assert.equal(guestCounts.counts.saved_words,2);
 await phone.sync.login('x','password');assert.equal(remote.tables.saved_words.size,0);assert.equal(phone.quiz().bookmarks.length,0);
 const result=await phone.sync.importGuest();assert.equal(result.verified,true);assert.equal(result.targetCounts.saved_words,2);assert.equal(phone.storage.migrationPreview().alreadyImported,true);assert.equal(learning.getItem(KEYS.bookmarks),original);
 const pc=await device(remote);await pc.sync.login('x','password');assert.equal(pc.app().savedVocabulary(pc.quiz().bookmarks).length,2);
 const exported=JSON.stringify(phone.sync.exportData());assert.doesNotMatch(exported,/test-token|test-refresh|public-test-key/);
 await phone.sync.logout();assert.equal(phone.storage.getUser(),null);assert.equal(phone.app().savedVocabulary(phone.quiz().bookmarks).length,2);
});
