let recordPeriod='week';
const recordToday=new Date(2026,9,3);
const recordStart=new Date(2026,7,1);
const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const shiftDay=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const learningHistory={};
for(let d=new Date(recordStart);d<=recordToday;d=shiftDay(d,1)){
  learningHistory[dayKey(d)]=d.getMonth()===7?(d.getDate()%3===1?18:0):(d.getDate()%5===1?15:d.getDate()%5===3?12:0);
}
['2026-09-27','2026-10-04'].forEach(k=>learningHistory[k]=0);
['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03'].forEach((k,i)=>learningHistory[k]=[12,18,15,20,10,15][i]);
function recordedMinutes(d){return (learningHistory[dayKey(d)]||0)+(dayKey(d)===dayKey(recordToday)?manualMinutes:0)}
function sumTime(start,end){let total=0;for(let d=new Date(start);d<=end;d=shiftDay(d,1))total+=recordedMinutes(d);return total}
function timeText(n){return n>=60?`${Math.floor(n/60)}時間${n%60?` ${n%60}分`:''}`:`${n}分`}
function shortDate(d){return `${d.getMonth()+1}/${d.getDate()}`}
function recordSummary(period){
  const weekStart=shiftDay(recordToday,-((recordToday.getDay()+6)%7)),monthStart=new Date(2026,9,1),lastStart=new Date(2026,8,1),lastEnd=new Date(2026,9,0);
  if(period==='week')return {label:'今週の学習時間',start:weekStart,end:recordToday,compareStart:shiftDay(weekStart,-7),compareEnd:shiftDay(recordToday,-7),compareLabel:'先週の同期間比'};
  if(period==='month')return {label:'今月の学習時間',start:monthStart,end:recordToday,compareStart:lastStart,compareEnd:new Date(2026,8,3),compareLabel:'先月の同期間比'};
  if(period==='last')return {label:'先月の学習時間',start:lastStart,end:lastEnd,compareStart:recordStart,compareEnd:new Date(2026,8,0),compareLabel:'前月比'};
  return {label:'累計の学習時間',start:recordStart,end:recordToday};
}
function calendarForPeriod(summary){
  let start,end,title;
  if(recordPeriod==='month'||recordPeriod==='last'){
    start=new Date(summary.start.getFullYear(),summary.start.getMonth(),1);end=new Date(start.getFullYear(),start.getMonth()+1,0);title=`${start.getMonth()+1}月のカレンダー`;
  }else if(recordPeriod==='week'){start=summary.start;end=shiftDay(start,6);title='今週のカレンダー'}
  else{start=shiftDay(recordToday,-27);end=recordToday;title='最近4週間のカレンダー'}
  const blanks=Array.from({length:start.getDay()},()=>'<span aria-hidden="true"></span>').join('');
  let cells='';for(let d=new Date(start);d<=end;d=shiftDay(d,1)){
    const minutes=recordedMinutes(d),level=minutes>=20?3:minutes>=15?2:minutes?1:0,future=d>recordToday;
    cells+=`<div class="calday ${level?'level'+level:''} ${dayKey(d)===dayKey(recordToday)?'current':''} ${future?'future':''}" title="${shortDate(d)}・${future?'これから':minutes+'分'}" aria-label="${d.getMonth()+1}月${d.getDate()}日 ${future?'これから':minutes+'分'}">${d.getDate()}</div>`;
  }
  return `<section class="section"><div class="sectionhead"><h2>${title}</h2><span class="muted recordrange">${shortDate(start)} — ${shortDate(end)}</span></div><div class="calendar">${['日','月','火','水','木','金','土'].map(d=>`<div class="label">${d}</div>`).join('')}${blanks}${cells}</div><p class="muted calendarlegend">色の濃さは学習時間</p></section>`;
}
function records(){
  const summary=recordSummary(recordPeriod),total=sumTime(summary.start,summary.end),previous=summary.compareStart?sumTime(summary.compareStart,summary.compareEnd):null;
  const delta=previous===null?null:total-previous;
  const thisMonth=sumTime(new Date(2026,9,1),recordToday),lastSame=sumTime(new Date(2026,8,1),new Date(2026,8,3)),lastFull=sumTime(new Date(2026,8,1),new Date(2026,9,0)),scale=Math.max(thisMonth,lastSame,1);
  return `<div class="eyebrow">YOUR PROGRESS</div><h1>学びの積み重ね</h1><p class="muted">続けた時間を、振り返ろう。</p><section class="section timeoverview"><div class="sectionhead"><h2>学習時間</h2><button class="textbtn" onclick="manualTime()">＋ 時間を追加</button></div><div class="tabs recordtabs" aria-label="学習時間の表示期間">${[['week','今週'],['month','今月'],['last','先月'],['all','累計']].map(([v,label])=>`<button class="${recordPeriod===v?'active':''}" onclick="recordPeriod='${v}';render()" aria-pressed="${recordPeriod===v}">${label}</button>`).join('')}</div><div class="timehero" aria-live="polite"><div class="eyebrow">${summary.label}</div><strong>${timeText(total)}</strong><div class="muted recordrange">${shortDate(summary.start)} — ${shortDate(summary.end)}</div>${previous!==null?`<div class="timechange">${summary.compareLabel} <b>${delta===0?'±0分':(delta>0?'+':'−')+timeText(Math.abs(delta))}</b><span>（${shortDate(summary.compareStart)} — ${shortDate(summary.compareEnd)}）</span></div>`:`<div class="timechange">学習開始から <b>64日間</b></div>`}</div></section><section class="section monthcomparison"><div class="sectionhead"><h2>先月と比べる</h2><span class="muted recordrange">月初の3日間</span></div><div class="comparisonrow"><div><b>今月</b><small>10/1 — 10/3</small></div><div class="comparisontrack"><i style="width:${thisMonth/scale*100}%"></i></div><strong>${timeText(thisMonth)}</strong></div><div class="comparisonrow previous"><div><b>先月</b><small>9/1 — 9/3</small></div><div class="comparisontrack"><i style="width:${lastSame/scale*100}%"></i></div><strong>${timeText(lastSame)}</strong></div><p class="comparisonnote">同じ日数で ${thisMonth===lastSame?'変わらず':thisMonth>lastSame?timeText(thisMonth-lastSame)+'増えています':timeText(lastSame-thisMonth)+'少なくなっています'}<span>先月全体は ${timeText(lastFull)}</span></p></section><div class="streaksummary"><span class="streaknumber">6</span><div><h3>日連続で学習中</h3><p>1週間まで、あと1日。</p></div><span class="streakstar" aria-hidden="true">✦</span></div>${calendarForPeriod(summary)}`;
}
