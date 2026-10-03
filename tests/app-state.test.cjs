const test=require('node:test');
const assert=require('node:assert/strict');
const {AppState}=require('../app-state.js');
const memory=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
const items=Array.from({length:10},(_,i)=>({id:'v-'+i,headword:'term'+i}));
const collection={id:'c1-01',level:'C1',unitNumber:1,items};
test('saved collection excludes unsaved seed words and deduplicates all save sources',()=>{
 const state=new AppState(memory(),collection);state.customWords=[{en:'term0',ja:'custom'},{en:'personal',ja:'個人'}];
 assert.deepEqual(state.savedVocabulary(['v-0'],[{en:'term0',ja:'a',bookmarked:true},{en:'seed',ja:'b'},{en:'article-only',ja:'c',bookmarked:true}]).map(x=>x.headword),['term0','article-only','personal']);
 assert.deepEqual(new AppState(memory(),collection).savedVocabulary([], [{en:'seed',status:'定着'}]),[]);
});
test('word status comes only from current-mode answers, including skips and successive correct answers',()=>{
 const state=new AppState(memory(),collection),logs=[{wordId:'v-0',mode:'en',correct:true}];assert.equal(state.wordStatus('v-0',logs,'ja'),'未学習');
 logs.push({wordId:'v-0',mode:'ja',correct:true});assert.equal(state.wordStatus('v-0',logs,'ja'),'学習中');
 logs.push({wordId:'v-0',mode:'ja',correct:true});assert.equal(state.wordStatus('v-0',logs,'ja'),'定着');
 logs.push({wordId:'v-0',mode:'ja',correct:false,skipped:true});assert.equal(state.wordStatus('v-0',logs,'ja'),'復習予定');
 logs.push({wordId:'v-0',mode:'ja',correct:true});assert.equal(state.wordStatus('v-0',logs,'ja'),'学習中');assert.equal(state.wordStatus(null,logs,'ja'),'未学習');
});
test('manual entries matching material IDs participate in review and can be unsaved without deleting existing records',()=>{
 const {QuizStore}=require('../quiz-core.js'),storage=memory(),state=new AppState(storage,collection),quiz=new QuizStore(storage);state.addCustomWord({en:'term0',ja:'語'});
 const saved=state.savedVocabulary([],[]);assert.deepEqual(state.reviewCandidates([],saved.map(x=>x.id),'ja').map(x=>x.id),['v-0']);
 state.setSavedState(quiz,[],[],'english-notes.quiz.bookmarks.v1',['term0']);assert.equal(state.savedVocabulary([],[]).length,0);assert.equal(state.customWords.length,1);assert.equal(new AppState(storage,collection).savedVocabulary([],[]).length,0);
 state.addCustomWord({en:'term0',ja:'語'});assert.equal(state.savedVocabulary([],[]).length,1);
});
test('first launch has no invented review, goals or previous unit',()=>{
 const state=new AppState(memory(),collection);assert.equal(state.reviewCandidates([],[],'ja').length,0);assert.equal(state.lastUnit,null);assert.deepEqual(state.goals,{daily:null,weekly:null});
});
test('unit mistakes and skips enter review by mode; latest correct removes them; saved unanswered comes next',()=>{
 const state=new AppState(memory(),collection);const logs=[{wordId:'v-1',mode:'ja',correct:false,skipped:true},{wordId:'v-2',mode:'en',correct:false},{wordId:'v-3',mode:'ja',correct:false},{wordId:'v-3',mode:'ja',correct:true}];
 assert.deepEqual(state.reviewCandidates(logs,['v-0'],'ja').map(x=>x.id),['v-1','v-0']);assert.deepEqual(state.reviewCandidates(logs,[],'en').map(x=>x.id),['v-2']);
});
test('review count is not capped at ten and legacy saved expressions remain eligible',()=>{
 const legacy=Array.from({length:12},(_,i)=>({id:'legacy-'+i,headword:'legacy'+i}));const state=new AppState(memory(),collection,legacy);
 assert.equal(state.reviewCandidates([],legacy.map(x=>x.id),'ja').length,12);
});
test('only full ten-word unit sessions affect best scores; retries and repeated completion do not inflate them',()=>{
 const storage=memory(),state=new AppState(storage,collection);state.startUnit('ja');
 const events=items.map((x,i)=>({wordId:x.id,correct:i<7}));state.completeUnit({id:'one',mode:'ja',answers:events});state.completeUnit({id:'one',mode:'ja',answers:events});assert.equal(state.sessions.length,1);assert.equal(state.best('ja'),7);
 state.completeUnit({id:'retry',mode:'ja',answers:events.slice(0,3)});assert.equal(state.best('ja'),7);
 state.completeUnit({id:'two',mode:'ja',answers:events.map((x,i)=>({...x,correct:i<3}))});assert.equal(state.best('ja'),7);
 state.completeUnit({id:'three',mode:'en',answers:events.map(x=>({...x,correct:true}))});assert.equal(state.best('en'),10);
 const next=new AppState(storage,collection);assert.equal(next.best('ja'),7);assert.equal(next.best('en'),10);assert.equal(next.lastUnit.unitId,'c1-01');
});
test('ten repeated word IDs or a wrong unit do not count as a completed unit',()=>{
 const state=new AppState(memory(),collection);state.completeUnit({id:'duplicate',mode:'ja',answers:Array(10).fill({wordId:'v-0',correct:true})});assert.equal(state.best('ja'),null);
});
test('goals are optional, validated and survive reload without producing time records',()=>{
 const storage=memory(),state=new AppState(storage,collection);state.setGoals({daily:20,weekly:100});assert.deepEqual(new AppState(storage,collection).goals,{daily:20,weekly:100});assert.throws(()=>state.setGoals({daily:-1,weekly:100}));state.setGoals({daily:null,weekly:null});assert.deepEqual(state.goals,{daily:null,weekly:null});
});
test('failed shared preferences save restores goals and does not report partial success',()=>{
 const storage=memory(),state=new AppState(storage,collection);state.setGoals({daily:15,weekly:75});const original=storage.setItem;storage.setItem=(key,value)=>{if(key==='english-notes.quiz.settings.v1')throw Error('quota');original(key,value);};
 assert.throws(()=>state.savePreferences({settings:{mode:'ja',autoAdvance:true}},{daily:20,weekly:100},{mode:'en',autoAdvance:false}),/quota/);
 assert.deepEqual(state.goals,{daily:15,weekly:75});assert.deepEqual(new AppState(storage,collection).goals,{daily:15,weekly:75});
});
test('successful shared preferences update the same quiz store and preserve extra existing settings',()=>{
 const {QuizStore,KEYS}=require('../quiz-core.js'),storage=memory(),quiz=new QuizStore(storage),state=new AppState(storage,collection);quiz.setSettings({existing:'keep'});
 state.savePreferences(quiz,{daily:20,weekly:100},{mode:'en',autoAdvance:false},KEYS.settings);assert.equal(quiz.settings.mode,'en');assert.equal(quiz.settings.existing,'keep');assert.equal(new QuizStore(storage).settings.autoAdvance,false);assert.deepEqual(new AppState(storage,collection).goals,{daily:20,weekly:100});
});
test('shared bookmark save and removal preserve unrelated saved IDs; failures restore both stores',()=>{
 const {QuizStore,KEYS}=require('../quiz-core.js'),storage=memory(),quiz=new QuizStore(storage),state=new AppState(storage,collection);state.setSavedState(quiz,['old-id','v-0'],[0],KEYS.bookmarks);state.setSavedState(quiz,['old-id'],[],KEYS.bookmarks);assert.deepEqual(quiz.bookmarks,['old-id']);assert.deepEqual(state.articleSaves,[]);
 const original=storage.setItem;storage.setItem=(key,value)=>{if(key==='english-notes.app.article-saves.v1'&&value!=='[]')throw Error('quota');original(key,value);};assert.throws(()=>state.setSavedState(quiz,['old-id','v-1'],[1],KEYS.bookmarks),/quota/);assert.deepEqual(new QuizStore(storage).bookmarks,['old-id']);assert.deepEqual(quiz.bookmarks,['old-id']);assert.deepEqual(state.articleSaves,[]);
});
