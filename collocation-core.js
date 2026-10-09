(function(root){
 'use strict';
 const KEYS={logs:'english-notes.collocation.answers.v1',saves:'english-notes.collocation.saves.v1'};
 const TYPES=[['verb_noun','動詞＋名詞'],['adj_noun','形容詞＋名詞'],['noun_prep','名詞＋前置詞'],['other','その他']];
 const TYPE_IDS=TYPES.map(([id])=>id),STATUSES=['unverified','verified'];
 const typeLabel=type=>(TYPES.find(([id])=>id===type)||TYPES[3])[1];
 const normalize=value=>String(value??'').trim().toLowerCase();
 const slug=text=>normalize(text).replace(/～/g,'x').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
 const escapeRegExp=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const BLANK='___';
 const IRREGULAR={win:'won',lay:'laid',make:'made'};
 function blankPattern(blank){const base=escapeRegExp(blank),last=base.slice(-1),extra=IRREGULAR[normalize(blank)];return new RegExp('\\b(?:'+base+'(?:s|es|ed|d|ing)?|'+base+last+'(?:ed|ing)'+(extra?'|'+extra:'')+')\\b','i');}
 function stem(collocation){const tokens=collocation.form.split(/\s+/),at=tokens.findIndex(token=>normalize(token)===normalize(collocation.fill?.blank));if(at<0)return null;tokens[at]=BLANK;return tokens.join(' ');}
 function maskedExample(collocation){const pattern=blankPattern(collocation.fill.blank);return pattern.test(collocation.example)?collocation.example.replace(pattern,BLANK):null;}
 function validateCollocation(c,wordIds){
  const errors=[],label=c?.id||'(no id)';const check=(ok,message)=>{if(!ok)errors.push(`${label}: ${message}`);};
  check(typeof c?.id==='string'&&/^col-[a-z0-9-]+$/.test(c.id),'invalid ID');
  check(typeof c?.wordId==='string'&&c.wordId&&(!wordIds||wordIds.has(c.wordId)),'unknown word');
  for(const key of ['form','meaningJa','nuanceJa','example'])check(typeof c?.[key]==='string'&&c[key].trim(),`${key} required`);
  check(TYPE_IDS.includes(c?.type),'invalid type');check(STATUSES.includes(c?.status),'invalid status');check(c?.exampleOrigin==='original-for-this-app','example must be original');
  if(c?.fill){const f=c.fill,tokens=String(c.form).split(/\s+/);check(typeof f.blank==='string'&&tokens.some(t=>normalize(t)===normalize(f.blank)),'fill.blank must be a word of the form');check(Array.isArray(f.distractors)&&f.distractors.length===3&&f.distractors.every(x=>typeof x==='string'&&x.trim()),'fill needs three distractors');if(Array.isArray(f.distractors)&&typeof f.blank==='string')check(new Set([f.blank,...f.distractors].map(normalize)).size===4,'fill choices must be four distinct words');}
  if(c?.misuse){check(typeof c.misuse.form==='string'&&c.misuse.form.trim()&&typeof c.misuse.noteJa==='string'&&c.misuse.noteJa.trim(),'misuse needs form and noteJa');check(normalize(c.misuse.form)!==normalize(c.form),'misuse must differ from the combination');}
  return errors;
 }
 function choiceSet(texts,idOf,correctText){const choices=texts.map(text=>({id:idOf(text),text})),answerIndex=texts.findIndex(text=>text===correctText);return {choices:texts,choiceIds:choices.map(x=>x.id),answerIndex,correctChoiceId:choices[answerIndex].id};}
 function fillItem(c){if(!c?.fill)return null;const text=stem(c);if(!text)return null;const texts=[c.fill.blank,...c.fill.distractors];
  return {id:c.id,kind:'collocation',format:'fill',collocation:c,wordId:c.wordId,headword:text,meaning:c.meaningJa,example:c.example,exampleMasked:maskedExample(c),questionKey:`${c.id}-fill`,materialVersion:1,questions:{en:choiceSet(texts,t=>`${c.id}-fill-${slug(t)}`,c.fill.blank)}};}
 function misuseItem(c,all){if(!c?.misuse)return null;const siblings=all.filter(x=>x.wordId===c.wordId&&x.id!==c.id);if(siblings.length<2)return null;const natural=[c,...siblings.slice(0,2)],texts=[...natural.map(x=>x.form),c.misuse.form];if(new Set(texts.map(normalize)).size!==4)return null;
  return {id:c.id,kind:'collocation',format:'misuse',collocation:c,wordId:c.wordId,headword:'ふつう使わない組み合わせはどれ？',meaning:c.misuse.noteJa,example:null,exampleMasked:null,questionKey:`${c.id}-misuse`,materialVersion:1,questions:{en:choiceSet(texts,t=>`${c.id}-misuse-${slug(t)}`,c.misuse.form)}};}
 function itemFor(c,format,all){return format==='misuse'?misuseItem(c,all):fillItem(c);}
 function formatsFor(c,all){return ['fill','misuse'].filter(format=>itemFor(c,format,all));}
 function validateQuestion(item){const q=item?.questions?.en;return !!item?.id&&item.kind==='collocation'&&q&&Array.isArray(q.choices)&&q.choices.length===4&&q.choices.every(s=>typeof s==='string'&&s.trim())&&new Set(q.choices.map(normalize)).size===4&&Number.isInteger(q.answerIndex)&&q.answerIndex>=0&&q.answerIndex<4;}
 const collocationEvents=logs=>logs.filter(event=>event.kind==='collocation'&&event.collocationId);
 function latestByCollocation(logs){const latest=new Map();for(const event of collocationEvents(logs))latest.set(event.collocationId,event);return latest;}
 function status(id,logs){const events=collocationEvents(logs).filter(event=>event.collocationId===id);if(!events.length)return '未学習';const last=events[events.length-1],ok=e=>e.correct&&!e.skipped;if(!ok(last))return '復習予定';return events.length>1&&ok(events[events.length-2])?'定着':'学習中';}
 // saves: IDs the learner registered. A registered combination that was never answered is reviewed too (like a saved word).
 function reviewItems(all,logs,saves=[]){const latest=latestByCollocation(logs),saved=new Set(saves),result=[];for(const c of all){const event=latest.get(c.id);if(event?event.correct&&!event.skipped:!saved.has(c.id))continue;const preferred=event?.format==='misuse'?'misuse':'fill',item=itemFor(c,preferred,all)||itemFor(c,preferred==='fill'?'misuse':'fill',all);if(item)result.push(item);}return result;}
 function practiceItems(candidates,all,logs,random=Math.random,limit=10){const wrong=new Set(reviewItems(all,logs).map(x=>x.id)),pool=[...candidates].sort((a,b)=>(wrong.has(b.id)-wrong.has(a.id))||(random()-0.5)),items=[];for(const c of pool){const formats=formatsFor(c,all);if(!formats.length)continue;items.push(itemFor(c,formats[Math.floor(random()*formats.length)],all));if(items.length>=limit)break;}return items;}
 function groupByType(list){return TYPES.map(([type,label])=>({type,label,items:list.filter(c=>c.type===type)})).filter(group=>group.items.length);}
 class CollocationStore{
  constructor(storage){this.storage=storage;this.check();}
  readKey(key){const raw=this.storage.getItem(key);if(raw===null)return [];const value=JSON.parse(raw);if(!Array.isArray(value))throw Error('組み合わせの学習記録を読み込めません');return value;}
  check(){this.readKey(KEYS.logs);this.readKey(KEYS.saves);}
  get logs(){return this.readKey(KEYS.logs);}
  get saves(){return this.readKey(KEYS.saves);}
  append(event){this.storage.setItem(KEYS.logs,JSON.stringify([...this.logs,event]));}
  isSaved(id){return this.saves.includes(id);}
  toggleSave(id){const saves=this.saves,next=saves.includes(id)?saves.filter(x=>x!==id):[...saves,id];this.storage.setItem(KEYS.saves,JSON.stringify(next));return next.includes(id);}
 }
 const api={KEYS,TYPES,typeLabel,slug,stem,maskedExample,validateCollocation,fillItem,misuseItem,itemFor,formatsFor,validateQuestion,status,reviewItems,practiceItems,groupByType,latestByCollocation,CollocationStore,BLANK};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CollocationCore=api;
})(typeof window!=='undefined'?window:globalThis);
