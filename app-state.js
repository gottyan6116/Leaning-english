(function(root){
 'use strict';
 const APP_KEYS={goals:'english-notes.app.goals.v1',sessions:'english-notes.app.unit-sessions.v1',lastUnit:'english-notes.app.last-unit.v1',articleSaves:'english-notes.app.article-saves.v1',customWords:'english-notes.app.custom-words.v1'};
 class AppState{
  constructor(storage,collection,legacy=[]){this.storage=storage;this.collection=collection;this.items=[...collection.items,...legacy];this.goals=this.read(APP_KEYS.goals,{daily:null,weekly:null});this.sessions=this.read(APP_KEYS.sessions,[]);this.lastUnit=this.read(APP_KEYS.lastUnit,null);this.articleSaves=this.read(APP_KEYS.articleSaves,[]);this.customWords=this.read(APP_KEYS.customWords,[]);}
  read(key,fallback){const value=this.storage.getItem(key);return value===null?fallback:JSON.parse(value);}
  write(key,value){this.storage.setItem(key,JSON.stringify(value));}
  commit(changes){const previous=changes.map(([key])=>[key,this.storage.getItem(key)]);try{for(const [key,value] of changes)this.write(key,value);}catch(error){for(const [key,value] of previous){if(value===null)this.storage.removeItem(key);else this.storage.setItem(key,value);}throw error;}}
  savePreferences(quizStore,goals,settings,settingsKey='english-notes.quiz.settings.v1'){for(const [key,max] of [['daily',1440],['weekly',10080]])if(goals[key]!==null&&(!Number.isInteger(goals[key])||goals[key]<1||goals[key]>max))throw Error('目標は正の整数で入力してください');if(!['ja','en'].includes(settings.mode)||typeof settings.autoAdvance!=='boolean')throw Error('出題設定が不正です');const next={...quizStore.settings,...settings};this.commit([[APP_KEYS.goals,goals],[settingsKey,next]]);this.goals=goals;quizStore.settings=next;}
  setSavedState(quizStore,ids,articleIndices,bookmarkKey='english-notes.quiz.bookmarks.v1'){const nextIds=[...new Set(ids)],nextArticles=[...new Set(articleIndices)];this.commit([[bookmarkKey,nextIds],[APP_KEYS.articleSaves,nextArticles]]);quizStore.bookmarks=nextIds;this.articleSaves=nextArticles;}
  setGoals(goals){for(const [key,max] of [['daily',1440],['weekly',10080]])if(goals[key]!==null&&(!Number.isInteger(goals[key])||goals[key]<1||goals[key]>max))throw Error('目標は正の整数で入力してください');const next={daily:goals.daily,weekly:goals.weekly};this.write(APP_KEYS.goals,next);this.goals=next;}
  startUnit(mode){const next={unitId:this.collection.id,mode,startedAt:new Date().toISOString()};this.write(APP_KEYS.lastUnit,next);this.lastUnit=next;}
  completeUnit(session){const ids=new Set(this.collection.items.map(x=>x.id)),answers=session.answers;
   if(!['ja','en'].includes(session.mode)||!Array.isArray(answers)||answers.length!==10||new Set(answers.map(x=>x.wordId)).size!==10||answers.some(x=>!ids.has(x.wordId)||typeof x.correct!=='boolean')||this.sessions.some(x=>x.sessionId===session.id))return false;
   const next=[...this.sessions,{sessionId:session.id,unitId:this.collection.id,mode:session.mode,total:10,correct:answers.filter(x=>x.correct).length,completedAt:new Date().toISOString()}];this.write(APP_KEYS.sessions,next);this.sessions=next;return true;
  }
  best(mode){const scores=this.sessions.filter(x=>x.unitId===this.collection.id&&x.mode===mode&&x.total===10).map(x=>x.correct);return scores.length?Math.max(...scores):null;}
  reviewCandidates(logs,savedIds,mode){const latest=new Map();for(const event of logs)if(event.mode===mode)latest.set(event.wordId,event);const saved=new Set(savedIds),seen=new Set(),wrong=[],unanswered=[];
   for(const item of this.items){if(seen.has(item.id))continue;seen.add(item.id);const event=latest.get(item.id);if(event&&!event.correct)wrong.push(item);else if(saved.has(item.id)&&!event)unanswered.push(item);}return [...wrong,...unanswered];
  }
  saveArticleWord(index){const next=[...new Set([...this.articleSaves,index])];this.write(APP_KEYS.articleSaves,next);this.articleSaves=next;}
  addCustomWord(word){const next=[...this.customWords,word];this.write(APP_KEYS.customWords,next);this.customWords=next;}
 }
 const api={AppState,APP_KEYS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LearningState=api;
})(typeof window!=='undefined'?window:globalThis);
