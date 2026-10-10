(function(root){
 'use strict';
 // Study-time aggregation (stage 15). Pure functions: no DOM, no storage, no clock.
 // Dates are Japan time (UTC+9). Weeks start on Monday.
 const JST_OFFSET_MS=9*3600000,DAY_MS=86400000;
 const KINDS=['vocab','colloc','article','listening','manual'];
 const emptyKinds=()=>({vocab:0,colloc:0,article:0,listening:0,manual:0});
 // 'YYYY-MM-DD' of an instant, in Japan time.
 const dayOf=ms=>new Date(ms+JST_OFFSET_MS).toISOString().slice(0,10);
 const dayStart=day=>Date.parse(day+'T00:00:00+09:00');
 const addDays=(day,n)=>dayOf(dayStart(day)+n*DAY_MS+12*3600000);
 // Monday of the week that contains the day.
 function weekStart(day){const dow=new Date(day+'T00:00:00Z').getUTCDay();return addDays(day,-((dow+6)%7));}
 // Splits [start,end) at Japan-time midnights.
 function splitByDay(start,end){
  const parts=[];let cursor=start;
  while(cursor<end){const day=dayOf(cursor),next=Math.min(end,dayStart(day)+DAY_MS);parts.push({day,start:cursor,end:next});cursor=next;}
  return parts;
 }
 // Sum per day and per kind, without double counting.
 // - Automatic segments of every device are laid on one time line per day. Where several overlap, the time goes once,
 //   to the segment that started last (ties: the larger id), so the sum of the kinds always equals the total.
 // - Manual records have no clock time: their minutes are added to the day they belong to.
 // - Deleted records (deletedAt) are ignored.
 function aggregate(segments){
  const days={},perDay={};
  const bucket=day=>days[day]||(days[day]={total:0,kinds:emptyKinds()});
  const add=(day,kind,ms)=>{if(ms<=0)return;const b=bucket(day);b.kinds[kind]+=ms;b.total+=ms;};
  for(const s of segments||[]){
   if(!s||s.deletedAt)continue;
   if(s.method==='manual'){if(/^\d{4}-\d{2}-\d{2}$/.test(s.studyDate||'')&&Number.isFinite(s.countedMs))add(s.studyDate,'manual',s.countedMs);continue;}
   if(!KINDS.includes(s.kind)||s.kind==='manual')continue;
   const start=Date.parse(s.startedAt),end=Date.parse(s.endedAt);
   if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
   for(const part of splitByDay(start,end))(perDay[part.day]||(perDay[part.day]=[])).push({kind:s.kind,start:part.start,end:part.end,order:start,id:String(s.id||'')});
  }
  for(const [day,list] of Object.entries(perDay)){
   const marks=[...new Set(list.flatMap(x=>[x.start,x.end]))].sort((a,b)=>a-b);
   for(let i=0;i+1<marks.length;i++){
    const a=marks[i],b=marks[i+1];let owner=null;
    for(const x of list){if(x.start<=a&&x.end>=b&&(!owner||x.order>owner.order||x.order===owner.order&&x.id>owner.id))owner=x;}
    if(owner)add(day,owner.kind,b-a);
   }
  }
  return {days,total:Object.values(days).reduce((sum,d)=>sum+d.total,0)};
 }
 // Total and per-kind sum of the days from..to (inclusive).
 function sumRange(agg,from,to){
  const kinds=emptyKinds();let total=0;
  for(const [day,value] of Object.entries(agg.days)){if(day<from||day>to)continue;total+=value.total;for(const k of KINDS)kinds[k]+=value.kinds[k];}
  return {total,kinds};
 }
 // ---- Figures for the records screen and the home screen ----
 const MILESTONE_HOURS=[10,30,50,100,200,300,500,1000];
 // The next milestone above the total, and how far the way from the last one has come (1 once all are passed).
 function milestone(totalMs){
  const hours=totalMs/3600000,next=MILESTONE_HOURS.find(m=>m>hours)||null,previous=[...MILESTONE_HOURS].reverse().find(m=>m<=hours)||0;
  return {next,previous,remainingMs:next?next*3600000-totalMs:0,progress:next?(totalMs-previous*3600000)/((next-previous)*3600000):1};
 }
 // Five shades for days with study time: 1-9, 10-19, 20-39, 40-59, 60+ minutes. 0 is its own (grey) value.
 function heatLevel(ms){const m=ms/60000;return m<=0?0:m<10?1:m<20?2:m<40?3:m<60?4:5;}
 const weekDays=today=>Array.from({length:7},(_,i)=>addDays(weekStart(today),i));
 const dayValue=(agg,day)=>({total:agg.days[day]?.total||0,kinds:{...emptyKinds(),...(agg.days[day]?.kinds||{})}});
 // Monday..Sunday of the week that contains today. Days after today are marked future.
 const weekSeries=(agg,today)=>weekDays(today).map(day=>({day,...dayValue(agg,day),future:day>today}));
 // This week up to today against last week up to the same weekday.
 function compareWeek(agg,today){
  const start=weekStart(today),index=(new Date(today+'T00:00:00Z').getUTCDay()+6)%7,lastStart=addDays(start,-7);
  const current=sumRange(agg,start,today).total,previous=sumRange(agg,lastStart,addDays(lastStart,index)).total;
  return {current,previous,delta:current-previous};
 }
 // Columns of weeks (Monday first) ending with the current week, for the calendar heat map.
 function heatmap(agg,today,weeks){
  const first=addDays(weekStart(today),-7*(weeks-1));
  return Array.from({length:weeks},(_,w)=>Array.from({length:7},(_,d)=>{const day=addDays(first,w*7+d),ms=dayValue(agg,day).total;return {day,ms,level:heatLevel(ms),future:day>today};}));
 }
 // Time per kind with percentages that add up to exactly 100 (largest remainder).
 function breakdown(agg,period,today){
  const from=period==='week'?weekStart(today):period==='month'?today.slice(0,8)+'01':'0000-01-01';
  const {total,kinds}=sumRange(agg,from,today);
  const items=KINDS.map(kind=>({kind,ms:kinds[kind]})).filter(x=>x.ms>0);
  const raw=items.map(x=>total?x.ms/total*100:0),floor=raw.map(Math.floor);let left=total?100-floor.reduce((a,b)=>a+b,0):0;
  raw.map((value,i)=>[value-floor[i],i]).sort((a,b)=>b[0]-a[0]||a[1]-b[1]).forEach(([,i])=>{if(left>0){floor[i]++;left--;}});
  return {total,items:items.map((x,i)=>({...x,percent:floor[i]}))};
 }
 // What was done on each day, from the answer records and article reads: answers, correct answers and distinct words/items/articles.
 // data: {vocabLogs, collocLogs, articleAnswers, reads}. A skipped or timed-out answer counts as an answer, not as correct.
 function activityByDay(data){
  const days={};
  const slot=(day,kind)=>{const d=days[day]||(days[day]={vocab:{answers:0,correct:0,ids:new Set()},colloc:{answers:0,correct:0,ids:new Set()},article:{answers:0,correct:0,ids:new Set()}});return d[kind];};
  const time=value=>{const ts=Date.parse(value||'');return Number.isFinite(ts)?ts:null;};
  const answer=(list,kind,idOf)=>{for(const e of list||[]){const ts=time(e.answeredAt);if(ts===null)continue;const s=slot(dayOf(ts),kind);s.answers++;if(e.correct===true&&!e.skipped)s.correct++;const id=idOf(e);if(id)s.ids.add(id);}};
  answer(data.vocabLogs,'vocab',e=>e.wordId);
  answer(data.collocLogs,'colloc',e=>e.collocationId);
  answer(data.articleAnswers,'article',()=>null);
  for(const [articleId,read] of Object.entries(data.reads||{})){const ts=time(read?.completedAt);if(ts!==null)slot(dayOf(ts),'article').ids.add(articleId);}
  const out={};
  for(const [day,d] of Object.entries(days))out[day]={vocab:{answers:d.vocab.answers,correct:d.vocab.correct,words:d.vocab.ids.size},colloc:{answers:d.colloc.answers,correct:d.colloc.correct,items:d.colloc.ids.size},article:{answers:d.article.answers,correct:d.article.correct,read:d.article.ids.size}};
  return out;
 }
 const api={activityByDay,KINDS,MILESTONE_HOURS,milestone,heatLevel,weekDays,weekSeries,compareWeek,heatmap,breakdown,DAY_MS,dayOf,dayStart,addDays,weekStart,splitByDay,aggregate,sumRange};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudyStats=api;
})(typeof window!=='undefined'?window:globalThis);
