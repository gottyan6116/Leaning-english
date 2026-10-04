const test=require('node:test');
const assert=require('node:assert/strict');
const {QuizStore,QuizSession,shuffleChoices,correctChoiceId}=require('../quiz-core.js');
const item={id:'polysemous-word',headword:'stagger',questions:{ja:{choices:['A','B','C','D'],choiceIds:['a','b','c','d'],correctChoiceId:'c',answerIndex:2},en:{choices:['AA','BB','CC','DD'],choiceIds:['aa','bb','cc','dd'],correctChoiceId:'cc',answerIndex:2}}};
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}};
test('all 24 permutations grade by immutable ID and persist the ID for both modes',()=>{
 for(const mode of ['ja','en']){const seen=new Set();for(let a=0;a<4;a++)for(let b=0;b<3;b++)for(let c=0;c<2;c++){
  const draws=[(a+.1)/4,(b+.1)/3,(c+.1)/2];const sequence=()=>{let n=0;return()=>draws[n++]};
  const order=shuffleChoices(item.questions[mode],sequence());seen.add(order.map(x=>x.id).join(','));
  for(let position=0;position<4;position++){const store=new QuizStore(memory()),session=new QuizSession([item],mode,store,()=>1000,sequence());assert.deepEqual(session.choices,order);const expected=order[position].id===correctChoiceId(item.questions[mode]);const event=session.answer(position);assert.equal(event.correct,expected);assert.equal(event.selectedChoiceId,order[position].id);assert.ok(event.eventId);assert.equal(session.answer(position),null);assert.equal(store.logs.length,1);assert.deepEqual(new QuizStore(store.storage).logs,store.logs);}
 }assert.equal(seen.size,24);}
});
test('choice identity accepts IDs, rejects unknown IDs, and preserves display order',()=>{
 const session=new QuizSession([item],'ja',new QuizStore(memory()),()=>1000,()=>0);const order=JSON.stringify(session.choices);assert.equal(session.answerChoice('unknown'),null);assert.equal(session.state,'question');assert.equal(session.answerChoice('c').correct,true);assert.equal(JSON.stringify(session.choices),order);
});
test('skipping writes no choice ID and records one wrong answer',()=>{
 const store=new QuizStore(memory()),session=new QuizSession([item],'en',store);const event=session.skip();assert.equal(event.selectedChoiceId,null);assert.equal(event.correct,false);assert.equal(event.skipped,true);assert.equal(session.skip(),null);assert.equal(store.logs.length,1);
});
