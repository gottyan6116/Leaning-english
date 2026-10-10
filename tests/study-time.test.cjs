const test=require('node:test'),assert=require('node:assert/strict');
const {createRecorder,CONFIG}=require('../study-time.js');
const S=require('../study-stats.js');
const T0=Date.parse('2026-10-10T09:00:00+09:00'),SEC=1000,MIN=60000;
function rig(){
 const r={t:T0,rows:[],timers:new Map(),next:1};
 const env={now:()=>r.t,uuid:()=>`id-${r.rows.length}-${r.t}`,deviceId:'dev-a',load:()=>r.rows.slice(),save:list=>{r.rows=list;},
  setTimer:(fn,ms)=>{const id=r.next++;r.timers.set(id,{fn,at:r.t+ms});return id;},clearTimer:id=>r.timers.delete(id)};
 r.rec=createRecorder(env);
 // Moves the clock; timers that fall due fire in order at their own time (as in a browser).
 r.advance=ms=>{const target=r.t+ms;for(;;){const due=[...r.timers.entries()].filter(([,x])=>x.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;r.timers.delete(due[0]);r.t=Math.max(r.t,due[1].at);due[1].fn();}r.t=target;};
 return r;
}
const iso=ms=>new Date(ms).toISOString();

test('idle stop: the segment ends at the last activity, and the idle wait is not counted',()=>{
 const r=rig();r.rec.begin('vocab','set-1');
 r.advance(20*SEC);r.rec.activity();r.advance(30*SEC);r.rec.activity(); // last activity at +50s
 r.advance(5*MIN);                                                      // idle limit (60s) passes; the timer fires
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].endedAt,iso(T0+50*SEC));assert.equal(r.rows[0].countedMs,50*SEC);
 assert.equal(r.rows[0].kind,'vocab');assert.equal(r.rows[0].targetId,'set-1');assert.equal(r.rows[0].method,'auto');assert.equal(r.rows[0].deviceId,'dev-a');
});
test('the article limit is three minutes, the quiz limit is one minute',()=>{
 assert.equal(CONFIG.idleMs.article,180000);assert.equal(CONFIG.idleMs.vocab,60000);assert.equal(CONFIG.idleMs.colloc,60000);
 const r=rig();r.rec.begin('article','a1');r.advance(2*MIN+50*SEC);assert.equal(r.rows.length,0,'still running before 3 minutes');
 r.advance(20*SEC);assert.equal(r.rows.length,0,'no activity at all: the segment ended at its start and is below five seconds');
 const q=rig();q.rec.begin('article','a1');q.advance(30*SEC);q.rec.activity();q.advance(10*MIN);assert.equal(q.rows[0].countedMs,30*SEC);
});
test('activity after a stop starts a new segment instead of extending the old one',()=>{
 const r=rig();r.rec.begin('colloc',null);r.advance(10*SEC);r.rec.activity();r.advance(2*MIN);
 assert.equal(r.rows.length,1);const first=r.rows[0];
 r.advance(MIN);r.rec.activity();r.advance(20*SEC);r.rec.activity();r.advance(5*MIN);
 assert.equal(r.rows.length,2);assert.notEqual(r.rows[1].id,first.id);assert.ok(Date.parse(r.rows[1].startedAt)>Date.parse(first.endedAt));
 assert.equal(r.rows[1].countedMs,20*SEC);
});
test('hiding the page closes the segment at that moment and nothing counts while hidden',()=>{
 const r=rig();r.rec.begin('vocab','s');r.advance(30*SEC);r.rec.activity();r.advance(10*SEC);
 r.rec.hide();assert.equal(r.rows.length,1);assert.equal(r.rows[0].endedAt,iso(T0+40*SEC));assert.equal(r.rows[0].countedMs,40*SEC);
 r.advance(10*MIN);r.rec.activity();assert.equal(r.rec.state().running,false,'activity while hidden is ignored');
 r.rec.show();r.advance(MIN);assert.equal(r.rows.length,1,'showing again does not resume by itself');
 r.rec.activity();r.advance(10*SEC);r.rec.activity();r.rec.end();assert.equal(r.rows.length,2);
});
test('the end of a screen (result screen, leaving) closes the segment; an expired idle time is cut at the last activity',()=>{
 const r=rig();r.rec.begin('vocab','s');r.advance(20*SEC);r.rec.activity();r.advance(15*SEC);r.rec.end();
 assert.equal(r.rows[0].countedMs,35*SEC);
 const idle=rig();idle.rec.begin('vocab','s');idle.advance(20*SEC);idle.rec.activity();
 // the timer is not allowed to fire here (a throttled background tab): end() must still cut at the last activity
 idle.timers.clear();idle.t+=5*MIN;idle.rec.end();assert.equal(idle.rows[0].countedMs,20*SEC);
});
test('segments shorter than five seconds are not recorded',()=>{
 const r=rig();r.rec.begin('vocab','s');r.advance(4*SEC);r.rec.end();assert.equal(r.rows.length,0);
 r.rec.begin('vocab','s');r.advance(5*SEC);r.rec.end();assert.equal(r.rows.length,1);assert.equal(r.rows[0].countedMs,5*SEC);
});
test('a segment longer than 60 minutes is cut into pieces of 60 minutes',()=>{
 const r=rig();r.rec.begin('listening','track');                       // listening has no idle limit
 r.advance(125*MIN);r.rec.end();
 assert.deepEqual(r.rows.map(x=>x.countedMs),[60*MIN,60*MIN,5*MIN]);
 assert.equal(r.rows[1].startedAt,r.rows[0].endedAt);assert.equal(r.rows[2].startedAt,r.rows[1].endedAt);
 const q=rig();q.rec.begin('article','a');for(let i=0;i<70;i++){q.advance(MIN);q.rec.activity();}q.rec.end();
 assert.ok(q.rows.every(x=>x.countedMs<=60*MIN));assert.equal(q.rows.reduce((s,x)=>s+x.countedMs,0),70*MIN);
});
test('only one segment runs at a time: begin() closes the previous one',()=>{
 const r=rig();r.rec.begin('article','a');r.advance(30*SEC);r.rec.activity();r.advance(10*SEC);r.rec.begin('vocab','s');
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].kind,'article');assert.equal(r.rec.state().context.kind,'vocab');
});
test('saving failures never throw into the screen',()=>{
 const rec=createRecorder({now:()=>T0,uuid:()=>'x',deviceId:'d',load:()=>{throw Error('quota');},save(){throw Error('quota');},setTimer:()=>1,clearTimer(){}});
 rec.begin('vocab','s');rec.end();
});

// ---- aggregation ----
const seg=(id,kind,start,end,extra={})=>({id,kind,targetId:null,startedAt:iso(start),endedAt:iso(end),countedMs:end-start,method:'auto',deviceId:'d',updatedAt:iso(end),deletedAt:null,...extra});
const J=s=>Date.parse(s+'+09:00');
test('week boundaries are Japan time, Monday first',()=>{
 assert.equal(S.dayOf(Date.parse('2026-10-10T15:30:00Z')),'2026-10-11','15:30 UTC is already the next day in Japan');
 assert.equal(S.weekStart('2026-10-10'),'2026-10-05');assert.equal(S.weekStart('2026-10-05'),'2026-10-05');assert.equal(S.weekStart('2026-10-11'),'2026-10-05');assert.equal(S.weekStart('2026-10-12'),'2026-10-12');
 assert.equal(S.weekStart('2026-01-01'),'2025-12-29');assert.equal(S.addDays('2026-10-31',1),'2026-11-01');assert.equal(S.addDays('2026-03-01',-1),'2026-02-28');
 // 23:50 Sunday (JST) belongs to the old week, 00:10 Monday to the new one
 const agg=S.aggregate([seg('a','vocab',J('2026-10-11T23:50:00'),J('2026-10-12T00:10:00'))]);
 assert.equal(agg.days['2026-10-11'].total,10*MIN);assert.equal(agg.days['2026-10-12'].total,10*MIN);
 assert.equal(S.sumRange(agg,S.weekStart('2026-10-11'),'2026-10-11').total,10*MIN);assert.equal(S.sumRange(agg,'2026-10-12','2026-10-18').total,10*MIN);
});
test('a segment across midnight is split by day',()=>{
 const parts=S.splitByDay(J('2026-10-10T23:30:00'),J('2026-10-11T00:20:00'));
 assert.deepEqual(parts.map(p=>[p.day,p.end-p.start]),[['2026-10-10',30*MIN],['2026-10-11',20*MIN]]);
 assert.deepEqual(S.splitByDay(J('2026-10-10T10:00:00'),J('2026-10-10T10:30:00')).length,1);
});
test('two devices studying at the same time are counted once',()=>{
 const a=seg('a','vocab',J('2026-10-10T10:00:00'),J('2026-10-10T10:30:00'),{deviceId:'phone'});
 const b=seg('b','vocab',J('2026-10-10T10:10:00'),J('2026-10-10T10:40:00'),{deviceId:'pc'});
 const agg=S.aggregate([a,b]);assert.equal(agg.total,40*MIN,'union of 10:00-10:40');
 assert.equal(S.aggregate([a,a]).total,30*MIN,'the same segment arriving twice');
 const inside=seg('c','vocab',J('2026-10-10T10:05:00'),J('2026-10-10T10:15:00'));assert.equal(S.aggregate([a,inside]).total,30*MIN);
});
test('overlap of different kinds goes to the segment that started later, and the kinds always add up to the total',()=>{
 const a=seg('a','article',J('2026-10-10T10:00:00'),J('2026-10-10T10:30:00'));
 const b=seg('b','vocab',J('2026-10-10T10:10:00'),J('2026-10-10T10:40:00'));
 const agg=S.aggregate([a,b]),day=agg.days['2026-10-10'];
 assert.equal(day.kinds.article,10*MIN,'10:00-10:10 only the article');assert.equal(day.kinds.vocab,30*MIN,'10:10-10:40 goes to the later-starting vocab segment');
 assert.equal(Object.values(day.kinds).reduce((s,x)=>s+x,0),day.total);assert.equal(day.total,40*MIN);
 // the order of the input does not matter
 assert.deepEqual(S.aggregate([b,a]).days,agg.days);
 // a short later segment inside a long one takes only its own time
 const long=seg('l','article',J('2026-10-10T12:00:00'),J('2026-10-10T13:00:00')),short=seg('s','colloc',J('2026-10-10T12:20:00'),J('2026-10-10T12:30:00'));
 const k=S.aggregate([long,short]).days['2026-10-10'];assert.equal(k.kinds.colloc,10*MIN);assert.equal(k.kinds.article,50*MIN);assert.equal(k.total,60*MIN);
 // ties on the start time are decided by the id, deterministically
 const x=seg('1','vocab',J('2026-10-10T14:00:00'),J('2026-10-10T14:10:00')),y=seg('2','article',J('2026-10-10T14:00:00'),J('2026-10-10T14:10:00'));
 assert.deepEqual(S.aggregate([x,y]).days,S.aggregate([y,x]).days);assert.equal(S.aggregate([x,y]).total,10*MIN);
});
test('manual records are added to their day and never take part in the overlap calculation',()=>{
 const auto=seg('a','vocab',J('2026-10-10T10:00:00'),J('2026-10-10T10:30:00'));
 const manual={id:'m',kind:'manual',method:'manual',studyDate:'2026-10-10',countedMs:45*MIN,deletedAt:null,updatedAt:iso(T0)};
 const agg=S.aggregate([auto,manual]),day=agg.days['2026-10-10'];
 assert.equal(day.total,75*MIN);assert.equal(day.kinds.manual,45*MIN);assert.equal(day.kinds.vocab,30*MIN);
 assert.equal(S.aggregate([auto,{...manual,deletedAt:iso(T0)}]).total,30*MIN,'a deleted manual record is ignored');
 assert.equal(S.aggregate([{...manual,studyDate:'bad'}]).total,0);
 assert.equal(agg.total,75*MIN);assert.equal(S.sumRange(agg,'2026-10-10','2026-10-10').kinds.manual,45*MIN);
});
test('invalid or empty input never breaks the totals',()=>{
 assert.equal(S.aggregate([]).total,0);assert.equal(S.aggregate(null).total,0);
 assert.equal(S.aggregate([{id:'x',kind:'vocab',method:'auto',startedAt:'bad',endedAt:'bad'},{id:'y',kind:'manual',method:'auto',startedAt:iso(T0),endedAt:iso(T0+MIN)}]).total,0);
});
