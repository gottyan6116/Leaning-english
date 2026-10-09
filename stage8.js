(function(){
 'use strict';
 const Core=window.CollocationCore;
 let store=null;
 try{store=new Core.CollocationStore(window.AppStorage||window.localStorage);}catch(error){store=null;}
 const items=()=>window.MaterialCatalog?.collocations?.()||[];
 const byWord=id=>id?items().filter(c=>c.wordId===id):[];
 const byArticle=id=>items().filter(c=>c.articleId===id);
 const logs=()=>{try{return store?store.logs:[];}catch(error){return [];}};
 const isSaved=id=>{try{return !!store?.isSaved(id);}catch(error){return false;}};
 const savedIds=()=>{try{return store?store.saves:[];}catch(error){return [];}};
 const pending=c=>c.status!=='verified'?'<span class="col-pending">確認中</span>':'';
 const icon=active=>`<svg viewBox="0 0 24 24" fill="${active?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>`;
 const quiet=()=>document.body.classList.contains('quiz-active');
 function rerender(){if(quiet())return;const y=window.scrollY;render();window.scrollTo(0,y);}
 function saveButton(c){const active=isSaved(c.id);return `<button class="a5-secondary a5-bookmark col-save ${active?'saved':''}" data-col-save="${esc(c.id)}" aria-label="${esc(c.form)} ${active?'の保存を解除':'を保存する'}" aria-pressed="${active}">${icon(active)}</button>`;}
 function itemHtml(c){return `<li class="col-item"><div class="col-main"><strong>${esc(c.form)}</strong>${pending(c)}<p class="col-meaning">${esc(c.meaningJa)}</p><p class="col-nuance">${esc(c.nuanceJa)}</p><p class="col-example">${esc(c.example)}</p></div>${saveButton(c)}</li>`;}
 function practiceItems(candidates,exclude=new Set()){const all=items();return Core.practiceItems(candidates.filter(c=>!exclude.has(c.id)),all,logs());}
 const canPractice=candidates=>practiceItems(candidates).length>0;
 function sectionHtml(wordId){const list=byWord(wordId);if(!list.length)return '';
  return `<section class="col-section" aria-labelledby="col-heading"><h2 id="col-heading">よく一緒に使う表現</h2>${Core.groupByType(list).map(group=>`<h3 class="col-type">${esc(group.label)}</h3><ul class="col-list">${group.items.map(itemHtml).join('')}</ul>`).join('')}${canPractice(list)?`<button class="a5-secondary col-practice" data-col-practice-word="${esc(wordId)}">この語の組み合わせを練習する</button>`:''}</section>`;}
 const articleEntryHtml=articleId=>canPractice(byArticle(articleId))?`<button class="a5-secondary a5-quiz-entry col-article-entry" data-col-practice-article="${esc(articleId)}">組み合わせを確認する</button>`:'';
 const wordLink=(word,articleId)=>byWord(word.id).length?`<button class="col-wordlink" data-col-open-word="${esc(word.id)}" data-col-article="${esc(articleId)}"><strong>${esc(word.headword)}</strong><span aria-hidden="true">›</span><span class="col-sr">の表現を見る</span></button>`:`<strong>${esc(word.headword)}</strong>`;
 function savedTabHtml(){const all=items();
  if(!all.length){const failed=Boolean(window.MaterialCatalog?.collocationError?.());return `<p class="vocabulary-empty" role="${failed?'alert':'status'}">${failed?'組み合わせを読み込めませんでした':'組み合わせを読み込んでいます'}</p>`;}
  const saved=all.filter(c=>isSaved(c.id)),reviewIds=new Set(Core.reviewItems(all,logs(),savedIds()).map(x=>x.id)),view=EnglishVocabulary.createView(saved,saved.filter(c=>reviewIds.has(c.id)),c=>Core.status(c.id,logs()));
  const sections=view.sections();if(!sections.length)return '<p class="vocabulary-empty">保存した組み合わせはありません</p>';
  return sections.map(section=>`<section class="vocabulary-section" aria-labelledby="col-state-${section.state}"><h2 id="col-state-${section.state}">${section.state} <span>${section.items.length}</span></h2><div class="vocabulary-group">${section.items.map(c=>`<button class="vocabulary-row" onclick="CollocationUI.openDetail('${esc(c.id)}')"><span class="vocabulary-label"><strong>${esc(c.form)}</strong><small>${esc(c.meaningJa)}${c.status!=='verified'?'（確認中）':''}</small></span>${AppUI.gauge(section.state)}<span class="action-chevron" aria-hidden="true">›</span></button>`).join('')}</div></section>${section.state==='復習予定'?'<div class="vocabulary-actions"><button class="primary full" onclick="CollocationUI.startReview()">復習をはじめる <span class="action-chevron" aria-hidden="true">›</span></button></div>':''}`).join('');}
 function reviewItems(){return store?Core.reviewItems(items(),logs(),savedIds()):[];}
 function launch(list,scope){if(!list.length){toast('出題できる組み合わせがありません');return;}window.QuizUI?.startCollocations?.(list,{kind:'collocation',scope});}
 const scopeCandidates=scope=>scope?.type==='article'?byArticle(scope.id):scope?.type==='word'?byWord(scope.id):items();
 function start(scope){launch(practiceItems(scopeCandidates(scope)),scope);}
 const nextSet=(scope,previous)=>practiceItems(scopeCandidates(scope),new Set(previous));
 function startReview(){launch(reviewItems().slice(0,10),{type:'review'});}
 function toggleSave(id,silent=false){try{if(!store)throw Error('storage');const saved=store.toggleSave(id);if(!silent)toast(saved?'保存しました':'保存を解除しました');return saved;}catch(error){toast('保存できませんでした');return null;}}
 async function openDetail(id){const c=items().find(x=>x.id===id);if(!c)return;try{await window.MaterialCatalog?.getWords?.([c.wordId]);AppUI.openWord(c.wordId);}catch(error){toast('語彙を取得できませんでした。もう一度お試しください');}}
 document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-col-save],[data-col-practice-word],[data-col-practice-article],[data-col-open-word]');if(!target)return;
  if(target.hasAttribute('data-col-save')){if(toggleSave(target.dataset.colSave)!==null)rerender();return;}
  if(target.hasAttribute('data-col-practice-word'))return start({type:'word',id:target.dataset.colPracticeWord});
  if(target.hasAttribute('data-col-practice-article'))return start({type:'article',id:target.dataset.colPracticeArticle});
  if(target.hasAttribute('data-col-open-word'))AppUI.openWord(target.dataset.colOpenWord,{articleId:target.dataset.colArticle});
 });
 window.CollocationUI={getStore:()=>store,items,byWord,byArticle,isSaved,toggleSave,sectionHtml,articleEntryHtml,wordLink,savedTabHtml,reviewItems,start,nextSet,startReview,openDetail};
})();
