(function(root){
 'use strict';
 // Expressions (stage 16): states, progress ("drawers"), practice selection and the quiz items built from the fixed questions.
 // Pure functions plus a small store; no DOM.
 const KEYS={logs:'english-notes.expression.answers.v1',saves:'english-notes.expression.saves.v1'};
 const FORMATS={scene:'場面の判断',tone:'響きの判断',order:'丁寧さの並べ替え',dialogue:'会話の穴埋め'};
 const POLITENESS={casual:'カジュアル',neutral:'中立',polite:'丁寧'},STRENGTH={soft:'控えめ',neutral:'中立',firm:'はっきり'},SETTING={work:'仕事',daily:'日常',both:'両方'};
 const POLITENESS_ORDER=['casual','neutral','polite'],STRENGTH_ORDER=['soft','neutral','firm'];
 const ok=e=>e.correct===true&&!e.skipped;
 const expressionEvents=logs=>(logs||[]).filter(e=>e&&e.kind==='expression'&&e.expressionId);
 // Same rule as words and combinations: none = 未学習, last wrong = 復習予定, last right = 学習中, last two right = 定着.
 // Every answer counts, whatever its source ('practice' now; AI feedback can add events with source 'ai' later).
 function status(expressionId,logs){
  const events=expressionEvents(logs).filter(e=>e.expressionId===expressionId);
  if(!events.length)return '未学習';
  const last=events[events.length-1];
  if(!ok(last))return '復習予定';
  return events.length>1&&ok(events[events.length-2])?'定着':'学習中';
 }
 const statusMap=(items,logs)=>{const latest=new Map();for(const e of expressionEvents(logs)){const list=latest.get(e.expressionId)||[];list.push(e);latest.set(e.expressionId,list);}
  return new Map(items.map(item=>{const list=latest.get(item.id)||[];const last=list[list.length-1];return [item.id,!list.length?'未学習':!ok(last)?'復習予定':list.length>1&&ok(list[list.length-2])?'定着':'学習中'];}));};
 // "n / m": usable expressions (定着) of a function and the number of its expressions.
 function progress(items,functionId,logs){
  const list=items.filter(e=>e.functionId===functionId),states=statusMap(list,logs);
  return {usable:list.filter(e=>states.get(e.id)==='定着').length,total:list.length};
 }
 // Expressions whose latest answer was wrong.
 const reviewExpressionIds=(items,logs)=>{const states=statusMap(items,logs);return items.filter(e=>states.get(e.id)==='復習予定').map(e=>e.id);};
 // A quiz item for QuizSession. Choice IDs come from the question, so scoring is by ID.
 function quizItem(question,expression,extra={}){
  const choices=question.choices,texts=choices.map(c=>c.text),ids=choices.map(c=>c.id);
  const answerIndex=question.format==='order'?0:ids.indexOf(question.answerId);
  return {id:question.id,kind:'expression',format:question.format,expressionId:question.expressionId,functionId:expression?.functionId||null,materialVersion:1,question,expression,
   ...(question.format==='order'?{correctOrder:[...question.correctOrder]}:{}),
   questions:{en:{choices:texts,answerIndex,choiceIds:ids,correctChoiceId:question.format==='order'?question.correctOrder.join('|'):question.answerId}},...extra};
 }
 const byExpression=questions=>{const map=new Map();for(const q of questions){const list=map.get(q.expressionId)||[];list.push(q);map.set(q.expressionId,list);}return map;};
 // Ten questions of one function: expressions to review first, then unlearned, then learning, then settled;
 // one question per expression until every expression has been used; the format rotates so a session is not one kind.
 function practiceQuestions(functionId,items,questions,logs,random=Math.random,limit=10){
  const list=items.filter(e=>e.functionId===functionId),states=statusMap(list,logs),rank={'復習予定':0,'未学習':1,'学習中':2,'定着':3};
  const pool=byExpression(questions),shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};
  const last=new Map();for(const e of expressionEvents(logs))last.set(e.expressionId,e.questionId);
  const ordered=shuffle(list).sort((a,b)=>rank[states.get(a.id)]-rank[states.get(b.id)]);
  const queues=new Map(ordered.map(e=>[e.id,shuffle(pool.get(e.id)||[]).sort((a,b)=>(a.id===last.get(e.id))-(b.id===last.get(e.id)))]));
  const picked=[],usedFormats=[];
  for(let round=0;picked.length<limit&&round<4;round++){
   for(const e of ordered){
    if(picked.length>=limit)break;const queue=queues.get(e.id);if(!queue?.length)continue;
    // prefer a format that has been used least in this session
    const index=queue.reduce((best,q,i)=>usedFormats.filter(f=>f===q.format).length<usedFormats.filter(f=>f===queue[best].format).length?i:best,0);
    const [q]=queue.splice(index,1);picked.push(q);usedFormats.push(q.format);
   }
  }
  return picked;
 }
 // Quiz items for "review": for each expression to review, the question that was missed, or another one.
 function reviewQuestions(items,questions,logs,random=Math.random){
  const ids=new Set(reviewExpressionIds(items,logs)),pool=byExpression(questions),missed=new Map();
  for(const e of expressionEvents(logs))if(!ok(e))missed.set(e.expressionId,e.questionId);else missed.delete(e.expressionId);
  const out=[];
  for(const id of ids){const list=pool.get(id)||[];if(!list.length)continue;const same=list.find(q=>q.id===missed.get(id));const others=list.filter(q=>q!==same);out.push(others.length?others[Math.floor(random()*others.length)]:same);}
  return out;
 }
 // Groups for the function page: politeness (columns / blocks) by strength (rows).
 function matrix(items,setting){
  const list=items.filter(e=>!setting||setting==='all'||e.setting===setting||e.setting==='both');
  return POLITENESS_ORDER.map(p=>({politeness:p,label:POLITENESS[p],rows:STRENGTH_ORDER.map(s=>({strength:s,label:STRENGTH[s],items:list.filter(e=>e.politeness===p&&e.strength===s).sort((a,b)=>a.politenessRank-b.politenessRank||a.expression.localeCompare(b.expression))}))}));
 }
 class ExpressionStore{
  constructor(storage){this.storage=storage;this.check();}
  readKey(key){const raw=this.storage.getItem(key);if(raw===null||raw===undefined)return [];const value=JSON.parse(raw);if(!Array.isArray(value))throw Error('Invalid expression data');return value;}
  check(){this.readKey(KEYS.logs);this.readKey(KEYS.saves);}
  get logs(){return this.readKey(KEYS.logs);}
  append(event){const logs=this.logs;logs.push(event);this.storage.setItem(KEYS.logs,JSON.stringify(logs));}
  get saves(){return this.readKey(KEYS.saves);}
  isSaved(id){return this.saves.includes(id);}
  toggleSave(id){const saves=this.saves,next=saves.includes(id)?saves.filter(x=>x!==id):[...saves,id];this.storage.setItem(KEYS.saves,JSON.stringify(next));return next.includes(id);}
 }
 const api={KEYS,FORMATS,POLITENESS,STRENGTH,SETTING,status,statusMap,progress,reviewExpressionIds,quizItem,practiceQuestions,reviewQuestions,matrix,ExpressionStore};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ExpressionCore=api;
})(typeof window!=='undefined'?window:globalThis);
