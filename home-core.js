(function(root){
 'use strict';
 // Pure calculations for the home screen. Everything is derived from the learner's own records; nothing here is a fixed number.
 // Dates are Japan Standard Time (UTC+9, no daylight saving), weeks start on Monday.
 const JST_OFFSET=9*3600*1000,DAY=86400000,SECONDS_PER_QUESTION=30,WEEKDAYS=['月','火','水','木','金','土','日'],WEEKDAY_NAMES=['日','月','火','水','木','金','土'];
 // The one place that chooses which number the "this week" block shows. Study time can replace answers once it is measured.
 const PROGRESS_METRIC='answers';
 const METRICS={answers:{label:'今週の回答数',unit:'問',daily:(counts)=>counts}};
 const KINDS=['vocab','colloc','article'];
 const shifted=ts=>new Date(ts+JST_OFFSET);
 const pad=n=>String(n).padStart(2,'0');
 const jstDate=ts=>shifted(ts).toISOString().slice(0,10);
 const jstHour=ts=>shifted(ts).getUTCHours();
 const parseDay=date=>Date.parse(date+'T00:00:00Z');
 const addDays=(date,days)=>new Date(parseDay(date)+days*DAY).toISOString().slice(0,10);
 // 0 = Monday ... 6 = Sunday
 const weekdayIndex=date=>(new Date(parseDay(date)).getUTCDay()+6)%7;
 const weekStart=date=>addDays(date,-weekdayIndex(date));
 const weekDates=(date,offsetWeeks=0)=>{const start=addDays(weekStart(date),offsetWeeks*7);return Array.from({length:7},(_,i)=>addDays(start,i));};
 const label=date=>`${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;
 const dayOfMonth=date=>Number(date.slice(8,10));
 function monthTitle(dates){const thursday=dates[3];return `${thursday.slice(0,4)}年${Number(thursday.slice(5,7))}月`;}
 function formatDate(ts){const date=jstDate(ts),index=new Date(parseDay(date)).getUTCDay();return `${Number(date.slice(5,7))}月${Number(date.slice(8,10))}日（${WEEKDAY_NAMES[index]}）`;}
 function greetingWord(ts){const h=jstHour(ts);return h>=4&&h<10?'おはようございます':h>=10&&h<18?'こんにちは':'こんばんは';}
 const minutesFor=count=>Math.max(1,Math.ceil(count*SECONDS_PER_QUESTION/60));
 const timeOf=value=>{const ts=Date.parse(value||'');return Number.isFinite(ts)?ts:null;};
 // Every learning event with a time: answers (vocabulary, collocation, article question) and article reads.
 function events(data){
  const list=[];
  for(const e of data.vocabLogs||[]){const ts=timeOf(e.answeredAt);if(ts!==null)list.push({ts,kind:'vocab',wordId:e.wordId,sessionId:e.sessionId,answer:true});}
  for(const e of data.collocLogs||[]){const ts=timeOf(e.answeredAt);if(ts!==null)list.push({ts,kind:'colloc',collocationId:e.collocationId,wordId:e.wordId,sessionId:e.sessionId,answer:true});}
  for(const e of data.articleAnswers||[]){const ts=timeOf(e.answeredAt);if(ts!==null)list.push({ts,kind:'article',articleId:e.articleId,sessionId:e.sessionId,answer:true});}
  for(const [articleId,read] of Object.entries(data.reads||{})){const ts=timeOf(read?.completedAt);if(ts!==null)list.push({ts,kind:'article',articleId,read:true});}
  return list;
 }
 const learningDays=data=>new Set(events(data).map(e=>jstDate(e.ts)));
 // Streak: consecutive learning days ending today, or ending yesterday when today has not been studied yet.
 function streak(days,today){
  let cursor=days.has(today)?today:addDays(today,-1),count=0;
  while(days.has(cursor)){count++;cursor=addDays(cursor,-1);}
  return count;
 }
 const lastDays=(days,today,length=7)=>Array.from({length},(_,i)=>{const date=addDays(today,i-(length-1));return {date,label:label(date),learned:days.has(date)};});
 function weekStats(data,today,metric=PROGRESS_METRIC){
  const dates=weekDates(today),all=events(data),inWeek=all.filter(e=>dates.includes(jstDate(e.ts)));
  const counts=dates.map(date=>all.filter(e=>e.answer&&jstDate(e.ts)===date).length);
  const series=(METRICS[metric]||METRICS.answers).daily(counts);
  return {dates,metric:METRICS[metric]?metric:'answers',series,total:series.reduce((a,b)=>a+b,0),
   words:new Set(inWeek.filter(e=>e.kind==='vocab'&&e.wordId).map(e=>e.wordId)).size,
   articles:new Set(inWeek.filter(e=>e.read).map(e=>e.articleId)).size,
   collocations:new Set(inWeek.filter(e=>e.kind==='colloc'&&e.collocationId).map(e=>e.collocationId)).size,
   todayIndex:dates.indexOf(today)};
 }
 // A kind counts as done today when a finished session was recorded on this device (completions),
 // when a synced session of that kind has at least 10 answers today, or (articles) when an article was read today.
 function doneToday(data,today){
  const done={vocab:false,colloc:false,article:false};
  for(const c of data.completions||[])if(c&&c.date===today&&KINDS.includes(c.kind))done[c.kind]=true;
  const bySession=new Map();
  for(const e of events(data)){
   if(jstDate(e.ts)!==today)continue;
   if(e.kind==='article'){if(e.read)done.article=true;continue;}
   const key=e.kind+'|'+e.sessionId;bySession.set(key,(bySession.get(key)||0)+1);
  }
  for(const [key,count] of bySession)if(count>=10)done[key.split('|')[0]]=true;
  return done;
 }
 // Next set to practise: the first set whose best score is not 10/10 (genre order, then set number).
 // When every set is cleared, the set with the lowest best score; ties go to the earlier set.
 function pickSet(genres,sets,bestOf){
  const ordered=[...genres].sort((a,b)=>a.order-b.order).flatMap(g=>sets.filter(s=>s.genre===g.id).sort((a,b)=>a.setNumber-b.setNumber));
  if(!ordered.length)return null;
  const best=s=>{const v=bestOf(s);return v===null||v===undefined?-1:v;};
  const open=ordered.find(s=>best(s)!==10);if(open)return open;
  return ordered.reduce((low,s)=>best(s)<best(low)?s:low,ordered[0]);
 }
 // ctx: wordReview, collocReview (counts), set ({id,title}|null), articles (newest first), readIds (Set), setTitle
 function tasks(ctx,done){
  const list=[];
  if(ctx.wordReview>0)list.push({kind:'vocab',action:'word-review',title:'今日の復習',sub:`${ctx.wordReview}語・約${minutesFor(ctx.wordReview)}分`});
  else if(ctx.set)list.push({kind:'vocab',action:'word-set',setId:ctx.set.id,title:ctx.set.title,sub:`10問・約${minutesFor(10)}分`});
  else list.push({kind:'vocab',action:'none',title:'単語',sub:'教材を読み込んでいます'});
  if(ctx.collocReview>0)list.push({kind:'colloc',action:'colloc-review',title:'組み合わせの復習',sub:`${ctx.collocReview}件・約${minutesFor(ctx.collocReview)}分`});
  else list.push({kind:'colloc',action:'colloc-quiz',title:'組み合わせクイズ',sub:`10問・約${minutesFor(10)}分`});
  const unread=(ctx.articles||[]).find(a=>!ctx.readIds.has(a.id)),article=unread||(ctx.articles||[])[0];
  if(article)list.push({kind:'article',action:'article',articleId:article.id,title:unread?'記事を読む':'記事を読み直す',sub:`${article.title}・約${article.readingMinutes||5}分`});
  else list.push({kind:'article',action:'none',title:'記事を読む',sub:'記事を読み込んでいます'});
  return list.map(t=>({...t,done:Boolean(done[t.kind])}));
 }
 // Footer of the today card: which button (if any) to show.
 function primaryState(list){
  const open=list.find(t=>!t.done&&t.action!=='none');
  if(!open)return {kind:'complete'};
  return {kind:'start',task:open,label:list.some(t=>t.done)?'次のタスクをはじめる':'最初のタスクをはじめる'};
 }
 const agoText=(ts,now)=>{const minutes=Math.max(0,Math.floor((now-ts)/60000));if(minutes<1)return 'たった今';if(minutes<60)return `${minutes}分前`;const hours=Math.floor(minutes/60);if(hours<24)return `${hours}時間前`;const d=jstDate(ts);return `${Number(d.slice(5,7))}月${Number(d.slice(8,10))}日`;};
 const KIND_LABELS={vocab:'単語',colloc:'組み合わせ',article:'記事'};
 // Recent learning: one entry per word/collocation session and per article, newest first.
 // resolve: {setTitleOf(wordIds)->string|null, articleTitle(id)->string|null}
 function recent(data,now,resolve,limit=3){
  const groups=new Map();
  for(const e of events(data)){
   const key=e.kind==='article'?'article|'+e.articleId:e.kind+'|'+e.sessionId;
   const g=groups.get(key)||{kind:e.kind,ts:0,wordIds:new Set(),articleId:e.articleId};
   g.ts=Math.max(g.ts,e.ts);if(e.wordId)g.wordIds.add(e.wordId);groups.set(key,g);
  }
  const out=[];
  for(const g of [...groups.values()].sort((a,b)=>b.ts-a.ts)){
   let title=null;
   if(g.kind==='article')title=resolve.articleTitle(g.articleId);
   else if(g.kind==='colloc')title='組み合わせのクイズ';
   else title=resolve.setTitleOf([...g.wordIds])||'単語の復習';
   if(!title)continue;
   out.push({kind:g.kind,ts:g.ts,articleId:g.articleId,title,sub:`${KIND_LABELS[g.kind]}・${agoText(g.ts,now)}`});
   if(out.length>=limit)break;
  }
  return out;
 }
 const MAX_COMPLETIONS=200;
 function addCompletion(list,kind,sessionId,ts){
  if(!KINDS.includes(kind))return list;
  const date=jstDate(ts);if(list.some(c=>c.kind===kind&&c.sessionId===sessionId))return list;
  return [...list,{date,kind,sessionId,at:new Date(ts).toISOString()}].slice(-MAX_COMPLETIONS);
 }
 const api={JST_OFFSET,SECONDS_PER_QUESTION,WEEKDAYS,PROGRESS_METRIC,METRICS,KINDS,jstDate,jstHour,addDays,weekdayIndex,weekStart,weekDates,label,dayOfMonth,monthTitle,formatDate,greetingWord,minutesFor,events,learningDays,streak,lastDays,weekStats,doneToday,pickSet,tasks,primaryState,agoText,recent,addCompletion,KIND_LABELS};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HomeCore=api;
})(typeof window!=='undefined'?window:globalThis);
