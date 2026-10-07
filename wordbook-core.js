(function(root){
 'use strict';
 const SETUP_KEY='english-notes.quiz.setup.v1';
 const RANGES=[['auto','おまかせ'],['weak','苦手'],['unlearned','未学習'],['saved','保存済み']];
 const TIME_OPTIONS=[[0,'オフ'],[7000,'7秒'],[10000,'10秒'],[15000,'15秒']];
 const DEFAULT_SETUP={range:'auto',timeLimitMs:10000};
 const SET_MARKS=['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];
 const setLabel=n=>SET_MARKS[n-1]||String(n);
 const Quiz=typeof module!=='undefined'&&module.exports?require('./quiz-core.js'):root.EnglishQuiz;
 const supports=(item,mode)=>Quiz.modeSupported(item,mode);
 function latestByWord(logs,mode){const latest=new Map();for(const log of logs)if(log.mode===mode&&log.wordId)latest.set(log.wordId,log);return latest;}
 // Items of one set that can be asked in the given format, in the set's own order.
 const setItems=(set,mode)=>(set.items||[]).filter(item=>supports(item,mode));
 // Range definitions (all within the chosen set and the current question format):
 // auto: everything, with latest wrong/skipped/timed-out first, then unanswered, then the rest.
 // weak: latest answer was wrong, skipped or timed out. unlearned: never answered. saved: saved words.
 function select(range,set,{logs=[],mode,savedIds=[]}){
  const items=setItems(set,mode),latest=latestByWord(logs,mode),saved=new Set(savedIds);
  const wrong=items.filter(x=>latest.has(x.id)&&!latest.get(x.id).correct),fresh=items.filter(x=>!latest.has(x.id)),rest=items.filter(x=>latest.has(x.id)&&latest.get(x.id).correct);
  if(range==='weak')return wrong;if(range==='unlearned')return fresh;if(range==='saved')return items.filter(x=>saved.has(x.id));
  return [...wrong,...fresh,...rest];
 }
 const counts=(set,context)=>Object.fromEntries(RANGES.map(([id])=>[id,select(id,set,context).length]));
 const first10=items=>items.slice(0,10);
 function normalizeSetup(value,available){
  const setup={...DEFAULT_SETUP};
  if(value&&RANGES.some(([id])=>id===value.range))setup.range=value.range;
  if(value&&TIME_OPTIONS.some(([ms])=>ms===value.timeLimitMs))setup.timeLimitMs=value.timeLimitMs;
  if(available&&!(available[setup.range]>0))setup.range='auto';
  return setup;
 }
 function loadSetup(storage){try{const raw=storage.getItem(SETUP_KEY);return raw===null?{...DEFAULT_SETUP}:normalizeSetup(JSON.parse(raw));}catch(error){return {...DEFAULT_SETUP};}}
 function saveSetup(storage,setup){const next=normalizeSetup(setup);try{storage.setItem(SETUP_KEY,JSON.stringify(next));}catch(error){return false;}return true;}
 const bestOf=(sessions,setId,mode)=>{const scores=sessions.filter(x=>x.unitId===setId&&x.mode===mode&&x.total===10).map(x=>x.correct);return scores.length?Math.max(...scores):null;};
 const cleared=(sessions,setId,mode)=>bestOf(sessions,setId,mode)===10;
 // Genres sorted by their order; sets of a genre sorted by number. Adding a genre/set needs data files only.
 function organise(genres,sets){const sorted=[...genres].sort((a,b)=>a.order-b.order);return sorted.map(genre=>({...genre,sets:sets.filter(s=>s.genre===genre.id).sort((a,b)=>a.setNumber-b.setNumber)}));}
 const api={SETUP_KEY,RANGES,TIME_OPTIONS,DEFAULT_SETUP,setLabel,setItems,select,counts,first10,normalizeSetup,loadSetup,saveSetup,bestOf,cleared,organise,latestByWord};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordbookCore=api;
})(typeof window!=='undefined'?window:globalThis);
