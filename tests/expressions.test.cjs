const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validateExpressions}=require('../scripts/validate-expressions.cjs');
const source=path.join(__dirname,'../materials/expressions');
const clone=mutate=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'expr-'));const e=JSON.parse(fs.readFileSync(path.join(source,'expressions.json'),'utf8')),q=JSON.parse(fs.readFileSync(path.join(source,'expression-questions.json'),'utf8'));mutate(e,q);fs.writeFileSync(path.join(dir,'expressions.json'),JSON.stringify(e));fs.writeFileSync(path.join(dir,'expression-questions.json'),JSON.stringify(q));return validateExpressions(dir).errors;};
test('the shipped expressions and questions pass every check',()=>{assert.deepEqual(validateExpressions().errors,[]);});
test('each function has 6-9 expressions, at least ten questions, and every expression is practised',()=>{
 const {material,questionMaterial}=validateExpressions();
 for(const f of material.functions){const list=material.items.filter(e=>e.functionId===f.id);assert.ok(list.length>=6&&list.length<=9,f.id);assert.ok(questionMaterial.items.filter(q=>list.some(e=>e.id===q.expressionId)).length>=10,f.id);}
 assert.ok(material.items.every(e=>e.status==='unverified'));assert.ok(questionMaterial.items.every(q=>['scene','tone','order','dialogue'].includes(q.format)));
});
test('every question has a reason, and a why-not reason for each wrong choice (a note for each choice when ordering)',()=>{
 const {questionMaterial}=validateExpressions();
 for(const q of questionMaterial.items){assert.ok(q.reasonJa);if(q.format==='order'){assert.equal(Object.keys(q.notesJa).length,4);assert.equal(q.correctOrder.length,4);}else{assert.equal(Object.keys(q.whyNotJa).length,3);assert.ok(!(q.answerId in q.whyNotJa));}}
});
test('the validator catches missing items, duplicates, unknown or foreign related IDs, and ordering mistakes',()=>{
 assert.ok(clone(e=>{delete e.items[0].nuanceJa;}).some(x=>/nuanceJa required/.test(x)));
 assert.ok(clone(e=>{e.items[1].expression=e.items[0].expression;}).some(x=>/duplicate expression/.test(x)));
 assert.ok(clone(e=>{e.items[1].id=e.items[0].id;}).some(x=>/duplicate ID/.test(x)));
 assert.ok(clone(e=>{e.items[0].related[0].id='expr-opinion-nothing';}).some(x=>/does not exist/.test(x)));
 assert.ok(clone(e=>{const other=e.items.find(x=>x.functionId!==e.items[0].functionId);e.items[0].related[0].id=other.id;}).some(x=>/another function/.test(x)));
 assert.ok(clone(e=>{e.items[0].related=[...e.items[0].related,...e.items[1].related,...e.items[2].related].slice(0,4).map((r,i)=>({id:r.id+'',noteJa:'x'}));}).some(x=>/related/.test(x)));
 assert.ok(clone(e=>{e.items[0].politenessRank=e.items[0].politeness==='polite'?1:5;}).some(x=>/does not match/.test(x)));
 assert.ok(clone((e,q)=>{const o=q.items.find(x=>x.format==='order');o.correctOrder=[...o.correctOrder].reverse();}).some(x=>/not strictly casual-to-polite/.test(x)));
 assert.ok(clone((e,q)=>{const s=q.items.find(x=>x.format==='scene');s.reasonJa='';}).some(x=>/reason required/.test(x)));
 assert.ok(clone((e,q)=>{const s=q.items.find(x=>x.format==='scene');const wrong=s.choices.find(c=>c.id!==s.answerId);delete s.whyNotJa[wrong.id];}).some(x=>/why each other choice/.test(x)));
 assert.ok(clone((e,q)=>{const s=q.items.find(x=>x.format==='scene');s.answerId='missing';}).some(x=>/answerId/.test(x)));
});
test('a nuance that only restates the meaning is rejected',()=>{
 assert.ok(clone(e=>{e.items[0].nuanceJa='意見を言うときに使う表現です。';}).some(x=>/nuance/.test(x)));
});
test('unbalanced functions are rejected (all one politeness, or too few expressions)',()=>{
 assert.ok(clone(e=>{for(const x of e.items.filter(i=>i.functionId==='fn-opinion')){x.politeness='polite';x.politenessRank=4;}}).some(x=>/politeness/.test(x)));
 assert.ok(clone(e=>{e.items=e.items.filter(i=>!(i.functionId==='fn-opinion'&&['think','feel','askme'].some(k=>i.id.endsWith(k))));for(const i of e.items)i.related=i.related.filter(r=>e.items.some(t=>t.id===r.id));}).some(x=>/expressions \(need 6-9\)/.test(x)));
});
