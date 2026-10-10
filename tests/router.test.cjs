const test=require('node:test'),assert=require('node:assert/strict');
const {routeFromHref,hrefForView,install}=require('../router.js');
const BASE='https://example.test/app/';
function env(startHref,startView='home'){
 const state={view:startView,article:null,pushes:[],replaces:[],exprers:{},opened:[]};
 const location={href:startHref},history={length:1,
  pushState(_,__,href){state.pushes.push(href);location.href=href;history.length++;},replaceState(_,__,href){state.replaces.push(href);location.href=href;}};
 const win={location,history,addEventListener(type,fn){state.exprers[type]=fn;}};
 const baseGo=view=>{state.view=view;return view;};
 const router=install({window:win,getView:()=>state.view,getArticleId:()=>state.article,baseGo,openArticle:id=>{state.opened.push(id);state.view='article';state.article=id;},whenReady:()=>Promise.resolve()});
 const go=view=>router.go(view);
 return {state,location,router,go,pop:href=>{location.href=href;state.exprers.popstate({});}};
}
test('addresses map to screens and back',()=>{
 assert.deepEqual(routeFromHref(BASE+'?view=home'),{view:'home'});assert.deepEqual(routeFromHref(BASE+'?view=vocab'),{view:'vocab'});assert.deepEqual(routeFromHref(BASE+'?view=expr'),{view:'expr'});assert.deepEqual(routeFromHref(BASE+'?view=expr&fn=fn-opinion'),{view:'exprfn',id:'fn-opinion'});assert.equal(hrefForView('exprfn','fn-opinion',BASE+'?view=expr'),BASE+'?view=expr&fn=fn-opinion');assert.equal(hrefForView('expr',null,BASE+'?view=expr&fn=fn-opinion'),BASE+'?view=expr');assert.deepEqual(routeFromHref(BASE+'?view=records'),{view:'records'});
 assert.deepEqual(routeFromHref(BASE+'?view=articles&category=work&level=B1&q=a'),{view:'articles'});assert.deepEqual(routeFromHref(BASE+'?view=list'),{view:'articles'});
 assert.deepEqual(routeFromHref(BASE+'?view=article&id=article-x'),{view:'article',id:'article-x'});assert.deepEqual(routeFromHref(BASE+'?view=article'),{view:'articles'},'an article address without an ID falls back to the list');
 assert.equal(routeFromHref(BASE),null);assert.equal(routeFromHref(BASE+'?view=nonsense'),null);assert.equal(routeFromHref('not a url'),null);
 assert.equal(hrefForView('home',null,BASE+'?view=articles&level=B1'),BASE+'?view=home','leaving the list drops its filters');
 assert.equal(hrefForView('articles',null,BASE+'?view=articles&level=B1'),BASE+'?view=articles&level=B1','the list keeps its own filters');
 assert.equal(hrefForView('articles',null,BASE+'?view=home'),BASE+'?view=articles');
 assert.equal(hrefForView('article','a1',BASE+'?view=articles'),BASE+'?view=article&id=a1');assert.equal(hrefForView('article','a1',BASE+'?view=articles&level=B1'),BASE+'?view=article&id=a1');
 assert.equal(hrefForView('word',null,BASE+'?view=vocab'),BASE+'?view=vocab');assert.equal(hrefForView('quiz',null,BASE),BASE+'?view=vocab','detail screens stay under their parent');
 assert.equal(hrefForView('home',null,BASE+'#records'),BASE+'?view=home');
});
test('every screen change is a history entry, and the address always names the screen being shown',()=>{
 const e=env(BASE+'?view=articles&category=work','articles');
 e.go('home');assert.equal(e.location.href,BASE+'?view=home');assert.equal(e.state.view,'home');assert.equal(routeFromHref(e.location.href).view,e.state.view);
 e.go('vocab');assert.equal(e.location.href,BASE+'?view=vocab');
 e.go('word');assert.equal(e.location.href,BASE+'?view=vocab','a detail screen keeps the parent address (no duplicate entry)');assert.equal(e.state.pushes.length,2);
 e.go('articles');assert.equal(e.location.href,BASE+'?view=articles');
 e.state.article='article-1';e.go('article');assert.equal(e.location.href,BASE+'?view=article&id=article-1');
 e.go('expr');e.go('records');assert.equal(e.location.href,BASE+'?view=records');
 e.go('home');e.go('home');assert.equal(e.state.pushes.filter(h=>h===BASE+'?view=home').length,2,'the first home entry plus one after records; going to the same screen twice adds nothing');
});
test('the example failure: leaving the article list no longer leaves ?view=articles in the address',()=>{
 const e=env(BASE+'?view=articles','articles');e.go('home');
 assert.doesNotMatch(e.location.href,/articles/);assert.equal(e.state.view,'home');
});
test('back and forward restore screens without adding history entries',()=>{
 const e=env(BASE+'?view=home','home');e.go('vocab');e.go('expr');const pushes=e.state.pushes.length;
 e.pop(BASE+'?view=vocab');assert.equal(e.state.view,'vocab');e.pop(BASE+'?view=home');assert.equal(e.state.view,'home');e.pop(BASE+'?view=records');assert.equal(e.state.view,'records');
 assert.equal(e.state.pushes.length,pushes,'restoring never pushes');
 e.pop(BASE+'?view=articles&level=C1');assert.equal(e.state.view,'records','the article list restores its own filters in stage5.js');
 e.pop(BASE+'?view=article&id=a9');return Promise.resolve().then(()=>{assert.deepEqual(e.state.opened,['a9']);assert.equal(e.state.pushes.length,pushes);});
});
test('the start-up address decides the first screen; without one the current screen is written without a new entry',async()=>{
 let e=env(BASE+'?view=vocab','home');e.router.restore();assert.equal(e.state.view,'vocab');assert.equal(e.state.pushes.length,0);
 e=env(BASE,'home');e.router.restore();assert.equal(e.location.href,BASE+'?view=home');assert.equal(e.state.pushes.length,0);assert.equal(e.state.replaces.length,1);
 e=env(BASE+'?view=article&id=article-7','home');e.router.restore();await Promise.resolve();await Promise.resolve();assert.deepEqual(e.state.opened,['article-7']);assert.equal(e.state.pushes.length,0);
 e=env(BASE+'?view=articles&q=skills','home');e.router.restore();assert.equal(e.state.view,'articles');assert.equal(e.location.href,BASE+'?view=articles&q=skills','filters survive');
});
test('after login the address in the bar is honored instead of forcing the home screen',()=>{
 const e=env(BASE+'?view=articles','home');e.router.restore();assert.equal(e.state.view,'articles');
 e.go('expr');e.pop(BASE+'?view=records');e.router.restore();assert.equal(e.state.view,'records');
});
