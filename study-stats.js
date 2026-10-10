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
 const api={KINDS,DAY_MS,dayOf,dayStart,addDays,weekStart,splitByDay,aggregate,sumRange};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudyStats=api;
})(typeof window!=='undefined'?window:globalThis);
