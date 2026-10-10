(function(root){
 'use strict';
 // Study-time recorder (stage 15). Turns "a screen is being studied" into saved segments.
 // Idle limits, minimum and maximum lengths live here, in one place.
 const CONFIG={
  idleMs:{vocab:60000,colloc:60000,expr:60000,article:180000,listening:null},
  minMs:5000,maxMs:3600000,
  storageKey:'english-notes.study.segments.v1',deviceKey:'english-notes.device-id.v1'
 };
 // env: {now(), uuid(), deviceId, load()->array, save(array), setTimer(fn,ms), clearTimer(id), config}
 // The screens call begin()/end(); the browser calls activity(), hide() and show().
 function createRecorder(env){
  const config=env.config||CONFIG;
  let ctx=null,seg=null,hidden=false,timer=null;
  const idleOf=kind=>config.idleMs[kind]??null;
  function emit(kind,targetId,start,end){
   if(end-start<config.minMs)return;
   const stamp=new Date(env.now()).toISOString();
   const row={id:env.uuid(),kind,targetId:targetId||null,startedAt:new Date(start).toISOString(),endedAt:new Date(end).toISOString(),countedMs:end-start,method:'auto',deviceId:env.deviceId,updatedAt:stamp,deletedAt:null};
   try{const list=env.load();list.push(row);env.save(list);}catch(error){/* never break the screen because saving failed */}
  }
  // A segment longer than the maximum is saved in pieces of the maximum length.
  function append(kind,targetId,start,end){while(end-start>config.maxMs){emit(kind,targetId,start,start+config.maxMs);start+=config.maxMs;}emit(kind,targetId,start,end);}
  function stopTimer(){if(timer!==null){env.clearTimer(timer);timer=null;}}
  // When the idle limit has passed, the segment ended at the last activity, not now.
  function endTime(t){const idle=idleOf(ctx.kind);return idle!==null&&t-seg.last>=idle?seg.last:t;}
  function close(t){if(!seg)return;stopTimer();const end=Math.max(seg.start,endTime(t));append(ctx.kind,ctx.targetId,seg.start,end);seg=null;}
  function schedule(){
   stopTimer();if(!seg)return;
   const idle=idleOf(ctx.kind),deadline=Math.min(idle!==null?seg.last+idle:Infinity,seg.start+config.maxMs);
   if(Number.isFinite(deadline))timer=env.setTimer(tick,Math.max(0,deadline-env.now())+1);
  }
  function startSegment(t){seg={start:t,last:t};schedule();}
  function tick(){
   timer=null;if(!seg||!ctx)return;const t=env.now(),idle=idleOf(ctx.kind);
   if(idle!==null&&t-seg.last>=idle){close(t);return;}
   if(t-seg.start>=config.maxMs){emit(ctx.kind,ctx.targetId,seg.start,seg.start+config.maxMs);seg={start:seg.start+config.maxMs,last:Math.max(seg.last,seg.start+config.maxMs)};}
   schedule();
  }
  return {
   // The screen shows something to study: any running segment is closed, a new one starts at once.
   begin(kind,targetId){const t=env.now();if(ctx&&seg)close(t);ctx={kind,targetId:targetId||null};if(!hidden)startSegment(t);},
   // The screen is left or finished.
   end(){if(ctx&&seg)close(env.now());ctx=null;seg=null;stopTimer();},
   // A tap, key press or scroll. After a stop it starts a new segment; it never extends a stopped one.
   activity(){
    if(!ctx||hidden)return;const t=env.now();
    if(!seg){startSegment(t);return;}
    const idle=idleOf(ctx.kind);
    if(idle!==null&&t-seg.last>=idle){close(t);startSegment(t);return;}
    seg.last=t;if(t-seg.start>=config.maxMs)tick();
   },
   // The page is hidden or closed: save what was counted so far.
   hide(){if(ctx&&seg)close(env.now());hidden=true;},
   show(){hidden=false;},
   state(){return {context:ctx?{...ctx}:null,running:!!seg,hidden};}
  };
 }
 const api={CONFIG,createRecorder};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
 // ---- Browser wiring ----
 const win=root,doc=win.document;
 const storage=()=>win.AppStorage||win.localStorage;
 function deviceId(){
  try{let id=win.localStorage.getItem(CONFIG.deviceKey);if(!id){id=win.crypto.randomUUID();win.localStorage.setItem(CONFIG.deviceKey,id);}return id;}catch(error){return 'device-unknown';}
 }
 const recorder=createRecorder({
  now:()=>Date.now(),uuid:()=>win.crypto.randomUUID(),deviceId:deviceId(),
  load(){const raw=storage().getItem(CONFIG.storageKey),list=raw?JSON.parse(raw):[];return Array.isArray(list)?list:[];},
  save(list){storage().setItem(CONFIG.storageKey,JSON.stringify(list));},
  setTimer:(fn,ms)=>win.setTimeout(fn,ms),clearTimer:id=>win.clearTimeout(id)
 });
 const touch=()=>recorder.activity();
 for(const type of ['pointerdown','keydown','touchstart','wheel'])doc.addEventListener(type,touch,{capture:true,passive:true});
 win.addEventListener('scroll',touch,{capture:true,passive:true});
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)recorder.hide();else recorder.show();});
 win.addEventListener('pagehide',()=>recorder.hide());
 win.addEventListener('pageshow',()=>recorder.show());
 win.StudyTimer={
  begin:(kind,targetId)=>recorder.begin(kind,targetId),end:()=>recorder.end(),state:()=>recorder.state(),
  // Called whenever the screen changes: an article segment lives only while the article is on screen.
  onView(view){
   const s=recorder.state();
   if(s.context?.kind==='article'&&view!=='article')recorder.end();
   else if(view==='article'&&!s.context&&win.ArticleUI?.isReady?.())recorder.begin('article',win.ArticleUI.currentId?.());
  },
  segments(){try{return JSON.parse(storage().getItem(CONFIG.storageKey)||'[]');}catch(error){return [];}},
  deviceId:deviceId(),config:CONFIG
 };
})(typeof window!=='undefined'?window:globalThis);
