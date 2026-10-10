(function(root){
 'use strict';
 // One mapping between the screen being shown and the address bar. go() pushes history entries,
 // back/forward restore screens, and the address given at start-up or after login decides the first screen.
 const MAIN=['home','vocab','articles','expr','records'];
 const SUB={word:'vocab',quiz:'vocab',exprfn:'expr'};
 // Returns {view,id?} for an address, or null when it names no screen.
 function routeFromHref(href){
  let params;try{params=new URL(href).searchParams;}catch(error){return null;}
  const value=params.get('view');
  if(value==='list')return {view:'articles'};
  if(value==='article'){const id=params.get('id');return id?{view:'article',id}:{view:'articles'};}
  if(value==='expr'){const fn=params.get('fn');return fn?{view:'exprfn',id:fn}:{view:'expr'};}
  return MAIN.includes(value)?{view:value}:null;
 }
 // The address that belongs to a screen. The article list keeps its own filter parameters.
 function hrefForView(view,articleId,currentHref){
  const url=new URL(currentHref),screen=SUB[view]||view;
  if(screen==='articles'){const current=routeFromHref(currentHref);if(current?.view==='articles'&&['articles','list'].includes(url.searchParams.get('view')))return currentHref;}
  for(const key of ['view','id','fn','category','level','q'])url.searchParams.delete(key);
  if(view==='exprfn'&&articleId){url.searchParams.set('view','expr');url.searchParams.set('fn',articleId);url.hash=url.hash==='#records'?'':url.hash;return url.href;}
  if(screen==='article'&&articleId){url.searchParams.set('view','article');url.searchParams.set('id',articleId);}
  else url.searchParams.set('view',MAIN.includes(screen)?screen:'home');
  url.hash=url.hash==='#records'?'':url.hash;
  return url.href;
 }
 // env: {window, getView(), getArticleId(), baseGo(view), openArticle(id), whenReady()}
 function install(env){
  const win=env.window;let restoring=false;
  const sync=push=>{const target=hrefForView(env.getView(),env.getArticleId?.(),win.location.href);if(target!==win.location.href)win.history[push?'pushState':'replaceState']({router:true},'',target);};
  function go(view){const result=env.baseGo.apply(this,arguments);if(!restoring)sync(true);return result;}
  function apply(route,fallback){
   restoring=true;
   try{
    if(!route){if(fallback)env.baseGo(fallback);}
    else if(route.view==='exprfn'){Promise.resolve(env.whenReady?.()).then(()=>{restoring=true;try{env.openFunction?.(route.id);}finally{restoring=false;}});}
    else if(route.view==='article'){Promise.resolve(env.whenReady?.()).then(()=>{restoring=true;try{env.openArticle(route.id);}finally{restoring=false;}});}
    else if(route.view!==env.getView()||fallback==='force')env.baseGo(route.view);
   }finally{restoring=false;}
  }
  // First screen: the address wins; without one the current screen's address is written (no new history entry).
  function restore(){const route=routeFromHref(win.location.href);if(route)apply(route);else sync(false);}
  function onPopState(){
   const route=routeFromHref(win.location.href);if(!route)return;
   if(route.view==='articles')return; // the article list restores its own filters (stage5.js)
   apply(route,'force');
  }
  win.addEventListener?.('popstate',onPopState);
  return {go,restore,sync,onPopState};
 }
 const api={routeFromHref,hrefForView,install,MAIN};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else{
  root.RouterCore=api;
  const baseGo=root.go,router=install({window:root,getView:()=>view,getArticleId:()=>(view==='exprfn'?root.ExpressionUI?.currentFunction?.():root.ArticleUI?.currentId?.())||null,openFunction:id=>root.ExpressionUI?.openFunction(id),baseGo:function(v){const result=baseGo.apply(this,arguments);root.StudyTimer?.onView(v);return result;},openArticle:id=>root.ArticleUI?.open(id),whenReady:()=>root.MaterialCatalog?.ready});
  // Every screen change made through go() is also a history entry; restores call the unwrapped go() and never push.
  root.go=router.go;
  root.Router={restore:router.restore,sync:router.sync};
  router.restore();
 }
})(typeof window!=='undefined'?window:globalThis);
