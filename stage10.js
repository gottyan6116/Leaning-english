(function(){
 'use strict';
 const Core=window.WordbookCore,Quiz=window.EnglishQuiz;
 const storage=window.AppStorage||window.localStorage;
 const state={screen:'genres',genreId:null,setId:null,setup:Core.loadSetup(storage)};
 const quizStore=()=>window.QuizUI?.getStore?.();
 const mode=()=>quizStore()?.settings.mode||'ja';
 const logs=()=>quizStore()?.logs||[];
 const catalog=()=>window.MaterialCatalog;
 const genres=()=>catalog()?.genres?.()||[],sets=()=>catalog()?.sets?.()||[];
 const organised=()=>Core.organise(genres(),sets());
 const savedIds=()=>quizStore()?.bookmarks||[];
 const sessions=()=>(()=>{try{return JSON.parse((window.AppStorage||window.localStorage).getItem('english-notes.app.unit-sessions.v1')||'[]');}catch(error){return [];}})();
 const context=()=>({logs:logs(),mode:mode(),savedIds:savedIds()});
 const findSet=id=>sets().find(s=>s.id===id),findGenre=id=>organised().find(g=>g.id===id);
 const arrow='<span class="action-chevron" aria-hidden="true">›</span>';
 const unavailable=()=>Boolean(catalog()?.hydrating?.()||catalog()?.error?.());
 function clearedCount(genre){return genre.sets.filter(s=>Core.cleared(sessions(),s.id,mode())).length;}
 function genresHtml(){
  const list=organised();
  if(!list.length){const failed=Boolean(catalog()?.error?.());return `<p class="vocabulary-empty" role="${failed?'alert':'status'}">${failed?'単語帳を読み込めませんでした':'単語帳を読み込んでいます'}</p>`;}
  return `<div class="vocabulary-group wb-genres">${list.map(g=>{const done=clearedCount(g);return `<button class="vocabulary-row wb-genre" data-wb-genre="${esc(g.id)}"><span class="vocabulary-label"><strong>${esc(g.name)}</strong><small>${esc(g.levelRange)}</small></span><span class="wb-progress" aria-label="${g.sets.length}セット中${done}セットクリア"><span class="wb-progress-bar" aria-hidden="true"><i style="width:${g.sets.length?done/g.sets.length*100:0}%"></i></span><span>${done} / ${g.sets.length}</span></span>${arrow}</button>`;}).join('')}</div>`;
 }
 function genreHtml(){
  const g=findGenre(state.genreId);if(!g)return genresHtml();
  return `<button class="back" data-wb-back="genres">単語帳 ${arrow}</button><div class="sectionhead"><h1>${esc(g.name)}</h1></div><p class="wb-sub">${esc(g.levelRange)}</p><div class="vocabulary-group">${g.sets.map(s=>{const best=Core.bestOf(sessions(),s.id,mode());return `<button class="vocabulary-row unit-row" data-wb-set="${esc(s.id)}"><span class="unit-number">${Core.setLabel(s.setNumber)}</span><span class="vocabulary-label"><strong>${esc(g.name)} ${Core.setLabel(s.setNumber)}</strong></span><span class="unit-score">ベスト ${best??0}/10</span>${best===10?'<span class="unit-clear" role="img" aria-label="クリア">✓</span>':''}${arrow}</button>`;}).join('')||'<p class="vocabulary-empty">セットはありません</p>'}</div>`;
 }
 function segment(group,options,current,disabledFor=()=>false,label=()=>''){
  return `<div class="wb-seg" role="group" aria-label="${esc(group.label)}">${options.map(([value,text])=>{const off=disabledFor(value),on=current===value;return `<button class="a5-secondary wb-opt" data-wb-${group.key}="${esc(String(value))}" aria-pressed="${on}" ${off?'disabled':''}><span>${esc(text)}</span>${label(value)?`<small>${esc(label(value))}</small>`:''}</button>`;}).join('')}</div>`;
 }
 function setupHtml(){
  const set=findSet(state.setId),g=set&&findGenre(set.genre);if(!set||!g)return genresHtml();
  const available=Core.counts(set,context());state.setup=Core.normalizeSetup(state.setup,available);
  const picked=Core.first10(Core.select(state.setup.range,set,context()));
  return `<button class="back" data-wb-back="genre">${esc(g.name)} ${arrow}</button><div class="sectionhead"><h1>${esc(g.name)}</h1></div><p class="wb-sub">${esc(set.title.replace(g.name,'').trim()||Core.setLabel(set.setNumber))}</p>
  <section class="wb-block" aria-labelledby="wb-range"><h2 id="wb-range">出題範囲</h2>${segment({key:'range',label:'出題範囲'},Core.RANGES,state.setup.range,v=>!(available[v]>0),v=>`${available[v]}語`)}</section>
  <section class="wb-block" aria-labelledby="wb-format"><h2 id="wb-format">出題形式</h2>${segment({key:'mode',label:'出題形式'},Quiz.MODES.map(m=>[m,Quiz.MODE_NAMES[m]]),mode())}</section>
  <section class="wb-block" aria-labelledby="wb-time"><h2 id="wb-time">制限時間</h2>${segment({key:'time',label:'制限時間'},Core.TIME_OPTIONS,state.setup.timeLimitMs)}</section>
  <button class="primary full wb-start" data-wb-start ${picked.length?'':'disabled'}>スタート ${arrow}</button>`;
 }
 function html(){
  if(unavailable()&&state.screen!=='genres')return '<p class="vocabulary-empty" role="status">単語帳を読み込んでいます</p>';
  return state.screen==='genre'?genreHtml():state.screen==='setup'?setupHtml():genresHtml();
 }
 const deep=()=>state.screen!=='genres'&&Boolean(findSet(state.setId)||findGenre(state.genreId));
 function rerender(){if(document.body.classList.contains('quiz-active'))return;const y=window.scrollY;render();window.scrollTo(0,y);}
 function show(screen,patch={}){Object.assign(state,{screen},patch);if(typeof AppUI!=='undefined'){AppUI.vocabularyTab('wordbook');}else rerender();}
 function openSet(setId){const set=findSet(setId);if(!set)return;state.genreId=set.genre;show('genre');}
 function start(){
  const set=findSet(state.setId);if(!set)return;const available=Core.counts(set,context());state.setup=Core.normalizeSetup(state.setup,available);
  const items=Core.first10(Core.select(state.setup.range,set,context()));if(!items.length){toast('出題できる語がありません');return;}
  Core.saveSetup(storage,state.setup);
  window.QuizUI.startWordSet(set,items,{recordScore:state.setup.range==='auto'&&items.length===10&&items.every(x=>set.items.some(y=>y.id===x.id)),timeLimitMs:state.setup.timeLimitMs||null});
 }
 document.addEventListener('click',event=>{
  const t=event.target.closest?.('[data-wb-genre],[data-wb-set],[data-wb-back],[data-wb-range],[data-wb-mode],[data-wb-time],[data-wb-start]');if(!t||t.disabled)return;
  if(t.hasAttribute('data-wb-genre'))return show('genre',{genreId:t.dataset.wbGenre});
  if(t.hasAttribute('data-wb-set'))return show('setup',{setId:t.dataset.wbSet});
  if(t.hasAttribute('data-wb-back'))return show(t.dataset.wbBack==='genre'?'genre':'genres');
  if(t.hasAttribute('data-wb-range')){state.setup={...state.setup,range:t.dataset.wbRange};Core.saveSetup(storage,state.setup);return rerender();}
  if(t.hasAttribute('data-wb-time')){state.setup={...state.setup,timeLimitMs:Number(t.dataset.wbTime)};Core.saveSetup(storage,state.setup);return rerender();}
  if(t.hasAttribute('data-wb-mode')){try{window.AppUI.saveLearningSettings({mode:t.dataset.wbMode});}catch(error){toast('設定を保存できませんでした');}return;}
  if(t.hasAttribute('data-wb-start'))return start();
 });
 window.WordbookUI={html,deep,openSet,state,start,reset:()=>{state.screen='genres';state.genreId=null;state.setId=null;}};
})();
