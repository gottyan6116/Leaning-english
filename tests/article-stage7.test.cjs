const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
function setup(getArticle){
 const a=JSON.parse(fs.readFileSync('materials/articles/work-four-day-week.json','utf8'));
 const metadata={...a};delete metadata.paragraphs;delete metadata.vocabulary;delete metadata.comprehension;delete metadata.sources;
 const handlers={},memory=new Map();
 const ctx={crypto,URL,Date,Math,Promise,location:{href:'https://example.test/'},localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},document:{addEventListener:(n,fn)=>handlers[n]=fn,querySelectorAll:()=>[],getElementById:()=>null},go(){},render(){},toast(){},ico:()=>'',view:'article',articles:null,article:null};
 ctx.window={MaterialCatalog:{articles:()=>[metadata],getArticle:getArticle||(()=>Promise.resolve(a))},EnglishQuiz:require('../quiz-core.js'),scrollY:0,scrollTo(){}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('stage5.js','utf8'),ctx);
 function click(attr,dataset={}){handlers.click({target:{closest:s=>s==='a[href]'?null:{dataset,hasAttribute:n=>n===attr}}})}
 return {a,ctx,handlers,click};
}
test('article index uses metadata and requests body only when an article is opened',async()=>{
 let calls=0;const h=setup(()=>{calls++;return Promise.resolve(h.a)});
 const index=h.ctx.window.ArticleUI.articles();assert.equal(calls,0);assert.match(index,/data-a7-level="A2"/);assert.match(index,/元記事/);assert.doesNotMatch(index,/From June to December/);
 h.ctx.window.ArticleUI.open(h.a.id);await Promise.resolve();await Promise.resolve();assert.equal(calls,1);assert.match(h.ctx.window.ArticleUI.article(),/From June to December/);
});
test('paragraph translations open independently, all-toggle opens all, and reopening resets them',async()=>{
 const h=setup();h.ctx.window.ArticleUI.open(h.a.id);await Promise.resolve();await Promise.resolve();
 let html=h.ctx.window.ArticleUI.article();assert.equal((html.match(/class="a7-translation"[^>]+hidden/g)||[]).length,6);
 h.click('data-a7-translation',{a7Translation:'p2'});html=h.ctx.window.ArticleUI.article();assert.match(html,/id="a7-ja-p2" >/);assert.match(html,/id="a7-ja-p1" hidden/);
 h.handlers.change({target:{matches:()=>true,checked:true}});html=h.ctx.window.ArticleUI.article();assert.equal((html.match(/class="a7-translation"[^>]+hidden/g)||[]).length,0);
 h.ctx.window.ArticleUI.open(h.a.id);await Promise.resolve();await Promise.resolve();html=h.ctx.window.ArticleUI.article();assert.equal((html.match(/class="a7-translation"[^>]+hidden/g)||[]).length,6);
});
test('switching account while body is loading cannot display stale user article state',async()=>{
 let resolve;const h=setup(()=>new Promise(r=>resolve=r));h.ctx.window.ArticleUI.open(h.a.id);h.ctx.window.ArticleUI.scopeChanged();resolve(h.a);await Promise.resolve();await Promise.resolve();assert.doesNotMatch(h.ctx.window.ArticleUI.article(),/From June to December/);
});
test('body fetch failure offers retry and does not expose body or answer UI',async()=>{
 const h=setup(()=>Promise.reject(Error('offline')));h.ctx.window.ArticleUI.open(h.a.id);await Promise.resolve();await Promise.resolve();await Promise.resolve();const html=h.ctx.window.ArticleUI.article();assert.match(html,/data-a7-retry/);assert.doesNotMatch(html,/data-a5-answer=/);
});
test('category and level filters combine instead of replacing each other',()=>{
 const h=setup();h.click('data-a5-filter',{a5Filter:'教養'});h.click('data-a7-level',{a7Level:'A2'});assert.match(h.ctx.window.ArticleUI.articles(),/該当する記事はありません/);
});
test('selection saving accepts English paragraphs but rejects ranges containing Japanese translations',()=>{
 const h=setup(),panel={hidden:true},label={textContent:''},paragraph={textContent:'People need to understand the danger.'};
 const node={nodeType:1,closest:selector=>selector==='[data-a5-paragraph]'?paragraph:null};let includesTranslation=true;
 h.ctx.document.getElementById=id=>id==='a5-body'?{contains:()=>true}:id==='a5-selection'?panel:id==='a5-selection-text'?label:null;
 h.ctx.window.getSelection=()=>({isCollapsed:false,anchorNode:node,focusNode:node,toString:()=> 'understand the danger',getRangeAt:()=>({cloneContents:()=>({querySelector:()=>includesTranslation?{}:null})})});
 h.handlers.mouseup();assert.equal(panel.hidden,true);includesTranslation=false;h.handlers.mouseup();assert.equal(panel.hidden,false);assert.equal(label.textContent,'understand the danger');
});
