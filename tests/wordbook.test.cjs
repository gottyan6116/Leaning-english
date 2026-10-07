const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const Quiz=require('../quiz-core.js'),{QuizSession,QuizStore,QuestionTimer}=Quiz;
const Core=require('../wordbook-core.js');
const Sync=require('../sync-core.js');
const {createStorage,KEYS}=require('../app-storage.js');
const {AppState}=require('../app-state.js');
const dir=path.join(__dirname,'../materials/vocabulary');
const genres=JSON.parse(fs.readFileSync(path.join(dir,'genres.json'),'utf8')).genres;
const sets=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='genres.json').map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
const basic=sets.find(s=>s.id==='basic-01');

test('5 genres x 3 sets = 15 sets and 150 unique words pass the word-set validation',()=>{
 assert.deepEqual(genres.map(g=>g.id),['basic','daily','business','advanced','super']);
 assert.equal(sets.length,15);assert.equal(sets.reduce((n,s)=>n+s.items.length,0),150);
 for(const g of genres)assert.deepEqual(sets.filter(s=>s.genre===g.id).map(s=>s.setNumber).sort(),[1,2,3]);
 assert.equal(new Set(sets.flatMap(s=>s.items.map(w=>w.id))).size,150);assert.equal(new Set(sets.flatMap(s=>s.items.map(w=>w.headword))).size,150);
 const result=spawnSync(process.execPath,['scripts/validate-wordbook.cjs'],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(result.stdout,/15 sets, 150 words, 0 errors/);
});
test('every word offers all four question formats with valid choices and unverified status',()=>{
 for(const set of sets)for(const w of set.items){
  for(const mode of Quiz.MODES){assert.ok(Quiz.modeSupported(w,mode),`${w.id}/${mode}`);const q=w.questions[mode];assert.equal(q.choices[q.answerIndex],{ja:w.meaning,en:w.definition,ja_en:w.headword,def_en:w.headword}[mode]);}
  assert.deepEqual(w.questions.def_en.choices,w.questions.ja_en.choices,'def_en reuses the ja_en choices');assert.notEqual(Quiz.maskExample(w),null);assert.equal(Quiz.maskExample(w).split('___').length,2);
  assert.equal(w.status,'unverified');assert.equal(w.exampleOrigin,'original-for-this-app');assert.ok(w.testedSense.includes(w.meaning));
 }
});
test('C1(1) keeps its word IDs and set ID inside the advanced genre',()=>{
 const set=sets.find(s=>s.id==='advanced-vocabulary-c1-01');assert.equal(set.genre,'advanced');assert.equal(set.setNumber,3);
 assert.deepEqual(set.items.map(w=>w.id),Array.from({length:10},(_,i)=>'vocab-'+String(i+1).padStart(6,'0')));
 assert.deepEqual(set.items.map(w=>w.headword),['constraint','scrutiny','premise','allegation','alleviate','compel','impede','plausible','inherent','thereby']);
 for(const w of set.items){assert.ok(w.questions.ja.choiceIds[0].startsWith(w.id+'-ja-option-'));assert.equal(w.questions.ja_en.correctChoiceId,w.questions.ja_en.choiceIds[w.questions.ja_en.answerIndex]);}
});
test('genres and sets are organised from data alone, so a new genre or set needs no code change',()=>{
 const extraGenre={id:'travel',name:'旅行単語',order:6,levelRange:'A2〜B1',bands:['A2','B1']},extraSet={id:'travel-01',genre:'travel',setNumber:1,items:[]};
 const organised=Core.organise([...genres,extraGenre],[...sets,extraSet]);
 assert.equal(organised.length,6);assert.deepEqual(organised.map(g=>g.id),['basic','daily','business','advanced','super','travel']);assert.deepEqual(organised[5].sets.map(s=>s.id),['travel-01']);
 assert.deepEqual(organised[3].sets.map(s=>s.setNumber),[1,2,3]);
});
test('ranges: counts per current format, wrong/skipped/timed-out first, 0 count disables a range',()=>{
 const ev=(w,mode,correct,extra={})=>({wordId:w.id,mode,correct,skipped:false,...extra});
 const [a,b,c,d]=basic.items;
 const logs=[ev(a,'ja',false),ev(b,'ja',false,{skipped:true}),ev(c,'ja',false,{timedOut:true}),ev(d,'ja',true),ev(a,'en',true),ev(basic.items[4],'ja',false),ev(basic.items[4],'ja',true)];
 const ctx={logs,mode:'ja',savedIds:[a.id,d.id]};
 assert.deepEqual(Core.counts(basic,ctx),{auto:10,weak:3,unlearned:5,saved:2});
 assert.deepEqual(Core.select('weak',basic,ctx).map(x=>x.id),[a.id,b.id,c.id]);
 assert.deepEqual(Core.select('auto',basic,ctx).slice(0,3).map(x=>x.id),[a.id,b.id,c.id],'latest wrong/skipped/timed-out come first');
 assert.deepEqual(Core.select('auto',basic,ctx).slice(3,8).map(x=>x.id),basic.items.slice(5).map(x=>x.id),'then never-answered words');
 assert.deepEqual(Core.select('unlearned',basic,ctx).map(x=>x.id),basic.items.slice(5).map(x=>x.id));
 assert.deepEqual(Core.select('saved',basic,ctx).map(x=>x.id),[a.id,d.id]);
 const english={logs,mode:'en',savedIds:[]};assert.deepEqual(Core.counts(basic,english),{auto:10,weak:0,unlearned:9,saved:0});
 const fresh=Core.counts(basic,{logs:[],mode:'ja_en',savedIds:[]});assert.equal(fresh.weak,0);assert.equal(fresh.unlearned,10);
 assert.equal(Core.normalizeSetup({range:'weak',timeLimitMs:7000},fresh).range,'auto','an empty range falls back to auto');
 assert.equal(Core.select('auto',{items:[{...a,questions:{ja:a.questions.ja,en:a.questions.en}}]},{logs:[],mode:'ja_en',savedIds:[]}).length,0,'words without the format are never offered');
});
test('last chosen range and time limit are remembered; invalid stored values fall back to defaults',()=>{
 const storage=memory();assert.deepEqual(Core.loadSetup(storage),{range:'auto',timeLimitMs:10000});
 assert.equal(Core.saveSetup(storage,{range:'unlearned',timeLimitMs:15000}),true);assert.deepEqual(Core.loadSetup(storage),{range:'unlearned',timeLimitMs:15000});
 Core.saveSetup(storage,{range:'saved',timeLimitMs:0});assert.deepEqual(Core.loadSetup(storage),{range:'saved',timeLimitMs:0},'timer off is a valid choice');
 storage.setItem(Core.SETUP_KEY,JSON.stringify({range:'nope',timeLimitMs:123}));assert.deepEqual(Core.loadSetup(storage),{range:'auto',timeLimitMs:10000});
 storage.setItem(Core.SETUP_KEY,'{broken');assert.deepEqual(Core.loadSetup(storage),{range:'auto',timeLimitMs:10000});
 const local=createStorage(memory());local.setItem(Core.SETUP_KEY,JSON.stringify({range:'weak',timeLimitMs:7000}));
 assert.equal(Object.values(local.snapshot().rows).every(rows=>Object.keys(rows).length===0),true,'the setup stays on this device and is never queued for sync');
});
test('the question timer counts only visible, unpaused time',()=>{
 let now=1000;const timer=new QuestionTimer(7000,()=>now);
 assert.equal(timer.remaining(),7000);timer.start();now+=3000;assert.equal(timer.remaining(),4000);
 timer.pause();now+=60000;assert.equal(timer.remaining(),4000,'hidden tab or open dialog: the clock stops');
 timer.start();now+=3999;assert.equal(timer.expired(),false);now+=1;assert.equal(timer.expired(),true);
 timer.reset();assert.equal(timer.remaining(),7000);timer.start();now+=500;timer.stop();assert.equal(timer.elapsed(),500);now+=5000;assert.equal(timer.elapsed(),500,'stopped at the answer');
});
test('a timed-out question is a wrong answer recorded as timed out, not as SKIP',()=>{
 let now=0;const storage=createStorage(memory()),store=new QuizStore(storage),session=new QuizSession(basic.items,'ja_en',store,()=>now,()=>0.5,null,{timeLimitMs:7000});
 session.timer.start();now+=7000;const event=session.timeout();
 assert.equal(event.correct,false);assert.equal(event.skipped,false);assert.equal(event.timedOut,true);assert.equal(event.selectedChoiceId,null);assert.equal(event.mode,'ja_en');assert.equal(event.responseMs,7000);assert.equal(event.timeLimitMs,7000);
 assert.equal(session.state,'wrong');assert.equal(session.timeout(),null,'the answered question is locked');
 const row=Object.values(storage.snapshot().rows.answer_logs)[0];assert.equal(row.timed_out,true);assert.equal(row.skipped,false);assert.equal(row.mode,'ja_en');Sync.validateRow('answer_logs',row);
 assert.equal(Sync.answerEvent(row).timedOut,true);
 assert.equal(JSON.parse(storage.getItem(KEYS.quizAnswers)).length,1);
 assert.equal(new QuizSession(basic.items,'ja',store).timeout(),null,'no timer, no time-out');
});
test('timed_out is only written when true, so existing rows and answers stay unchanged',()=>{
 const plain=Sync.answerRow({eventId:'33333333-3333-4333-8333-333333333333',questionId:'q',wordId:'w',mode:'ja',correct:true,skipped:false,answeredAt:'2026-10-07T00:00:00Z'});
 assert.equal('timed_out' in plain,false);assert.equal(Sync.answerEvent(plain).timedOut,undefined);
 for(const mode of ['ja','en','ja_en'])Sync.validateRow('answer_logs',{...plain,mode});assert.throws(()=>Sync.validateRow('answer_logs',{...plain,mode:'xx'}));
 assert.equal(Sync.validPreference('mode','ja_en'),true);assert.equal(Sync.validPreference('mode','xx'),false);
});
test('combo counts consecutive correct answers and resets on wrong, skip and time-out',()=>{
 let now=0;const store=new QuizStore(memory()),session=new QuizSession(basic.items,'ja',store,()=>now,()=>0.5,null,{timeLimitMs:10000});
 const right=()=>{session.answerChoice(session.correctId);session.next();};
 right();right();assert.equal(session.combo,2);right();assert.equal(session.combo,3);right();assert.equal(session.combo,4);
 session.skip();assert.equal(session.combo,0);session.next();right();right();right();assert.equal(session.combo,3);
 session.timeout();assert.equal(session.combo,0);session.next();right();
 assert.equal(session.maxCombo,4);assert.equal(session.result().maxCombo,4);
 const second=new QuizSession(basic.items,'ja',store);second.answerChoice(second.choices.find(c=>c.id!==second.correctId).id);assert.equal(second.combo,0);assert.equal(second.maxCombo,0);
});
test('formats are scored separately; words without a format fall back to English -> Japanese',()=>{
 const store=new QuizStore(memory()),words=[basic.items[0],{...basic.items[1],questions:{ja:basic.items[1].questions.ja,en:basic.items[1].questions.en}}];
 const session=new QuizSession(words,'ja_en',store,()=>0,()=>0.5);
 assert.equal(session.modeOf(words[0]),'ja_en');assert.equal(session.modeOf(words[1]),'ja');
 const first=session.answerChoice(session.correctId);session.next();const second=session.answerChoice(session.correctId);
 assert.equal(first.mode,'ja_en');assert.equal(second.mode,'ja');
 assert.deepEqual(Quiz.scoreForMode(store.logs,'ja_en'),{answered:1,correct:1,wrong:0,skipped:0});assert.deepEqual(Quiz.scoreForMode(store.logs,'ja'),{answered:1,correct:1,wrong:0,skipped:0});
 const state=new AppState(memory(),{items:basic.items});assert.equal(state.wordStatus(basic.items[0].id,store.logs,'ja_en'),'学習中');assert.equal(state.wordStatus(basic.items[0].id,store.logs,'en'),'未学習');
});
test('a completed 10-word set in the new format records a unit session and the best score',()=>{
 const storage=createStorage(memory()),store=new QuizStore(storage),state=new AppState(storage,basic);
 const session=new QuizSession(basic.items,'ja_en',store,()=>Date.now(),()=>0.3,null,{timeLimitMs:10000});
 for(let i=0;i<10;i++){if(i<9)session.answerChoice(session.correctId);else session.timeout();session.next();}
 assert.equal(state.completeUnit(session,basic),true);assert.equal(state.best('ja_en',basic),9);assert.equal(state.best('ja',basic),null);
 const row=Object.values(storage.snapshot().rows.unit_sessions)[0];assert.equal(row.mode,'ja_en');Sync.validateRow('unit_sessions',row);
 const partial=new QuizSession(basic.items.slice(0,4),'ja_en',store);for(let i=0;i<4;i++){partial.answerChoice(partial.correctId);partial.next();}
 assert.equal(state.completeUnit(partial,basic),false,'sessions with fewer than 10 words never change the best score');
});
test('settings accept the third format and reject unknown ones',()=>{
 const storage=createStorage(memory()),store=new QuizStore(storage),state=new AppState(storage,basic);
 state.savePreferences(store,{daily:null,weekly:null},{mode:'ja_en',autoAdvance:true});assert.equal(new QuizStore(storage).settings.mode,'ja_en');
 assert.equal(storage.snapshot().rows.preferences.mode.value,'ja_en');
 assert.throws(()=>state.savePreferences(store,{daily:null,weekly:null},{mode:'xx',autoAdvance:true}));
});

const {definitionLeaks}=require('../scripts/validate-wordbook.cjs');
test('definition leak detection catches the headword, its inflections and words of the same family',()=>{
 assert.deepEqual(definitionLeaks('applicant','a person who will apply for a job'),['apply']);
 assert.deepEqual(definitionLeaks('applicant','a person who fills in an application form'),['application']);
 assert.deepEqual(definitionLeaks('applicant','a person who asks formally for a job'),[]);
 assert.deepEqual(definitionLeaks('cancel','to say that it is cancelled'),['cancelled']);
 assert.deepEqual(definitionLeaks('wash','a job of washing clothes'),['washing']);
 assert.deepEqual(definitionLeaks('wash','to clean something with water'),[]);
 assert.deepEqual(definitionLeaks('rent','a current payment'),[],'short headwords match inflections only');
 assert.deepEqual(definitionLeaks('simplify','to make something simple'),['simple']);
 assert.deepEqual(definitionLeaks('ambiguity','having more than one meaning'),[]);
 for(const set of sets)for(const w of set.items)assert.deepEqual(definitionLeaks(w.headword,w.definition),[],w.headword);
});
test('the blanked example hides exactly one occurrence of the surface form and restores to the original',()=>{
 const item={example:'He repaid the loan in two years.',exampleSurface:'repaid'};
 assert.equal(Quiz.maskExample(item),'He ___ the loan in two years.');
 assert.equal(Quiz.maskExample({example:'Cancel it or cancel that.',exampleSurface:'cancel'}),null,'two occurrences are rejected');
 assert.equal(Quiz.maskExample({example:'Nothing here.',exampleSurface:'repaid'}),null);assert.equal(Quiz.maskExample({example:'Nothing here.'}),null);
 assert.equal(Quiz.maskExample({example:'The Kitchen is big.',exampleSurface:'kitchen'}),'The ___ is big.');
 for(const set of sets)for(const w of set.items)assert.equal(Quiz.maskExample(w).replace('___',w.exampleSurface).toLowerCase(),w.example.toLowerCase());
});
test('definition -> English is asked, scored and ranged per format like the other formats',()=>{
 const storage=createStorage(memory()),store=new QuizStore(storage),session=new QuizSession(basic.items,'def_en',store,()=>0,()=>0.5);
 assert.equal(session.modeOf(basic.items[0]),'def_en');const q=basic.items[0].questions.def_en;assert.equal(session.choices.map(c=>c.id).sort().join(),q.choiceIds.slice().sort().join());
 const right=session.answerChoice(session.correctId);assert.equal(right.mode,'def_en');assert.equal(right.correct,true);session.next();
 const wrong=session.answerChoice(session.choices.find(c=>c.id!==session.correctId).id);assert.equal(wrong.mode,'def_en');assert.equal(wrong.correct,false);
 const rows=Object.values(storage.snapshot().rows.answer_logs);assert.equal(rows.every(row=>row.mode==='def_en'),true);rows.forEach(row=>Sync.validateRow('answer_logs',row));
 assert.deepEqual(Quiz.scoreForMode(store.logs,'def_en'),{answered:2,correct:1,wrong:1,skipped:0});assert.deepEqual(Quiz.scoreForMode(store.logs,'ja'),{answered:0,correct:0,wrong:0,skipped:0});
 const ctx={logs:store.logs,mode:'def_en',savedIds:[]};assert.deepEqual(Core.counts(basic,ctx),{auto:10,weak:1,unlearned:8,saved:0});assert.deepEqual(Core.counts(basic,{...ctx,mode:'ja'}),{auto:10,weak:0,unlearned:10,saved:0});
 assert.equal(Quiz.MODE_NAMES.def_en,'定義→英');assert.equal(Quiz.MODES.length,4);
 const bare={...basic.items[0],exampleSurface:undefined};assert.equal(Quiz.modeSupported(bare,'def_en'),false,'no blank, no definition question');
 assert.equal(new QuizSession([bare],'def_en',store).modeOf(bare),'ja','words that cannot be asked fall back to English -> Japanese');
});
test('settings, sessions and preferences accept the definition format and reject near misses',()=>{
 assert.equal(Sync.validPreference('mode','def_en'),true);assert.equal(Sync.validPreference('mode','def-en'),false);
 const row={event_id:'33333333-3333-4333-8333-333333333333',session_id:'s',question_id:'q',mode:'def_en',kind:'vocabulary',correct:true,skipped:false,answered_at:'2026-10-08T00:00:00Z'};
 Sync.validateRow('answer_logs',row);assert.throws(()=>Sync.validateRow('answer_logs',{...row,mode:'definition'}));
 Sync.validateRow('unit_sessions',{session_id:'x',unit_id:'u',mode:'def_en',total:10,correct:7,completed_at:'2026-10-08T00:00:00Z'});
 const storage=createStorage(memory()),store=new QuizStore(storage),state=new AppState(storage,basic);
 state.savePreferences(store,{daily:null,weekly:null},{mode:'def_en',autoAdvance:true});assert.equal(new QuizStore(storage).settings.mode,'def_en');
 const session=new QuizSession(basic.items,'def_en',store,()=>Date.now(),()=>0.3);for(let i=0;i<10;i++){session.answerChoice(session.correctId);session.next();}
 assert.equal(state.completeUnit(session,basic),true);assert.equal(state.best('def_en',basic),10);assert.equal(state.best('ja_en',basic),null);
});
