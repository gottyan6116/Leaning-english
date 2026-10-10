const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Core=require('../expression-core.js'),Sync=require('../sync-core.js');
const {createStorage,KEYS}=require('../app-storage.js');
const {QuizSession,QuizStore,validateItem}=require('../quiz-core.js');
const material=require('../materials/expressions/expressions.json'),questionMaterial=require('../materials/expressions/expression-questions.json');
const items=material.items,questions=questionMaterial.items,byId=new Map(items.map(e=>[e.id,e])),qById=new Map(questions.map(q=>[q.id,q]));
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const quizItem=q=>Core.quizItem(q,byId.get(q.expressionId));
const seeded=(a=1)=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const ev=(expressionId,correct,i=0,extra={})=>({kind:'expression',expressionId,questionId:'q',correct,skipped:false,answeredAt:new Date(Date.UTC(2026,9,10,0,i)).toISOString(),...extra});
const single=questions.find(q=>q.format==='scene'),order=questions.find(q=>q.format==='order');

test('the shipped material: 16 functions in 7 categories, 6-9 expressions each, every expression practised',()=>{
 assert.equal(material.functions.length,16);assert.equal(material.categories.length,7);
 for(const f of material.functions){const list=items.filter(e=>e.functionId===f.id);assert.ok(list.length>=6&&list.length<=9,`${f.id}: ${list.length}`);assert.ok(list.every(e=>questions.some(q=>q.expressionId===e.id)),f.id);}
 assert.deepEqual(material.functions.map(f=>f.name).sort(),['意見を言う','賛成する','反対する','提案する','質問する','聞き返す・理解を確認する','依頼する','断る','保留する（考える時間をもらう）','相づち・反応する','話題を変える・戻す','感謝する・謝る','褒める','交渉する','進捗を報告する','誘う'].sort());
});
test('states follow the word rule: none, last wrong, last right, last two right',()=>{
 const id='expr-opinion-think';
 assert.equal(Core.status(id,[]),'未学習');
 assert.equal(Core.status(id,[ev(id,false)]),'復習予定');
 assert.equal(Core.status(id,[ev(id,true)]),'学習中');
 assert.equal(Core.status(id,[ev(id,true,1),ev(id,true,2)]),'定着');
 assert.equal(Core.status(id,[ev(id,true,1),ev(id,true,2),ev(id,false,3)]),'復習予定');
 assert.equal(Core.status(id,[ev(id,false,1),ev(id,true,2)]),'学習中','a right answer after a wrong one is not settled yet');
 assert.equal(Core.status(id,[ev(id,true,1),{...ev(id,true,2),skipped:true}]),'復習予定','a skipped answer is not a right answer');
 assert.equal(Core.status(id,[ev(id,true,1),ev(id,true,2),{kind:'vocabulary',expressionId:id,correct:false}]),'定着','other kinds of answers are ignored');
 assert.equal(Core.status(id,[ev(id,true,1),ev(id,true,2,{source:'ai'})]),'定着','answers from another source (AI feedback later) count the same way');
});
test('the "n / m" drawers count settled expressions of a function',()=>{
 const list=items.filter(e=>e.functionId==='fn-opinion'),logs=[];
 assert.deepEqual(Core.progress(items,'fn-opinion',logs),{usable:0,total:list.length});
 logs.push(ev(list[0].id,true,1),ev(list[0].id,true,2),ev(list[1].id,true,3),ev(list[2].id,true,4),ev(list[2].id,true,5));
 assert.deepEqual(Core.progress(items,'fn-opinion',logs),{usable:2,total:list.length},'two settled, one still learning');
 assert.equal(Core.progress(items,'fn-disagree',logs).usable,0,'other functions are not affected');
 assert.deepEqual(Core.reviewExpressionIds(items,[...logs,ev(list[0].id,false,6)]),[list[0].id]);
});
test('practice: ten questions, review first, formats mixed, one question per expression until each was used',()=>{
 const fn='fn-request',list=items.filter(e=>e.functionId===fn),picked=Core.practiceQuestions(fn,items,questions,[],seeded(7));
 assert.equal(picked.length,10);assert.equal(new Set(picked.map(q=>q.id)).size,10);
 assert.ok(picked.every(q=>byId.get(q.expressionId).functionId===fn));assert.ok(new Set(picked.map(q=>q.format)).size>=3,'several formats');
 assert.ok(new Set(picked.map(q=>q.expressionId)).size>=Math.min(list.length,9)-1,'spread over the expressions');
 const target=list[3].id,first=Core.practiceQuestions(fn,items,questions,[ev(target,false,1)],seeded(3));assert.equal(first[0].expressionId,target,'a missed expression comes first');
 for(const q of picked)assert.ok(validateItem(quizItem(q)),q.id);
});
test('quiz items: single choice and ordering questions pass the quiz validation, scoring is by choice ID',()=>{
 const item=quizItem(single);assert.ok(validateItem(item));assert.equal(item.kind,'expression');assert.equal(item.questions.en.choiceIds.length,4);
 const log=memory(),store=new Core.ExpressionStore(log),s=new QuizSession([item],'ja',new QuizStore(memory()),()=>1000,seeded(5),null,{expressionStore:store});
 assert.equal(s.modeOf(item),'en');const right=s.choices.find(c=>c.id===s.correctId),wrongOne=s.choices.find(c=>c.id!==s.correctId);
 const event=s.answerChoice(right.id);assert.equal(event.correct,true);assert.equal(event.kind,'expression');assert.equal(event.expressionId,single.expressionId);assert.equal(event.format,'scene');assert.equal(event.questionId,single.id);assert.equal(event.mode,'en');assert.equal(event.source,'practice');
 assert.equal(store.logs.length,1);
 const s2=new QuizSession([item],'ja',new QuizStore(memory()),()=>1000,seeded(5),null,{expressionStore:store});assert.equal(s2.answerChoice(wrongOne.id).correct,false);assert.equal(s2.result().wrongItems[0].id,single.id);
});
test('answer positions are shuffled and the correct choice is found by ID',()=>{
 const item=quizItem(single),positions=new Set();
 for(let seed=1;seed<40;seed++){const s=new QuizSession([item],'ja',new QuizStore(memory()),()=>1,seeded(seed),null,{expressionStore:new Core.ExpressionStore(memory())});positions.add(s.choices.findIndex(c=>c.id===s.correctId));assert.equal(s.choices.find(c=>c.id===s.correctId).text,single.choices.find(c=>c.id===single.answerId).text);}
 assert.ok(positions.size>=3,'the answer does not stay in one position');
});
test('ordering: all four positions must match; skipping and a bad list are handled',()=>{
 const item=quizItem(order);assert.ok(validateItem(item));
 const run=ids=>{const store=new Core.ExpressionStore(memory()),s=new QuizSession([item],'ja',new QuizStore(memory()),()=>1,seeded(2),null,{expressionStore:store});return {s,store,event:ids==='skip'?s.skip():s.answerOrder(ids==='auto'?order.correctOrder:ids)};};
 const good=run('auto');assert.equal(good.event.correct,true);assert.deepEqual(good.event.order,order.correctOrder);assert.equal(good.event.selectedChoiceId,order.correctOrder.join('|'));assert.equal(good.event.correctChoiceId,order.correctOrder.join('|'));
 const swapped=[...order.correctOrder];[swapped[0],swapped[1]]=[swapped[1],swapped[0]];const bad=run(swapped);assert.equal(bad.event.correct,false);assert.deepEqual(bad.event.order,swapped);
 assert.equal(run('skip').event.skipped,true);assert.equal(run('skip').event.correct,false);
 const probe=run('auto').s;assert.equal(new QuizSession([item],'ja',new QuizStore(memory()),()=>1,seeded(2),null,{expressionStore:new Core.ExpressionStore(memory())}).answerOrder([order.correctOrder[0]]),null,'a short list is refused');
 assert.equal(new QuizSession([item],'ja',new QuizStore(memory()),()=>1,seeded(2),null,{expressionStore:new Core.ExpressionStore(memory())}).answerOrder(['x','y','z','w']),null,'unknown IDs are refused');
 assert.ok(probe);
 const wrongKey={...item,correctOrder:['a','b','c','d']};assert.equal(validateItem(wrongKey),false,'a correct order that names unknown choices is invalid');
});
test('review: a missed expression comes back with the question that was missed or another one',()=>{
 const target=items.find(e=>e.functionId==='fn-agree'),mine=questions.filter(q=>q.expressionId===target.id),missed=mine[0];
 const logs=[ev(target.id,false,1,{questionId:missed.id})],review=Core.reviewQuestions(items,questions,logs,seeded(4));
 assert.equal(review.length,1);assert.equal(review[0].expressionId,target.id);if(mine.length>1)assert.notEqual(review[0].id,missed.id,'another question of the same expression when there is one');
 assert.deepEqual(Core.reviewQuestions(items,questions,[ev(target.id,false,1),ev(target.id,true,2)],seeded(4)),[],'answered correctly afterwards: no longer due');
});
test('the expression map groups by politeness and strength, and filters by setting',()=>{
 const list=items.filter(e=>e.functionId==='fn-disagree'),all=Core.matrix(list,'all'),work=Core.matrix(list,'work');
 assert.deepEqual(all.map(c=>c.politeness),['casual','neutral','polite']);
 assert.equal(all.reduce((n,c)=>n+c.rows.reduce((k,r)=>k+r.items.length,0),0),list.length);
 const shown=work.flatMap(c=>c.rows.flatMap(r=>r.items));assert.ok(shown.every(e=>e.setting==='work'||e.setting==='both'));assert.ok(shown.length<list.length);
 for(const col of all)for(const row of col.rows)assert.ok(row.items.every(e=>e.politeness===col.politeness&&e.strength===row.strength));
});
test('saves and answers sync as rows: expression: keys in saved_words, kind expression in answer_logs, nothing leaks into words or combinations',()=>{
 let tick=Date.parse('2026-10-10T00:00:00Z');const storage=createStorage(memory(),{now:()=>new Date(++tick).toISOString()}),store=new Core.ExpressionStore(storage);
 const id=items[0].id;store.toggleSave(id);
 const row=storage.snapshot().rows.saved_words['expression:'+id];assert.equal(row.saved,true);assert.equal(row.catalog_word_id,null);assert.deepEqual(row.payload,{origin:'expression',expressionId:id});Sync.validateRow('saved_words',row);
 assert.deepEqual(JSON.parse(storage.getItem(KEYS.customWords)),[]);assert.deepEqual(JSON.parse(storage.getItem(KEYS.bookmarks)),[]);assert.deepEqual(JSON.parse(storage.getItem(KEYS.unsaved)),[]);assert.deepEqual(JSON.parse(storage.getItem(KEYS.collocationSaves)),[]);
 assert.equal(store.isSaved(id),true);storage.setItem(KEYS.bookmarks,JSON.stringify([]));assert.equal(store.isSaved(id),true,'unrelated saves keep saved expressions');
 store.toggleSave(id);assert.equal(storage.snapshot().rows.saved_words['expression:'+id].saved,false);assert.equal(store.isSaved(id),false);
 const s=new QuizSession([quizItem(single)],'ja',new QuizStore(storage),()=>1000,seeded(9),null,{expressionStore:store});s.skip();
 const logRow=Object.values(storage.snapshot().rows.answer_logs)[0];assert.equal(logRow.kind,'expression');assert.equal(logRow.mode,'en');assert.equal(logRow.word_id,null);assert.equal(logRow.legacy_payload.expressionId,single.expressionId);Sync.validateRow('answer_logs',logRow);
 assert.equal(JSON.parse(storage.getItem(KEYS.quizAnswers)).length,0);assert.equal(JSON.parse(storage.getItem(KEYS.collocationAnswers)).length,0);assert.equal(JSON.parse(storage.getItem(KEYS.expressionAnswers)).length,1);
 assert.equal(new Core.ExpressionStore(storage).logs[0].expressionId,single.expressionId,'the event survives the round trip through the row');
});
test('study time of expression practice is a known kind with a one-minute idle limit',()=>{
 const {CONFIG}=require('../study-time.js'),Stats=require('../study-stats.js');
 assert.equal(CONFIG.idleMs.expr,60000);assert.ok(Stats.KINDS.includes('expr'));assert.ok(Sync.STUDY_KINDS.includes('expr'));
 const MIN=60000,start=Date.parse('2026-10-10T10:00:00+09:00'),seg=(id,kind)=>({id,kind,method:'auto',startedAt:new Date(start).toISOString(),endedAt:new Date(start+10*MIN).toISOString(),countedMs:10*MIN,deviceId:'d',updatedAt:'x',deletedAt:null});
 const agg=Stats.aggregate([seg('a','expr')]);assert.equal(agg.days['2026-10-10'].kinds.expr,10*MIN);assert.equal(agg.total,10*MIN);
 Sync.validateRow('study_segments',{id:'11111111-1111-4111-8111-111111111111',kind:'expr',method:'auto',started_at:'2026-10-10T01:00:00Z',ended_at:'2026-10-10T01:10:00Z',counted_ms:600000,device_id:'d',note:null,target_id:null,updated_at:'2026-10-10T01:10:00Z'});
});
test('every question can be answered correctly exactly one way',()=>{
 for(const q of questions){const item=quizItem(q);assert.ok(validateItem(item),q.id);
  if(q.format==='order'){assert.equal(new Set(q.correctOrder).size,4);}else{assert.ok(q.choices.some(c=>c.id===q.answerId));assert.equal(q.choices.filter(c=>c.id===q.answerId).length,1);}}
});
