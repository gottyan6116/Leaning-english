(function(root){
  'use strict';
  const KEYS={logs:'english-notes.quiz.answers.v1',settings:'english-notes.quiz.settings.v1',bookmarks:'english-notes.quiz.bookmarks.v1'};
  const normalize=s=>String(s).trim().toLocaleLowerCase();
  const MODES=['ja','en','ja_en'],MODE_NAMES={ja:'英語 → 日本語',en:'英語 → 英語',ja_en:'日本語 → 英語'};
  const modeSupported=(item,mode)=>{if(item?.kind==='collocation')return mode==='en';const q=item?.questions?.[mode];return !!q&&Array.isArray(q.choices)&&q.choices.length===4&&q.choices.every(s=>typeof s==='string'&&s.trim())&&new Set(q.choices.map(normalize)).size===4&&Number.isInteger(q.answerIndex)&&q.answerIndex>=0&&q.answerIndex<4;};
  function questionChoices(q,questionId='question'){return q.choices.map((text,i)=>({id:q.choiceIds?.[i]||`${questionId}-option-${i+1}`,text}));}
  function correctChoiceId(q,questionId='question'){return q.correctChoiceId||questionChoices(q,questionId)[q.answerIndex]?.id;}
  function shuffleChoices(q,random=Math.random,questionId='question'){const choices=questionChoices(q,questionId);for(let i=choices.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[choices[i],choices[j]]=[choices[j],choices[i]];}return choices;}
  function validateItem(item){const modes=item?.kind==='collocation'?['en']:['ja','en'];return !!item?.id&&modes.every(mode=>{const q=item.questions?.[mode];return q&&Array.isArray(q.choices)&&q.choices.length===4&&q.choices.every(s=>typeof s==='string'&&s.trim())&&new Set(q.choices.map(normalize)).size===4&&Number.isInteger(q.answerIndex)&&q.answerIndex>=0&&q.answerIndex<4});}
  function chooseReview(items,logs,mode,limit=10){const latest=new Map();for(const log of logs)if(log.mode===mode)latest.set(log.wordId,log);const wrong=items.filter(x=>latest.has(x.id)&&!latest.get(x.id).correct),unanswered=items.filter(x=>!latest.has(x.id));return [...wrong,...unanswered].filter(validateItem).slice(0,Math.max(0,Math.min(10,limit)));}
  function scoreForMode(logs,mode){const events=logs.filter(x=>x.mode===mode);return {answered:events.length,correct:events.filter(x=>x.correct).length,wrong:events.filter(x=>!x.correct).length,skipped:events.filter(x=>x.skipped).length};}
  function chooseNextSet(items,logs,mode,previous){const excluded=new Set(previous.map(x=>x.id)),available=items.filter(x=>!excluded.has(x.id)),prioritized=chooseReview(available,logs,mode);return [...prioritized,...available.filter(x=>validateItem(x)&&!prioritized.some(y=>y.id===x.id))].slice(0,10);}
  // Counts only time during which a question is on screen and not paused (hidden tab, open dialog).
  class QuestionTimer{
    constructor(limitMs,now=()=>Date.now()){this.limitMs=limitMs;this.now=now;this.used=0;this.since=null;}
    reset(){this.used=0;this.since=null;}
    start(){if(this.since===null)this.since=this.now();}
    pause(){if(this.since!==null){this.used+=Math.max(0,this.now()-this.since);this.since=null;}}
    stop(){this.pause();}
    get running(){return this.since!==null;}
    elapsed(){return this.used+(this.since!==null?Math.max(0,this.now()-this.since):0);}
    remaining(){return Math.max(0,this.limitMs-this.elapsed());}
    expired(){return this.elapsed()>=this.limitMs;}
  }
  class QuizStore{
    constructor(storage){this.storage=storage;this.logs=this.read(KEYS.logs,[]);this.settings={mode:'ja',autoAdvance:true,...this.read(KEYS.settings,{})};this.bookmarks=this.read(KEYS.bookmarks,[]);if(!Array.isArray(this.logs)||this.logs.some(x=>!x.wordId||!MODES.includes(x.mode)||typeof x.correct!=='boolean'||!x.answeredAt)||!Array.isArray(this.bookmarks))throw Error('回答履歴を読み込めません');if(!MODES.includes(this.settings.mode))this.settings.mode='ja';this.settings.autoAdvance=this.settings.autoAdvance!==false;}
    read(key,fallback){const raw=this.storage.getItem(key);return raw===null?fallback:JSON.parse(raw);}
    append(event){const next=[...this.logs,event];this.storage.setItem(KEYS.logs,JSON.stringify(next));this.logs=next;}
    setSettings(patch){const next={...this.settings,...patch};this.storage.setItem(KEYS.settings,JSON.stringify(next));this.settings=next;}
    toggleBookmark(id){const next=this.bookmarks.includes(id)?this.bookmarks.filter(x=>x!==id):[...this.bookmarks,id];this.storage.setItem(KEYS.bookmarks,JSON.stringify(next));this.bookmarks=next;return next.includes(id);}
  }
  class QuizSession{
    constructor(items,mode,store,now=()=>Date.now(),random=Math.random,collocationStore=null,options={}){this.collocationStore=collocationStore;this.timeLimitMs=Number.isFinite(options.timeLimitMs)&&options.timeLimitMs>0?options.timeLimitMs:null;this.timer=this.timeLimitMs?new QuestionTimer(this.timeLimitMs,now):null;this.combo=0;this.maxCombo=0;this.items=items.filter(validateItem).slice(0,10);this.mode=mode;this.store=store;this.now=now;this.startedAt=now();this.endedAt=null;this.index=0;this.answers=[];this.state=this.items.length?'question':'result';this.id=`quiz-${this.startedAt}-${Math.random().toString(36).slice(2,9)}`;if(this.timer&&this.state==='question')this.timer.reset();this.displayChoices=this.items.map(item=>shuffleChoices(item.questions[this.modeOf(item)],random,`${item.id}-${this.modeOf(item)}`));}
    modeOf(item){if(item.kind==='collocation')return 'en';return modeSupported(item,this.mode)?this.mode:'ja';}
    get item(){return this.items[this.index];}
    get choices(){return this.displayChoices[this.index];}
    get correctId(){const mode=this.modeOf(this.item);return correctChoiceId(this.item.questions[mode],`${this.item.id}-${mode}`);}
    answer(index){if(this.state!=='question'||!Number.isInteger(index)||index<0||index>3)return null;return this.submit(index,false);}
    skip(){if(this.state!=='question')return null;return this.submit(null,true);}
    timeout(){if(this.state!=='question'||!this.timer)return null;return this.submit(null,false,true);}
    answerChoice(id){if(this.state!=='question')return null;const index=this.choices.findIndex(c=>c.id===id);return index<0?null:this.submit(index,false);}
    submit(index,skipped,timedOut=false){const collocation=this.item.kind==='collocation',target=collocation?this.collocationStore:this.store;if(!target)throw Error('回答履歴を保存できません');const selectedChoiceId=skipped||timedOut?null:this.choices[index].id;const event={eventId:typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`answer-${this.now()}-${Math.random().toString(36).slice(2)}`,questionId:collocation?this.item.questionKey:`${this.item.id}-${this.mode}`,wordId:collocation?this.item.wordId:this.item.id,...(collocation?{kind:'collocation',collocationId:this.item.id,format:this.item.format}:{}),materialVersion:this.item.materialVersion||1,mode:this.modeOf(this.item),correct:!skipped&&!timedOut&&selectedChoiceId===this.correctId,correctChoiceId:this.correctId,selectedChoiceId,skipped,answeredAt:new Date(this.now()).toISOString(),sessionId:this.id,selectedIndex:index,...(this.timer?{timeLimitMs:this.timeLimitMs,responseMs:this.timer.elapsed(),...(timedOut?{timedOut:true}:{})}:{})};if(this.timer)this.timer.stop();target.append(event);this.answers.push(event);this.combo=event.correct?this.combo+1:0;this.maxCombo=Math.max(this.maxCombo,this.combo);this.state=event.correct?'correct':'wrong';return event;}
    next(){if(!['correct','wrong'].includes(this.state))return false;if(this.index+1>=this.items.length){this.state='result';this.endedAt=this.now();return false;}this.index++;this.state='question';if(this.timer)this.timer.reset();return true;}
    result(){const answered=new Set(this.answers.filter(x=>!x.correct).map(x=>x.collocationId||x.wordId));return {total:this.items.length,answered:this.answers.length,correct:this.answers.filter(x=>x.correct).length,wrongItems:this.items.filter(x=>answered.has(x.id)),durationMs:Math.max(0,(this.endedAt??this.now())-this.startedAt),mode:this.mode,maxCombo:this.maxCombo};}
  }
  const api={MODES,MODE_NAMES,modeSupported,QuestionTimer,QuizStore,QuizSession,chooseReview,chooseNextSet,scoreForMode,validateItem,questionChoices,correctChoiceId,shuffleChoices,KEYS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EnglishQuiz=api;
})(typeof window!=='undefined'?window:globalThis);
