const test=require('node:test');
const assert=require('node:assert/strict');
const {QuizStore,QuizSession,chooseReview,scoreForMode,validateItem}=require('../quiz-core.js');
const item=(id)=>({id,headword:id,meaning:'説得力のある',definition:'persuasive',example:'A persuasive argument.',questions:{ja:{choices:['説得力のある','決められない','暫定的な','曖昧な'],answerIndex:0},en:{choices:['persuasive','indecisive','tentative','ambiguous'],answerIndex:0}}});
const bank=Array.from({length:30},(_,i)=>item('word-'+i));
test('next set excludes the preceding set before ranking remaining mistakes',()=>{
 const {chooseNextSet}=require('../quiz-core.js');const logs=bank.map((x,i)=>({wordId:x.id,mode:'ja',correct:i>=10&&i<20}));
 assert.deepEqual(chooseNextSet(bank,logs,'ja',bank.slice(0,10)).map(x=>x.id),bank.slice(20).map(x=>x.id));
});
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}};
test('review prioritizes latest wrong/skip, then unanswered, excludes latest correct and another mode',()=>{
 const logs=[{wordId:'word-0',mode:'ja',correct:false,skipped:false},{wordId:'word-1',mode:'ja',correct:false,skipped:true},{wordId:'word-2',mode:'ja',correct:true},{wordId:'word-0',mode:'ja',correct:true},{wordId:'word-3',mode:'en',correct:true}];
 assert.deepEqual(chooseReview(bank,logs,'ja',10).map(x=>x.id),['word-1','word-3','word-4','word-5','word-6','word-7','word-8','word-9','word-10','word-11']);
 assert.equal(chooseReview(bank,bank.map(x=>({wordId:x.id,mode:'ja',correct:true})),'ja',10).length,0);
});
test('logs survive new store instances; scores are mode isolated',()=>{
 const storage=memory(),store=new QuizStore(storage);store.append({wordId:'word-0',mode:'ja',correct:true,skipped:false,answeredAt:'2026-10-03T00:00:00Z'});store.append({wordId:'word-0',mode:'en',correct:false,skipped:true,answeredAt:'2026-10-03T00:00:01Z'});
 const next=new QuizStore(storage);assert.equal(next.logs.length,2);assert.deepEqual(scoreForMode(next.logs,'ja'),{answered:1,correct:1,wrong:0,skipped:0});assert.deepEqual(scoreForMode(next.logs,'en'),{answered:1,correct:0,wrong:1,skipped:1});
});
test('answer locks question; duplicate calls create one event; skipped questions count wrong',()=>{
 const store=new QuizStore(memory()),session=new QuizSession(bank.slice(0,2),'ja',store,()=>1000);
 assert.equal(session.answer(0).correct,true);assert.equal(session.answer(1),null);assert.equal(store.logs.length,1);assert.equal(session.next(),true);assert.equal(session.skip().skipped,true);assert.equal(session.skip(),null);assert.equal(session.next(),false);assert.equal(session.result().correct,1);assert.equal(session.result().answered,2);assert.equal(session.result().wrongItems[0].id,'word-1');
});
test('next is disallowed before answer; pending mode applies only to later sessions',()=>{
 const store=new QuizStore(memory()),session=new QuizSession(bank.slice(0,2),'ja',store);
 assert.equal(session.next(),false);store.setSettings({mode:'en',autoAdvance:false});assert.equal(session.mode,'ja');assert.equal(new QuizStore(store.storage).settings.mode,'en');assert.equal(new QuizSession(bank.slice(0,1),store.settings.mode,store).mode,'en');
});
test('retry consists of only wrong/skip answers and interruption retains events',()=>{
 const store=new QuizStore(memory()),session=new QuizSession(bank.slice(0,3),'en',store);
 session.answer(2);session.next();session.answer(0);const result=session.result();assert.equal(result.answered,2);assert.equal(result.total,3);assert.equal(result.wrongItems.length,1);assert.equal(result.wrongItems[0].id,'word-0');assert.equal(new QuizStore(store.storage).logs.length,2);
});
test('storage failure does not pretend the answer was saved or advance',()=>{
 const store=new QuizStore({getItem:()=>null,setItem:()=>{throw Error('quota')}}),session=new QuizSession(bank.slice(0,1),'ja',store);
 assert.throws(()=>session.answer(0));assert.equal(session.state,'question');assert.equal(store.logs.length,0);
});
test('question validation rejects duplicate answers and invalid correct indexes',()=>{
 assert.equal(validateItem(item('ok')),true);const duplicate=item('bad');duplicate.questions.en.choices[1]=' PERSUASIVE ';assert.equal(validateItem(duplicate),false);const invalid=item('bad2');invalid.questions.ja.answerIndex=4;assert.equal(validateItem(invalid),false);
});
test('separate development collection contains 30 valid bilingual questions and original identifiers',()=>{
 const collection=require('../materials/development-vocabulary.js');assert.equal(collection.environment,'development');assert.equal(collection.publishedAt,null);assert.equal(collection.items.length,30);assert.equal(new Set(collection.items.map(x=>x.id)).size,30);
 for(const x of collection.items){assert.equal(validateItem(x),true,x.id);assert.ok(x.example&&x.definition&&x.partOfSpeech);assert.equal(x.questions.ja.choices[x.questions.ja.answerIndex],x.meaning);}
});
