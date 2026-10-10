(function(){
 'use strict';
 const H=window.HomeCore;
 const KEYS={quiz:'english-notes.quiz.answers.v1',articleAnswers:'english-notes.article.answers.v1',reads:'english-notes.article.read.v1',sessions:'english-notes.app.unit-sessions.v1',done:'english-notes.home.completions.v1'};
 let weekOffset=0;
 const store=()=>window.AppStorage||window.localStorage;
 const readJson=(key,fallback)=>{try{const raw=store().getItem(key);return raw===null?fallback:JSON.parse(raw);}catch(error){return fallback;}};
 const asArray=v=>Array.isArray(v)?v:[];
 // The nickname lives in the account (Supabase Auth user_metadata). Guests have none; it is read from the last known sign-in state, so it also shows offline.
 const displayName=()=>(window.SupabaseSync?.getState?.().user?.nickname||'').trim();
 let subscribed=false,lastName=null;
 function watchAccount(){
  if(subscribed||!window.SupabaseSync?.subscribe)return;subscribed=true;
  window.SupabaseSync.subscribe(()=>{const name=displayName();if(name===lastName)return;lastName=name;updateAccountLabel();if(typeof view!=='undefined'&&view==='home'&&!document.body.classList.contains('quiz-active'))window.render();});
 }
 const quizStore=()=>window.QuizUI?.getStore?.();
 const catalog=()=>window.MaterialCatalog;
 const marks=n=>window.WordbookCore.setLabel(n);
 function data(){
  return {vocabLogs:asArray(readJson(KEYS.quiz,[])),collocLogs:(()=>{try{return window.CollocationUI?.getStore?.()?.logs||[];}catch(error){return [];}})(),
   articleAnswers:Object.values(readJson(KEYS.articleAnswers,{})||{}),reads:readJson(KEYS.reads,{})||{},completions:asArray(readJson(KEYS.done,[])),studyMs:studyMs()};
 }
 // Measured study time per Japan-time day, in ms (overlapping devices already counted once).
 function studyMs(){try{const agg=window.StudyStats.aggregate(asArray(readJson('english-notes.study.segments.v1',[])));return Object.fromEntries(Object.entries(agg.days).map(([day,value])=>[day,value.total]));}catch(error){return {};}}
 function recordCompletion(session){
  try{
   const kinds=new Set(session.items.map(item=>item.kind==='collocation'?'colloc':'vocab'));let list=asArray(readJson(KEYS.done,[]));
   for(const kind of kinds)list=H.addCompletion(list,kind,session.id,Date.now());
   store().setItem(KEYS.done,JSON.stringify(list));
  }catch(error){/* the day is still counted from synced answers */}
 }
 const icons={
  book:'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M8 8h7 M8 12h5',
  link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  doc:'M7 3h8l4 4v14H7z M15 3v4h4 M10 12h6 M10 16h6',
  flame:'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  clock:'M12 7v5l3 2 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  chart:'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  today:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  news:'M5 5h14v14H5z M8 9h8 M8 13h8 M8 16h5',
  chevron:'m9 5 7 7-7 7',
  check:'m5 12 4 4L19 6',
  play:'M8 5v14l11-7z'
 };
 const svg=(name,cls='')=>`<svg class="hm-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="${name==='play'?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[name]}"/></svg>`;
 const kindIcon={vocab:'book',colloc:'link',article:'doc'};
 const kindBadge=(kind,size)=>`<span class="hm-kind hm-kind-${kind} ${size}" aria-hidden="true">${svg(kindIcon[kind])}</span>`;
 const chevron=()=>`<span class="hm-chevron" aria-hidden="true">${svg('chevron')}</span>`;
 const articleList=()=>catalog()?.articles?.()||[];
 const setsList=()=>catalog()?.sets?.()||[];
 const genresList=()=>catalog()?.genres?.()||[];
 function setTitle(set){const genre=genresList().find(g=>g.id===set.genre);return `${genre?genre.name:''}${marks(set.setNumber)}`;}
 function resolver(){
  const bySet=new Map();for(const set of setsList())for(const item of set.items)bySet.set(item.id,set);
  return {setTitleOf:ids=>{const found=new Set(ids.map(id=>bySet.get(id)?.id));if(found.size!==1||found.has(undefined))return null;return setTitle(bySet.get(ids[0]));},
   articleTitle:id=>articleList().find(a=>a.id===id)?.title||null};
 }
 function context(){
  const quiz=quizStore(),mode=quiz?.settings.mode||'ja',sessions=readJson(KEYS.sessions,[]),reads=readJson(KEYS.reads,{})||{};
  const set=H.pickSet(genresList(),setsList(),s=>window.WordbookCore.bestOf(asArray(sessions),s.id,mode));
  return {wordReview:window.AppUI?.reviewItems?.().length||0,collocReview:window.CollocationUI?.reviewItems?.().length||0,
   set:set?{id:set.id,title:setTitle(set)}:null,articles:articleList(),readIds:new Set(Object.entries(reads).filter(([,v])=>v?.completedAt).map(([id])=>id))};
 }
 function startTask(task){
  switch(task.action){
   case 'word-review':return window.QuizUI.startReviewWords();
   case 'word-set':return window.WordbookUI.quickStart(task.setId);
   case 'colloc-review':return window.CollocationUI.startReview();
   case 'colloc-quiz':return window.CollocationUI.start({type:'all'});
   case 'article':return window.ArticleUI.open(task.articleId);
  }
 }
 let current={tasks:[]};
 function todayCard(list,done){
  const count=list.filter(t=>t.done).length,state=H.primaryState(list);
  return `<section class="hm-card hm-today" aria-labelledby="hm-today-title"><div class="hm-card-head hm-today-head"><h2 id="hm-today-title">${svg('today','hm-head-icon')}今日の学習</h2><span class="hm-count">${count} / ${list.length} 完了</span></div>
  <ul class="hm-tasks">${list.map((t,i)=>`<li><button class="hm-task" data-hm-task="${i}" ${t.action==='none'?'disabled':''}>${t.done?`<span class="hm-check done" role="img" aria-label="完了">${svg('check')}</span>`:'<span class="hm-check" role="img" aria-label="未完了"></span>'}${kindBadge(t.kind,'hm-kind-lg')}<span class="hm-task-text"><strong>${esc(t.title)}</strong><small>${esc(t.sub)}</small></span>${chevron()}</button></li>`).join('')}</ul>
  ${state.kind==='start'?`<button class="primary full hm-start" data-hm-start>${svg('play')}<span>${esc(state.label)}</span></button>`:'<p class="hm-complete" role="status">今日の学習は完了です</p>'}</section>`;
 }
 function recentCard(list){
  if(!list.length)return '';
  return `<section class="hm-card hm-recent" aria-labelledby="hm-recent-title"><div class="hm-card-head"><h2 id="hm-recent-title">${svg('clock','hm-head-icon')}最近の学習</h2><button class="hm-link" data-hm-go="records">すべて見る${chevron()}</button></div>
  <ul class="hm-rows">${list.map((r,i)=>`<li><button class="hm-row" data-hm-recent="${i}">${kindBadge(r.kind,'hm-kind-sm')}<span class="hm-row-text"><strong>${esc(r.title)}</strong><small>${esc(r.sub)}</small></span>${chevron()}</button></li>`).join('')}</ul></section>`;
 }
 function calendarCard(days,today){
  const dates=H.weekDates(today,weekOffset);
  return `<section class="hm-card hm-calendar" aria-label="週のカレンダー"><div class="hm-cal-head"><button class="hm-cal-nav" data-hm-week="-1" aria-label="前の週">${svg('chevron','hm-flip')}</button><h2>${esc(H.monthTitle(dates))}</h2><button class="hm-cal-nav" data-hm-week="1" aria-label="次の週">${svg('chevron')}</button></div>
  <div class="hm-cal-grid" role="list">${dates.map((d,i)=>`<div class="hm-cal-day" role="listitem" aria-label="${esc(H.label(d))}${days.has(d)?'、学習した日':''}${d===today?'、今日':''}"><span class="hm-cal-wd">${H.WEEKDAYS[i]}</span><span class="hm-cal-num ${d===today?'today':''}">${H.dayOfMonth(d)}</span><span class="hm-cal-dot ${days.has(d)?'on':''}" aria-hidden="true"></span></div>`).join('')}</div></section>`;
 }
 // Shown only for the goals the learner has set (minutes per day / per week).
 function goalLines(stats){
  const goals=window.AppUI?.goals?.()||{},rows=[];
  if(stats.metric==='minutes'){
   if(goals.daily)rows.push(`今日 ${stats.series[stats.todayIndex]??0} / ${goals.daily}分`);
   if(goals.weekly)rows.push(`今週 ${stats.total} / ${goals.weekly}分`);
  }
  return rows.length?`<ul class="hm-goals">${rows.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:'';
 }
 function progressCard(stats){
  const metric=H.METRICS[stats.metric],max=Math.max(1,...stats.series);
  return `<section class="hm-card hm-progress" aria-labelledby="hm-progress-title"><div class="hm-card-head"><h2 id="hm-progress-title">${svg('chart','hm-head-icon')}学習の進捗</h2><button class="hm-link" data-hm-go="records">詳細${chevron()}</button></div>
  <div class="hm-week"><div class="hm-week-total"><span class="hm-week-label">${esc(metric.label)}</span><strong>${stats.total}<small>${esc(metric.unit)}</small></strong></div>
  <div class="hm-bars" role="img" aria-label="${esc(stats.dates.map((d,i)=>`${H.WEEKDAYS[i]}曜 ${stats.series[i]}${metric.unit}`).join('、'))}">${stats.series.map((v,i)=>`<div class="hm-bar-col"><span class="hm-bar-track"><span class="hm-bar ${i===stats.todayIndex?'today':''}" style="height:${Math.max(8,Math.round(v/max*100))}%"></span></span><span class="hm-bar-label ${i===stats.todayIndex?'today':''}">${H.WEEKDAYS[i]}</span></div>`).join('')}</div></div>
  ${goalLines(stats)}
  <div class="hm-tiles"><div class="hm-tile"><span>学習した単語</span><strong>${stats.words}<small>語</small></strong></div><div class="hm-tile"><span>読んだ記事</span><strong>${stats.articles}<small>本</small></strong></div><div class="hm-tile"><span>組み合わせ</span><strong>${stats.collocations}<small>件</small></strong></div></div></section>`;
 }
 function streakCard(days,today){
  const n=H.streak(days,today),week=H.lastDays(days,today);
  return `<section class="hm-card hm-streak" aria-labelledby="hm-streak-title"><div class="hm-card-head"><h2 id="hm-streak-title">${svg('flame','hm-head-icon hm-flame')}継続記録</h2><button class="hm-link hm-link-icon" data-hm-go="records" aria-label="記録を見る">${chevron()}</button></div>
  ${days.size?`<p class="hm-streak-count"><strong>${n}</strong>日連続</p><ul class="hm-week-checks">${week.map(d=>`<li><span class="hm-day-check ${d.learned?'done':''}" role="img" aria-label="${esc(d.label)}${d.learned?' 学習した':' 学習していない'}">${d.learned?svg('check'):''}</span><small>${esc(d.label)}</small></li>`).join('')}</ul>`:'<p class="hm-empty">今日から始めましょう</p>'}</section>`;
 }
 function newsCard(list){
  if(!list.length)return '';
  const date=a=>{const t=Date.parse(a.sourcePublishedAt||'');return Number.isFinite(t)?`${Number(H.jstDate(t).slice(5,7))}月${Number(H.jstDate(t).slice(8,10))}日`:'';};
  const photo=a=>a.photo?.assetPath&&/^assets\/[a-zA-Z0-9_./-]+$/.test(a.photo.assetPath)?`<img src="${esc(a.photo.assetPath)}" alt="" loading="lazy">`:`<span class="hm-thumb-fallback">${svg('doc')}</span>`;
  return `<section class="hm-card hm-news" aria-labelledby="hm-news-title"><div class="hm-card-head"><h2 id="hm-news-title">${svg('news','hm-head-icon')}新着の記事</h2><button class="hm-link" data-hm-go="articles">すべて見る${chevron()}</button></div>
  <ul class="hm-rows">${list.map(a=>`<li><button class="hm-article" data-hm-article="${esc(a.id)}"><span class="hm-thumb">${photo(a)}</span><span class="hm-article-text"><strong>${esc(a.title)}</strong><span class="hm-meta"><span class="a7-level">${esc(a.level)}</span><span>${esc(a.category)}</span><span>${esc(date(a))}</span></span></span></button></li>`).join('')}</ul></section>`;
 }
 function render_home(){
  watchAccount();lastName=displayName();
  const now=Date.now(),today=H.jstDate(now),d=data(),days=H.learningDays(d),done=H.doneToday(d,today),ctx=context(),list=H.tasks(ctx,done),stats=H.weekStats(d,today),name=displayName();
  current={tasks:list,recent:H.recent(d,now,resolver()),articles:articleList()};
  const greet=H.greetingWord(now);
  return `<div class="hm"><div class="hm-col hm-main"><div class="hm-greet"><small class="hm-date">${esc(H.formatDate(now))}</small><h1>${esc(greet)}${name?`<span class="hm-name"><span class="hm-comma">、</span>${esc(name)}さん</span>`:''}</h1></div>
  ${todayCard(list,done)}${recentCard(current.recent)}</div>
  <div class="hm-col hm-side">${calendarCard(days,today)}${progressCard(stats)}${streakCard(days,today)}${newsCard(articleList().slice(0,2))}</div></div>`;
 }
 function open(kind,index){
  if(kind==='recent'){const r=current.recent[index];if(!r)return;if(r.kind==='article'&&r.articleId)return window.ArticleUI.open(r.articleId);window.AppUI.vocabularyTab(r.kind==='colloc'?'collocations':'wordbook');return window.go('vocab');}
 }
 document.addEventListener('click',event=>{
  const t=event.target.closest?.('[data-hm-task],[data-hm-start],[data-hm-go],[data-hm-week],[data-hm-recent],[data-hm-article]');if(!t||t.disabled)return;
  if(t.hasAttribute('data-hm-task'))return startTask(current.tasks[Number(t.dataset.hmTask)]);
  if(t.hasAttribute('data-hm-start')){const state=H.primaryState(current.tasks);if(state.kind==='start')startTask(state.task);return;}
  if(t.hasAttribute('data-hm-go'))return window.go(t.dataset.hmGo);
  if(t.hasAttribute('data-hm-week')){weekOffset+=Number(t.dataset.hmWeek);return window.render();}
  if(t.hasAttribute('data-hm-recent'))return open('recent',Number(t.dataset.hmRecent));
  if(t.hasAttribute('data-hm-article'))return window.ArticleUI.open(t.dataset.hmArticle);
 });
 function updateAccountLabel(){
  const button=document.querySelector('.side-account');if(!button)return;
  button.innerHTML=`<span class="hm-account-icon" aria-hidden="true">${button.querySelector('svg')?.outerHTML||''}</span><span class="hm-account-name">${esc(displayName()||'アカウント')}</span>${chevron()}`;
 }
 window.home=function(){return render_home();};
 const previousGo=window.go;
 window.go=function(destination){if(destination==='home')weekOffset=0;return previousGo.apply(this,arguments);};
 const previousRender=window.render;
 window.render=function(){previousRender();updateAccountLabel();};
 window.HomeUI={displayName,recordCompletion,resetWeek:()=>{weekOffset=0;}};
 updateAccountLabel();
})();
