(function(){
 'use strict';
 const storage=window.AppStorage;
 if(!storage)return;
 let repaint=null;
 storage.subscribe(event=>{
  if(!['merge','user','import'].includes(event.reason))return;
  const scopeChanged=event.reason==='user';
  try{
   window.QuizUI?.reloadStore({scopeChanged});
   window.AppUI?.reloadData({scopeChanged});
   if(scopeChanged)window.ArticleUI?.scopeChanged();
  }catch{return;}
  if(repaint!==null)cancelAnimationFrame(repaint);
  repaint=requestAnimationFrame(()=>{
   repaint=null;
   // Keep a current local edit focused; the next page render reads merged storage.
   const editing=document.activeElement?.matches('input,textarea,select');
   if(scopeChanged||!editing)render();
  });
 });
 Promise.resolve(window.MaterialCatalog?.ready).catch(()=>null).then(()=>{
  const catalog=window.AppUI?.syncCatalog?.();
  if(catalog)storage.setCatalog(catalog.items,catalog.legacyWords);
  window.SupabaseSync?.init({storage});
 });
})();
