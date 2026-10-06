const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const Core=require('../collocation-core.js');
const Sync=require('../sync-core.js');
const {createStorage,KEYS}=require('../app-storage.js');
const {createSyncClient}=require('../supabase-sync.js');
const {QuizSession,QuizStore,validateItem}=require('../quiz-core.js');
const material=require('../materials/collocations/article-collocations.json');
const articles=fs.readdirSync(path.join(__dirname,'../materials/articles')).filter(x=>x.endsWith('.json')&&x!=='index.json').map(x=>JSON.parse(fs.readFileSync(path.join(__dirname,'../materials/articles',x),'utf8')));
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const all=material.items,byId=Object.fromEntries(all.map(c=>[c.id,c]));
const withFill=all.find(c=>c.fill),siblings=c=>all.filter(x=>x.wordId===c.wordId);

test('all 65 article words migrated to 195 collocations with stable IDs and untouched content',()=>{
 let usageCount=0;
 for(const article of articles)for(const word of article.vocabulary)for(const u of word.usage.combinations){
  usageCount++;const id=`col-${word.id}-${Core.slug(u.form)}`,c=byId[id];
  assert.ok(c,'missing '+id);assert.equal(c.wordId,word.id);assert.equal(c.articleId,article.id);
  for(const [a,b] of [['form','form'],['meaningJa','meaningJa'],['nuanceJa','nuanceJa'],['example','example'],['status','status'],['exampleOrigin','exampleOrigin']])assert.equal(c[a],u[b],`${id}.${a}`);
  assert.equal(c.patternDetail,u.pattern);
 }
 assert.equal(usageCount,195);assert.equal(all.length,195);assert.equal(new Set(all.map(c=>c.wordId)).size,65);
 assert.equal(crypto.createHash('sha256').update(all.map(c=>c.id).sort().join('\n')).digest('hex'),'250c70f1f8c3d3aa77c7bb01f15e1774ff8f6553bb32c19984d72ba43f98ad64','IDs are immutable; never rename or remove a collocation ID');
});
test('migration never promotes status and every record follows the schema',()=>{
 assert.ok(all.every(c=>c.status==='unverified'));assert.ok(all.every(c=>Core.TYPES.some(([id])=>id===c.type)));
 for(const c of all)assert.deepEqual(Core.validateCollocation(c),[]);
 const registered=all.filter(c=>c.misuse);assert.equal(registered.length,65,'one draft misuse per word');assert.equal(new Set(registered.map(c=>c.wordId)).size,65);
 const result=spawnSync(process.execPath,['scripts/validate-collocations.cjs'],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
});
test('fill-in question blanks the collocate, keeps four distinct choices, and scores by choice ID',()=>{
 const item=Core.fillItem(withFill);assert.ok(validateItem(item));assert.ok(Core.validateQuestion(item));
 assert.equal(item.headword,Core.stem(withFill));assert.match(item.headword,/___/);assert.doesNotMatch(item.example===item.exampleMasked?'x':item.exampleMasked||'',new RegExp('\\b'+withFill.fill.blank+'\\b','i'));
 const q=item.questions.en;assert.equal(q.choices.length,4);assert.equal(new Set(q.choiceIds).size,4);assert.equal(q.choices[q.answerIndex],withFill.fill.blank);assert.equal(q.correctChoiceId,q.choiceIds[q.answerIndex]);
 const logs=memory(),store=new Core.CollocationStore(logs),session=new QuizSession([item],'ja',new QuizStore(memory()),()=>1000,()=>0,store);
 assert.notEqual(session.choices[0].id,session.correctId,'deterministic shuffle moved the answer');
 const wrong=session.answerChoice(session.choices.find(c=>c.id!==session.correctId).id);
 assert.equal(wrong.correct,false);assert.equal(wrong.kind,'collocation');assert.equal(wrong.mode,'en');assert.equal(wrong.collocationId,withFill.id);assert.equal(wrong.wordId,withFill.wordId);assert.equal(wrong.format,'fill');
 assert.equal(store.logs.length,1);assert.equal(session.result().wrongItems[0].id,withFill.id);
 const again=new QuizSession([item],'en',new QuizStore(memory()),()=>2000,()=>0.5,store);assert.equal(again.answerChoice(again.correctId).correct,true);
});
test('every fill-in distractor differs from its answer and the blank can be masked in the example',()=>{
 for(const c of all.filter(x=>x.fill)){const item=Core.fillItem(c);assert.ok(item,c.id);assert.ok(item.exampleMasked,c.id+' example cannot be masked');assert.equal(new Set(item.questions.en.choices.map(x=>x.toLowerCase())).size,4);}
});
test('misuse questions come only from combinations with a registered unnatural example',()=>{
 const asked=all.filter(c=>Core.misuseItem(c,all));assert.equal(asked.length,65);assert.deepEqual(asked.map(c=>c.id),all.filter(c=>c.misuse).map(c=>c.id),'only registered combinations produce misuse questions');
 for(const c of all.filter(x=>!x.misuse))assert.equal(Core.misuseItem(c,all),null);
 assert.equal(Core.misuseItem({...all.find(c=>!c.misuse),misuse:null},all),null);
 const c=siblings(withFill)[0],registered={...c,misuse:{form:'plan a coffee of '+c.form.split(' ').pop(),noteJa:'ふつう使わない組み合わせ'}},pool=all.map(x=>x.id===c.id?registered:x);
 const item=Core.misuseItem(registered,pool);assert.ok(item&&validateItem(item));assert.equal(item.format,'misuse');
 const q=item.questions.en;assert.equal(q.choices[q.answerIndex],registered.misuse.form);assert.equal(new Set(q.choices).size,4);
 for(const other of siblings(registered).filter(x=>x.id!==c.id))assert.ok(q.choices.includes(other.form));
 assert.equal(Core.misuseItem(siblings(registered)[1],pool),null,'unregistered siblings are not asked');
 assert.deepEqual(Core.formatsFor(registered,pool).sort(),registered.fill?['fill','misuse']:['misuse']);
 assert.deepEqual(Core.formatsFor(siblings(registered)[1],pool).filter(f=>f==='misuse'),[]);
 const pairOnly=pool.filter(x=>x.wordId!==c.wordId||x.id===c.id||x.id===siblings(c)[1].id);assert.equal(Core.misuseItem(registered,pairOnly),null,'needs three natural combinations');
 for(let n=0;n<30;n++){const items=Core.practiceItems(pool.filter(x=>x.wordId===c.wordId),pool,[],()=>n/30);for(const it of items)if(it.format==='misuse')assert.equal(it.id,registered.id);}
});
test('status, wrong-answer review and recovery follow the vocabulary rules',()=>{
 const id=withFill.id,e=(correct,at)=>({kind:'collocation',collocationId:id,format:'fill',mode:'en',correct,skipped:false,answeredAt:at});
 assert.equal(Core.status(id,[]),'未学習');assert.equal(Core.status(id,[e(false,'1')]),'復習予定');assert.equal(Core.status(id,[e(false,'1'),e(true,'2')]),'学習中');assert.equal(Core.status(id,[e(true,'1'),e(true,'2')]),'定着');
 assert.deepEqual(Core.reviewItems(all,[e(false,'1')]).map(x=>x.id),[id]);assert.deepEqual(Core.reviewItems(all,[e(false,'1'),e(true,'2')]),[]);
 assert.equal(Core.reviewItems(all,[{...e(false,'1'),skipped:true,correct:false}]).length,1);
 assert.deepEqual(Core.reviewItems(all,[{kind:'vocabulary',wordId:'x',mode:'ja',correct:false}]),[]);
});
test('saves and answers sync as rows without leaking into custom words or word bookmarks',()=>{
 let tick=Date.parse('2026-10-06T00:00:00Z');const storage=createStorage(memory(),{now:()=>new Date(++tick).toISOString()}),store=new Core.CollocationStore(storage);
 store.toggleSave(withFill.id);
 const row=storage.snapshot().rows.saved_words['collocation:'+withFill.id];assert.equal(row.saved,true);assert.equal(row.catalog_word_id,null);assert.deepEqual(row.payload,{origin:'collocation',collocationId:withFill.id});
 assert.deepEqual(JSON.parse(storage.getItem(KEYS.customWords)),[]);assert.deepEqual(JSON.parse(storage.getItem(KEYS.bookmarks)),[]);assert.deepEqual(JSON.parse(storage.getItem(KEYS.unsaved)),[]);
 assert.equal(store.isSaved(withFill.id),true);
 storage.setItem(KEYS.bookmarks,JSON.stringify([]));assert.equal(store.isSaved(withFill.id),true,'unrelated word-save writes keep saved collocations');
 store.toggleSave(withFill.id);assert.equal(storage.snapshot().rows.saved_words['collocation:'+withFill.id].saved,false);assert.equal(store.isSaved(withFill.id),false);assert.deepEqual(JSON.parse(storage.getItem(KEYS.unsaved)),[]);
 const item=Core.fillItem(withFill),session=new QuizSession([item],'ja',new QuizStore(storage),()=>1000,Math.random,store);session.skip();
 const logRow=Object.values(storage.snapshot().rows.answer_logs)[0];assert.equal(logRow.kind,'collocation');assert.equal(logRow.skipped,true);Sync.validateRow('answer_logs',logRow);
 assert.equal(JSON.parse(storage.getItem(KEYS.quizAnswers)).length,0,'word quiz history is untouched');assert.equal(JSON.parse(storage.getItem(KEYS.collocationAnswers)).length,1);
});
function server({migrated}){
 const tables=Object.fromEntries(Sync.TABLES.map(t=>[t,new Map()]));let clock=Date.parse('2026-10-06T12:00:00Z');const posts=[];
 const response=(body,status=200)=>({ok:status<400,status,json:async()=>JSON.parse(JSON.stringify(body))});
 const state={migrated};
 async function fetch(url,opts={}){
  if(url==='config/supabase.json')return response({url:'https://mock.supabase.co',publishableKey:'public-test-key'});
  if(url==='config/sync-policy.json')return response({deltaOverlapMs:600000});
  const parsed=new URL(url),q=parsed.searchParams;
  if(parsed.pathname.includes('/token'))return response({user:{id:'account-a',email:'learner@example.invalid'},access_token:'test-token',refresh_token:'test-refresh',expires_in:3600});
  const table=parsed.pathname.split('/').at(-1);if(!tables[table])return response({},404);
  if(opts.method==='POST'){
   const row=JSON.parse(opts.body);posts.push({table,kind:row.kind});
   if(table==='answer_logs'&&row.kind==='collocation'&&!state.migrated)return response({code:'23514',message:'violates check constraint answer_logs_kind_check'},400);
   const key=row.user_id+':'+Sync.rowKey(table,row),old=tables[table].get(key);if(old&&(Sync.isAppendOnly(table)||Date.parse(old.updated_at)>=Date.parse(row.updated_at)))return response([]);
   const accepted={...row,server_updated_at:new Date(++clock).toISOString()};tables[table].set(key,accepted);return response([accepted]);
  }
  let rows=[...tables[table].values()].filter(r=>r.user_id===q.get('user_id').slice(3));
  for(const col of Sync.PRIMARY_KEYS[table])if(q.has(col)){const filter=q.get(col);if(filter.startsWith('in.(')){const ids=filter.slice(4,-1).split(',').map(v=>v.startsWith('"')?JSON.parse(v):v);rows=rows.filter(r=>ids.includes(r[col]));}else{const value=filter.slice(3);rows=rows.filter(r=>r[col]===(value.startsWith('"')?JSON.parse(value):value));}}
  if(q.has('server_updated_at'))rows=rows.filter(r=>Date.parse(r.server_updated_at)>=Date.parse(q.get('server_updated_at').slice(4)));
  return response(rows.slice(0,Number(q.get('limit')||500)));
 }
 return {fetch,tables,state,posts};
}
async function device(remote,learning=memory()){let tick=Date.parse('2026-10-06T10:00:00Z');const storage=createStorage(learning,{now:()=>new Date(++tick).toISOString()}),sync=createSyncClient({fetch:remote.fetch,authStorage:memory(),online:()=>true,download:()=>{}});await sync.init({storage});return {storage,sync,store:new Core.CollocationStore(storage)};
}
test('before the migration is applied, collocation answers are retained as unsendable data and other data still syncs',async()=>{
 const remote=server({migrated:false}),phone=await device(remote);await phone.sync.login('x','password');
 const item=Core.fillItem(withFill),session=new QuizSession([item],'ja',new QuizStore(phone.storage),()=>Date.parse('2026-10-06T11:00:00Z'),Math.random,phone.store);
 session.answerChoice(session.correctId);phone.store.toggleSave(withFill.id);
 await phone.sync.sync();
 assert.equal(phone.storage.blocked().length,1);assert.equal(phone.storage.blocked()[0].row.kind,'collocation');assert.equal(phone.storage.blocked()[0].status,400);
 assert.equal(phone.store.logs.length,1,'the local answer is not lost');assert.equal(phone.store.isSaved(withFill.id),true);
 assert.equal(remote.tables.saved_words.size,1,'saving a collocation does not depend on the migration');assert.equal(remote.tables.answer_logs.size,0);
 assert.equal(phone.sync.blockedData().length,1,'shown in the existing unsendable data panel');
 const before=remote.posts.length;await phone.sync.sync();assert.equal(remote.posts.length,before,'blocked rows are not retried automatically within a session');
});
test('after the migration is applied, retained and new collocation answers reach a second device',async()=>{
 const remote=server({migrated:false}),phone=await device(remote),pc=await device(remote);await phone.sync.login('x','password');await pc.sync.login('x','password');
 const item=Core.fillItem(withFill),session=new QuizSession([item],'ja',new QuizStore(phone.storage),()=>Date.parse('2026-10-06T11:00:00Z'),Math.random,phone.store);
 session.answerChoice(session.choices.find(c=>c.id!==session.correctId).id);phone.store.toggleSave(withFill.id);await phone.sync.sync();assert.equal(phone.storage.blocked().length,1);
 remote.state.migrated=true;await phone.sync.resync();
 assert.equal(phone.storage.blocked().length,0);assert.equal(remote.tables.answer_logs.size,1);
 const fresh=new QuizSession([item],'ja',new QuizStore(phone.storage),()=>Date.parse('2026-10-06T11:05:00Z'),Math.random,phone.store);fresh.answerChoice(fresh.correctId);await phone.sync.sync();assert.equal(remote.tables.answer_logs.size,2);
 await pc.sync.sync();assert.equal(pc.store.logs.length,2);assert.deepEqual(pc.store.logs.map(e=>e.correct).sort(),[false,true]);assert.equal(pc.store.isSaved(withFill.id),true);
 assert.deepEqual(Core.reviewItems(all,pc.store.logs),[],'latest answer was correct');
});
test('the new migration only widens answer_logs.kind and leaves applied migrations unchanged',()=>{
 const dir=path.join(__dirname,'../supabase/migrations'),read=n=>fs.readFileSync(path.join(dir,n),'utf8').replace(/\r\n/g,'\n');
 for(const [name,hash] of [['20261005012849_allow_email_password_signup.sql','c1e0c92e11984c184b9e7a137b826953f717c0cd6ab525227faeb0a34c8e530f'],['20261005032051_allow_unset_goal_preferences.sql','7c158236dad58d796699b590f159e92e8192462fd130131ee9bd1caac1f54d05']])assert.equal(crypto.createHash('sha256').update(read(name)).digest('hex'),hash);
 const added=fs.readdirSync(dir).filter(n=>/collocation/.test(n));assert.equal(added.length,1);const sql=read(added[0]);
 assert.match(sql,/'vocabulary','comprehension','collocation'/);assert.doesNotMatch(sql,/drop table|delete from|truncate/i);
});
