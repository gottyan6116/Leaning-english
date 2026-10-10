// Records screen (stage 15). Every number comes from the measured study segments of this account
// (all devices, overlapping time counted once). Nothing here is a fixed or sample value.
(function(){
 'use strict';
 const KEY='english-notes.study.segments.v1';
 const MANUAL_TYPES={conversation:'英会話',reading:'読書',media:'動画・ポッドキャスト',other:'その他'};
 const KIND_LABEL={vocab:'単語',colloc:'組み合わせ',article:'記事',listening:'リスニング',manual:'アプリ外'};
 const HOUR=3600000,MIN=60000,DAY_CAP=24*HOUR;
 let period='week';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const store=()=>window.AppStorage||window.localStorage;
 const S=()=>window.StudyStats;
 function segments(){try{const list=JSON.parse(store().getItem(KEY)||'[]');return Array.isArray(list)?list:[];}catch(error){return [];}}
 function writeSegments(list){store().setItem(KEY,JSON.stringify(list));}
 const todayKey=()=>S().dayOf(Date.now());
 const readJson=(key,fallback)=>{try{const raw=store().getItem(key);return raw===null?fallback:JSON.parse(raw);}catch(error){return fallback;}};
 // The answer records and article reads that sit next to the measured time (counts per day).
 function activityData(){
  let colloc=[];try{colloc=window.CollocationUI?.getStore?.()?.logs||[];}catch(error){colloc=readJson('english-notes.collocation.answers.v1',[]);}
  const list=value=>Array.isArray(value)?value:[];
  return {vocabLogs:list(readJson('english-notes.quiz.answers.v1',[])),collocLogs:list(colloc),articleAnswers:Object.values(readJson('english-notes.article.answers.v1',{})||{}),reads:readJson('english-notes.article.read.v1',{})||{}};
 }
 let shown={agg:null,activity:{},today:''};
 const WEEKDAY=['日','月','火','水','木','金','土'];
 const dateLabel=day=>{const d=new Date(day+'T00:00:00Z');return `${d.getUTCMonth()+1}月${d.getUTCDate()}日（${WEEKDAY[d.getUTCDay()]}）`;};
 // 75 minutes -> "1時間 15分", 45 minutes -> "45分", under a minute -> "1分未満".
 function durationText(ms){
  const minutes=Math.floor(ms/MIN);
  if(ms<=0)return '0分';if(minutes<1)return '1分未満';
  return minutes>=60?`${Math.floor(minutes/60)}時間${minutes%60?` ${minutes%60}分`:''}`:`${minutes}分`;
 }
 const signedMinutes=ms=>`${ms>0?'+':'−'}${durationText(Math.abs(ms))}`;
 function remainingText(ms){return ms>=HOUR?`${Math.ceil(ms/HOUR)}時間`:`${Math.max(1,Math.ceil(ms/MIN))}分`;}
 function heroHtml(agg){
  const m=S().milestone(agg.total);
  return `<section class="rc-card rc-hero" aria-labelledby="rc-total-title"><h2 id="rc-total-title" class="rc-label">累計の学習時間</h2><strong class="rc-total">${esc(durationText(agg.total))}</strong>
  ${m.next?`<p class="rc-next">${m.next}時間まであと${esc(remainingText(m.remainingMs))}</p>`:'<p class="rc-next">1000時間を超えました</p>'}
  <div class="rc-progress" role="progressbar" aria-label="次の節目までの進み具合" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(m.progress*100)}"><i style="width:${Math.max(1,Math.round(m.progress*100))}%"></i></div></section>`;
 }
 function heatmapHtml(agg,today){
  const weeks=window.matchMedia&&window.matchMedia('(min-width:768px)').matches?17:12,columns=S().heatmap(agg,today,weeks);
  const cells=columns.map(col=>`<div class="rc-week">${col.map(c=>c.future?'<span class="rc-cell rc-future" aria-hidden="true"></span>':`<button type="button" class="rc-cell rc-heat-${c.level}" onclick="recordsPick('${c.day}')" onmouseenter="recordsPick('${c.day}')" aria-label="${esc(dateLabel(c.day))} ${esc(durationText(c.ms))}"></button>`).join('')}</div>`).join('');
  return `<section class="rc-card" aria-labelledby="rc-heat-title"><h2 id="rc-heat-title" class="rc-title">学習カレンダー</h2>
  <div class="rc-heat" role="group" aria-label="日ごとの学習時間（色が濃いほど長い）"><div class="rc-weekdays" aria-hidden="true"><span>月</span><span></span><span>水</span><span></span><span>金</span><span></span><span>日</span></div><div class="rc-weeks">${cells}</div></div>
  <div class="rc-detail" id="rc-detail" role="status">${detailHtml(today)}</div>
  <div class="rc-legend" aria-hidden="true"><span>少ない</span>${[0,1,2,3,4,5].map(n=>`<i class="rc-cell rc-heat-${n}"></i>`).join('')}<span>多い</span></div></section>`;
 }
 function weekHtml(agg,today){
  const series=S().weekSeries(agg,today),max=Math.max(1,...series.map(d=>d.total)),total=series.reduce((s,d)=>s+d.total,0),cmp=S().compareWeek(agg,today);
  const kinds=['vocab','colloc','article','listening','manual'];
  const bars=series.map((d,i)=>{
   const name=WEEKDAY[(i+1)%7],stack=kinds.filter(k=>d.kinds[k]>0).map(k=>`<span class="rc-seg rc-k-${k}" style="height:${(d.kinds[k]/max*100).toFixed(2)}%"></span>`).join('');
   return `<div class="rc-col${d.day===today?' rc-today':''}" role="img" aria-label="${name}曜 ${esc(durationText(d.total))}"><span class="rc-stack">${stack}</span><span class="rc-colname">${name}</span></div>`;
  }).join('');
  const present=kinds.filter(k=>series.some(d=>d.kinds[k]>0)||['vocab','colloc','article'].includes(k));
  const compare=cmp.current===0&&cmp.previous===0?'':`<p class="rc-compare">先週の同じ期間より ${cmp.delta>0?`<b>${esc(signedMinutes(cmp.delta))}</b>`:cmp.delta<0?`<b>${esc(durationText(-cmp.delta))}少なめ</b>`:'<b>同じ</b>'}</p>`;
  return `<section class="rc-card" aria-labelledby="rc-week-title"><h2 id="rc-week-title" class="rc-title">今週の学習時間</h2><strong class="rc-weektotal">${esc(durationText(total))}</strong>
  <div class="rc-bars">${bars}</div><ul class="rc-keys">${present.map(k=>`<li><i class="rc-dot rc-k-${k}"></i>${KIND_LABEL[k]}</li>`).join('')}${series.some(d=>d.kinds.manual>0)?'':'<li><i class="rc-dot rc-k-manual"></i>アプリ外</li>'}</ul>${compare}</section>`;
 }
 function breakdownHtml(agg,today){
  const b=S().breakdown(agg,period,today);
  const tabs=[['week','今週'],['month','今月'],['all','累計']].map(([v,l])=>`<button type="button" class="${period===v?'active':''}" onclick="recordsPeriod('${v}')" aria-pressed="${period===v}">${l}</button>`).join('');
  return `<section class="rc-card" aria-labelledby="rc-break-title"><h2 id="rc-break-title" class="rc-title">種類別の内訳</h2><div class="tabs rc-tabs" aria-label="表示する期間">${tabs}</div>
  ${b.total?`<ul class="rc-break">${b.items.map(x=>`<li><span class="rc-break-name"><i class="rc-dot rc-k-${x.kind}"></i>${KIND_LABEL[x.kind]}</span><span class="rc-break-time">${esc(durationText(x.ms))}</span><span class="rc-break-pct">${x.percent}%</span><span class="rc-break-bar"><i class="rc-k-${x.kind}" style="width:${x.percent}%"></i></span></li>`).join('')}</ul>`:'<p class="rc-quiet">この期間の記録はまだありません</p>'}</section>`;
 }
 function manualHtml(list){
  const rows=list.filter(s=>s.method==='manual'&&!s.deletedAt).sort((a,b)=>String(b.studyDate).localeCompare(String(a.studyDate))||String(b.updatedAt).localeCompare(String(a.updatedAt)));
  if(!rows.length)return '';
  return `<section class="rc-card" aria-labelledby="rc-manual-title"><h2 id="rc-manual-title" class="rc-title">アプリ外の学習</h2><ul class="rc-manual">${rows.map(s=>`<li><span class="rc-manual-main"><strong>${esc(dateLabel(s.studyDate))}　${esc(MANUAL_TYPES[s.targetId]||'その他')}</strong><span>${esc(durationText(s.countedMs))}</span>${s.note?`<small>${esc(s.note)}</small>`:''}</span><span class="rc-manual-actions"><button type="button" class="textbtn" onclick="openStudyForm('${esc(s.id)}')">編集</button><button type="button" class="textbtn" onclick="deleteStudyRecord('${esc(s.id)}')">削除</button></span></li>`).join('')}</ul></section>`;
 }
 function records(){
  const list=segments(),agg=S().aggregate(list),today=todayKey();
  shown={agg,activity:S().activityByDay(activityData()),today};
  const head=`<div class="rc-head"><h1>学びの積み重ね</h1><button type="button" class="textbtn" onclick="openStudyForm()">＋ 学習時間を追加</button></div>`;
  if(!agg.total)return `<div class="rc">${head}<section class="rc-empty"><p>学習すると、ここに記録が積み上がります</p><button type="button" class="textbtn" onclick="go('home')">ホームへ</button></section></div>`;
  return `<div class="rc">${head}${heroHtml(agg)}${heatmapHtml(agg,today)}${weekHtml(agg,today)}${breakdownHtml(agg,today)}${manualHtml(list)}</div>`;
 }
 // ---- manual records ("＋ 学習時間を追加") ----
 function closeForm(){document.getElementById('rc-form')?.remove();document.body.classList.remove('rc-form-open');}
 function dayTotal(list,day,exceptId){return S().aggregate(list.filter(s=>s.id!==exceptId)).days[day]?.total||0;}
 function openStudyForm(id){
  closeForm();
  const list=segments(),editing=id?list.find(s=>s.id===id&&s.method==='manual'&&!s.deletedAt):null,today=todayKey();
  const min=S().addDays(today,-90),minutes=editing?Math.round(editing.countedMs/MIN):60;
  const overlay=document.createElement('div');overlay.id='rc-form';overlay.className='rc-overlay';
  overlay.innerHTML=`<form class="rc-sheet" role="dialog" aria-modal="true" aria-labelledby="rc-form-title" novalidate>
   <h2 id="rc-form-title">${editing?'学習時間を編集':'学習時間を追加'}</h2>
   <label>日付<input type="date" name="date" min="${min}" max="${today}" value="${editing?esc(editing.studyDate):today}" required></label>
   <div class="rc-row"><label>時間<select name="hours">${Array.from({length:7},(_,h)=>`<option value="${h}"${Math.floor(minutes/60)===h?' selected':''}>${h}時間</option>`).join('')}</select></label>
   <label>分<select name="minutes">${Array.from({length:60},(_,m)=>`<option value="${m}"${minutes%60===m?' selected':''}>${m}分</option>`).join('')}</select></label></div>
   <label>種類<select name="type">${Object.entries(MANUAL_TYPES).map(([v,l])=>`<option value="${v}"${editing?.targetId===v?' selected':''}>${l}</option>`).join('')}</select></label>
   <label>メモ（任意・100文字まで）<input type="text" name="note" maxlength="100" value="${editing?esc(editing.note||''):''}"></label>
   <p class="rc-error" role="alert" hidden></p>
   <div class="rc-actions"><button type="button" class="textbtn" data-cancel>キャンセル</button><button type="submit" class="primary">保存</button></div></form>`;
  document.body.append(overlay);document.body.classList.add('rc-form-open');
  const form=overlay.querySelector('form'),error=form.querySelector('.rc-error');
  const fail=text=>{error.textContent=text;error.hidden=false;};
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeForm();});
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape')closeForm();});
  form.querySelector('[data-cancel]').addEventListener('click',closeForm);
  form.addEventListener('submit',event=>{
   event.preventDefault();error.hidden=true;
   const date=form.date.value,hours=Number(form.hours.value),mins=Number(form.minutes.value),ms=(hours*60+mins)*MIN,note=form.note.value.trim();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today)return fail('未来の日付は選べません。');
   if(date<min)return fail('記録できるのは過去90日までです。');
   if(ms<MIN||ms>6*HOUR)return fail('時間は1分から6時間の間で入力してください。');
   if(Array.from(note).length>100)return fail('メモは100文字までです。');
   const current=segments();
   if(dayTotal(current,date,editing?.id)+ms>DAY_CAP)return fail('その日の学習時間が24時間を超えるため、保存できません。');
   const row={id:editing?.id||crypto.randomUUID(),kind:'manual',targetId:form.type.value,method:'manual',startedAt:null,endedAt:null,studyDate:date,countedMs:ms,deviceId:window.StudyTimer?.deviceId||'device-unknown',note:note||null,updatedAt:new Date().toISOString(),deletedAt:null};
   try{writeSegments(editing?current.map(s=>s.id===row.id?row:s):[...current,row]);}catch(problem){return fail('保存できませんでした。もう一度お試しください。');}
   closeForm();render();toast(editing?'更新しました':'追加しました');
  });
  form.date.focus();
 }
 function deleteStudyRecord(id){
  if(!window.confirm('この記録を削除しますか？'))return;
  try{const now=new Date().toISOString();writeSegments(segments().map(s=>s.id===id&&s.method==='manual'?{...s,deletedAt:now,updatedAt:now}:s));render();toast('削除しました');}catch(error){toast('削除できませんでした。もう一度お試しください');}
 }
 // One day in detail: time per kind, and what was done (answers, correct answers, words / items / articles).
 function detailHtml(day){
  const value=shown.agg?.days[day],kinds=value?.kinds||{},act=shown.activity[day]||{};
  const pct=(correct,answers)=>answers?`（正解率 ${Math.round(correct/answers*100)}%）`:'';
  const rows=[];
  const v=act.vocab,c=act.colloc,a=act.article;
  if(kinds.vocab>0||v?.answers)rows.push(['単語',kinds.vocab,v?.answers?`回答 ${v.answers}問・正解 ${v.correct}問${pct(v.correct,v.answers)}・${v.words}語`:'']);
  if(kinds.colloc>0||c?.answers)rows.push(['組み合わせ',kinds.colloc,c?.answers?`回答 ${c.answers}問・正解 ${c.correct}問${pct(c.correct,c.answers)}・${c.items}件`:'']);
  if(kinds.article>0||a?.read||a?.answers)rows.push(['記事',kinds.article,[a?.read?`${a.read}本読了`:'',a?.answers?`理解問題 ${a.answers}問・正解 ${a.correct}問${pct(a.correct,a.answers)}`:''].filter(Boolean).join('・')]);
  if(kinds.listening>0)rows.push(['リスニング',kinds.listening,'']);
  if(kinds.manual>0)rows.push(['アプリ外',kinds.manual,'']);
  const head=`<strong class="rc-detail-day">${esc(dateLabel(day))}${value?.total?`　合計 ${esc(durationText(value.total))}`:''}</strong>`;
  if(!rows.length)return head+'<p class="rc-quiet">学習の記録なし</p>';
  return head+`<ul class="rc-detail-list">${rows.map(([name,ms,text])=>`<li><span class="rc-detail-name">${name}</span>${ms>0?`<span class="rc-detail-time">${esc(durationText(ms))}</span>`:''}${text?`<span class="rc-detail-text">${esc(text)}</span>`:''}</li>`).join('')}</ul>`;
 }
 function recordsPick(day){const box=document.getElementById('rc-detail');if(box)box.innerHTML=detailHtml(day);}
 function recordsPeriod(value){period=value;render();}
 Object.assign(window,{records,openStudyForm,deleteStudyRecord,recordsPick,recordsPeriod});
 // The heat map shows 17 weeks on a wide screen and 12 on a narrow one.
 if(window.matchMedia){window.matchMedia('(min-width:768px)').addEventListener?.('change',()=>{if(typeof view!=='undefined'&&view==='records'&&!document.body.classList.contains('quiz-active'))render();});}
})();
