(function(){
 'use strict';
 // Expressions screens (stage 16): the list of functions, the expression map of one function, the detail sheet and the practice entry.
 const Core=window.ExpressionCore;
 let store=null;
 try{store=new Core.ExpressionStore(window.AppStorage||window.localStorage);}catch(error){store=null;}
 const catalog=()=>window.MaterialCatalog;
 const data=()=>catalog()?.expressions?.()||{categories:[],functions:[],items:[]};
 const questions=()=>catalog()?.expressionQuestions?.()||[];
 const logs=()=>{try{return store?store.logs:[];}catch(error){return [];}};
 const isSaved=id=>{try{return !!store?.isSaved(id);}catch(error){return false;}};
 const state={fn:null,setting:'all'};
 let detailOpener=null;
 const byId=()=>new Map(data().items.map(e=>[e.id,e]));
 const bookmark=on=>`<svg viewBox="0 0 24 24" fill="${on?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>`;
 const pending=e=>e.status!=='verified'?'<span class="ex-pending">確認中</span>':'';
 const loadFailed=()=>Boolean(catalog()?.expressionError?.());
 function waiting(title){return `<div class="ex"><h1>${title}</h1><p class="ex-quiet" role="${loadFailed()?'alert':'status'}">${loadFailed()?'表現を読み込めませんでした':'表現を読み込んでいます'}</p></div>`;}
 // ---- Top: functions by category with "n / m" drawers ----
 function expressions(){
  const d=data();if(!d.functions.length)return waiting('表現');
  const all=logs(),sections=d.categories.map(c=>({c,list:d.functions.filter(f=>f.categoryId===c.id).sort((a,b)=>a.order-b.order)})).filter(s=>s.list.length);
  return `<div class="ex"><h1>表現</h1><p class="ex-lead">同じことを伝える言い方を、場面と相手に合わせて選べるように。上下の優劣ではなく、場面と響きの違いで引き出しを増やします。</p>
  ${sections.map(({c,list})=>`<section class="ex-cat" aria-labelledby="ex-cat-${esc(c.id)}"><h2 id="ex-cat-${esc(c.id)}">${esc(c.name)}</h2><ul class="ex-fns">${list.map(f=>{const p=Core.progress(d.items,f.id,all),pct=p.total?Math.round(p.usable/p.total*100):0;
   return `<li><button type="button" class="ex-fn" onclick="ExpressionUI.openFunction('${esc(f.id)}')"><span class="ex-fn-name">${esc(f.name)}</span><span class="ex-fn-count">引き出し ${p.usable} / ${p.total}</span><span class="ex-bar" role="progressbar" aria-label="${esc(f.name)}の引き出し" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.usable}"><i style="width:${pct}%"></i></span><span class="ex-chevron" aria-hidden="true">›</span></button></li>`;}).join('')}</ul></section>`).join('')}</div>`;
 }
 // ---- One function: the expression map ----
 const stateText=(id,states)=>{const s=states.get(id);return s&&s!=='未学習'?`<span class="ex-state">${s}</span>`:'';};
 function chip(e,states,withStrength){return `<button type="button" class="ex-chip" onclick="ExpressionUI.openDetail('${esc(e.id)}')"><span class="ex-chip-text">${esc(e.expression)}</span><span class="ex-chip-meta">${withStrength?`<span class="ex-strength">${Core.STRENGTH[e.strength]}</span>`:''}${stateText(e.id,states)}${pending(e)}</span></button>`;}
 function expressionFunction(){
  const d=data(),fn=d.functions.find(f=>f.id===state.fn);
  if(!d.functions.length)return waiting('表現');
  if(!fn)return `<div class="ex"><button type="button" class="back" onclick="go('expr')">‹ 表現</button><p class="ex-quiet">この機能が見つかりません</p></div>`;
  const items=d.items.filter(e=>e.functionId===fn.id),states=Core.statusMap(items,logs()),p=Core.progress(d.items,fn.id,logs());
  const m=Core.matrix(items,state.setting),strengths=['soft','neutral','firm'];
  const filters=[['all','すべて'],['work','仕事'],['daily','日常']].map(([v,l])=>`<button type="button" class="${state.setting===v?'active':''}" aria-pressed="${state.setting===v}" onclick="ExpressionUI.setSetting('${v}')">${l}</button>`).join('');
  const table=`<div class="ex-matrix" role="table" aria-label="丁寧さと強さの表"><div class="ex-row ex-head" role="row"><span role="columnheader"></span>${m.map(col=>`<span role="columnheader">${col.label}</span>`).join('')}</div>${strengths.map((s,si)=>`<div class="ex-row" role="row"><span class="ex-rowhead" role="rowheader">${Core.STRENGTH[s]}</span>${m.map(col=>`<div class="ex-cell" role="cell">${col.rows[si].items.map(e=>chip(e,states,false)).join('')}</div>`).join('')}</div>`).join('')}</div>`;
  const lists=`<div class="ex-lists">${m.map(col=>{const flat=col.rows.flatMap(r=>r.items);return flat.length?`<section><h3>${col.label}</h3><div class="ex-chips">${flat.map(e=>chip(e,states,true)).join('')}</div></section>`:'';}).join('')}</div>`;
  const shown=m.reduce((n,col)=>n+col.rows.reduce((k,r)=>k+r.items.length,0),0);
  return `<div class="ex"><button type="button" class="back" onclick="go('expr')">‹ 表現</button><h1>${esc(fn.name)}</h1><p class="ex-count">引き出し ${p.usable} / ${p.total}</p>
  <div class="tabs ex-filter" aria-label="場面で絞り込む">${filters}</div>
  ${shown?`${table}${lists}`:'<p class="ex-quiet">この場面の表現はありません</p>'}
  <p class="ex-axis">横：丁寧さ（カジュアル → 丁寧）／縦：強さ（控えめ → はっきり）。どれが上でも下でもなく、場面と響きの違いです。</p>
  <button type="button" class="primary full ex-practice" onclick="ExpressionUI.startPractice('${esc(fn.id)}')">この機能を練習する</button></div>`;
 }
 // ---- Detail ----
 function detailHtml(e){
  const items=byId(),states=Core.statusMap(data().items,logs()),on=isSaved(e.id);
  return `<div class="ex-sheet" role="dialog" aria-modal="true" aria-labelledby="ex-detail-title"><div class="ex-sheet-head"><h2 id="ex-detail-title">${esc(e.expression)}</h2>${pending(e)}<button type="button" class="ex-save ${on?'saved':''}" data-ex-save="${esc(e.id)}" onclick="ExpressionUI.toggleSave('${esc(e.id)}')" aria-pressed="${on}" aria-label="${esc(e.expression)} ${on?'の保存を解除':'を保存する'}">${bookmark(on)}</button></div>
  <p class="ex-tags">${Core.POLITENESS[e.politeness]}・${Core.STRENGTH[e.strength]}・${Core.SETTING[e.setting]}　<span class="ex-state-text">${states.get(e.id)||'未学習'}</span></p>
  <h3>ニュアンス</h3><p>${esc(e.nuanceJa)}</p>
  ${e.cautionJa?`<h3>注意点</h3><p>${esc(e.cautionJa)}</p>`:''}
  <h3>例の会話</h3><ul class="ex-dialogue">${e.dialogue.map(l=>`<li><b>${esc(l.speaker)}</b><span>${esc(l.text)}</span></li>`).join('')}</ul>
  <h3>近い表現</h3><ul class="ex-related">${e.related.map(r=>{const t=items.get(r.id);return t?`<li><button type="button" class="ex-link" onclick="ExpressionUI.openDetail('${esc(r.id)}',true)">${esc(t.expression)}</button><span>${esc(r.noteJa)}</span></li>`:'';}).join('')}</ul>
  <button type="button" class="ex-close" onclick="ExpressionUI.closeDetail()">閉じる</button></div>`;
 }
 function closeDetail(){const el=document.getElementById('ex-detail');if(!el)return;el.remove();document.body.classList.remove('ex-open');detailOpener?.focus?.({preventScroll:true});detailOpener=null;}
 function openDetail(id,replace=false){
  const e=byId().get(id);if(!e)return;
  if(!replace)detailOpener=document.activeElement;
  document.getElementById('ex-detail')?.remove();
  const overlay=document.createElement('div');overlay.id='ex-detail';overlay.className='ex-overlay';overlay.innerHTML=detailHtml(e);
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeDetail();});
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeDetail();}else if(event.key==='Tab'){const f=[...overlay.querySelectorAll('button')],first=f[0],last=f[f.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  document.body.append(overlay);document.body.classList.add('ex-open');overlay.querySelector('.ex-close')?.focus({preventScroll:true});
  overlay.querySelector('.ex-sheet')?.scrollTo?.(0,0);
 }
 function toggleSave(id,silent=false){
  try{if(!store)throw Error('storage');const on=store.toggleSave(id);if(!silent)toast(on?'保存しました':'保存を解除しました');
   for(const button of document.querySelectorAll(`[data-ex-save="${id}"]`)){button.classList.toggle('saved',on);button.setAttribute('aria-pressed',String(on));button.innerHTML=bookmark(on);}
   return on;}catch(error){toast('保存できませんでした');return null;}
 }
 // ---- Navigation and practice ----
 function openFunction(id){state.fn=id;state.setting='all';if(typeof view!=='undefined'&&view==='exprfn')render();else go('exprfn');window.scrollTo(0,0);}
 function setSetting(value){state.setting=value;render();}
 function items(fnId){const d=data(),map=byId();return {all:d.items,map};}
 function startPractice(fnId){
  if(!window.QuizUI?.startExpressions){toast('練習を開始できませんでした');return;}
  const {all,map}=items(),picked=Core.practiceQuestions(fnId,all,questions(),logs());
  const list=picked.map(q=>Core.quizItem(q,map.get(q.expressionId)));
  if(!list.length){toast('出題できる問題がありません');return;}
  window.QuizUI.startExpressions(list,{kind:'expression',scope:{type:'function',id:fnId}});
 }
 // Missed expressions, as quiz items (used by the combined review and the home count).
 function reviewItems(){
  if(!store||!data().items.length)return [];
  const {all,map}=items();return Core.reviewQuestions(all,questions(),logs()).map(q=>Core.quizItem(q,map.get(q.expressionId)));
 }
 window.expressions=expressions;window.expressionFunction=expressionFunction;
 window.ExpressionUI={getStore:()=>store,isSaved,toggleSave,openFunction,currentFunction:()=>state.fn,setSetting,openDetail,closeDetail,startPractice,reviewItems,reviewCount:()=>reviewItems().length};
})();
