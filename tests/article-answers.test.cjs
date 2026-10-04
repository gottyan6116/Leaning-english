const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
test('comprehension persists choice identifiers once, independently of shuffled position',()=>{
 const a=JSON.parse(fs.readFileSync('materials/articles/work-four-day-week.json','utf8')),memory=new Map(),handlers={};
 const ctx={crypto,URL,Date,Math,Promise,location:{href:'https://example.test/'},localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},document:{addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:()=>[]},go(){},render(){},toast(){},view:'article',articles:null,article:null};
 ctx.window={MaterialCatalog:{articles:()=>[a]},EnglishQuiz:require('../quiz-core.js'),scrollY:0,scrollTo(){}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('stage5.js','utf8'),ctx);ctx.window.ArticleUI.open(a.id);
 const q=a.comprehension[1],b={dataset:{a5Answer:q.id,choice:q.correctChoiceId},hasAttribute:name=>name==='data-a5-answer'},event={target:{closest:selector=>selector==='a[href]'?null:b}};
 handlers.click(event);handlers.click(event);const logs=Object.values(JSON.parse(memory.get(ctx.window.ArticleUI.readKeys.answers)));
 assert.equal(logs.length,1);assert.equal(logs[0].selectedChoiceId,q.correctChoiceId);assert.equal(logs[0].correctChoiceId,q.correctChoiceId);assert.equal(logs[0].correct,true);assert.equal(logs[0].questionId,q.id);assert.equal(logs[0].mode,'en');assert.ok(logs[0].sessionId);assert.match(logs[0].eventId,/^[\da-f-]{36}$/);
});
