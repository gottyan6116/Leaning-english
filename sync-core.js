(function(root){
 'use strict';
 const TABLES=['answer_logs','saved_words','preferences','unit_sessions','article_states','opinion_drafts'];
 const PRIMARY_KEYS={answer_logs:['event_id'],saved_words:['word_key'],preferences:['setting_key'],unit_sessions:['session_id'],article_states:['article_id'],opinion_drafts:['article_id','prompt_id']};
 const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const normalize=value=>String(value??'').trim().toLowerCase();
 const clone=value=>JSON.parse(JSON.stringify(value));
 function uuid(){const c=root.crypto||globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure UUID generation unavailable');const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
 function rowKey(table,row){if(!TABLES.includes(table))throw Error('Unknown sync table');const keys=PRIMARY_KEYS[table].map(k=>row[k]);if(keys.some(x=>typeof x!=='string'||!x))throw Error('Missing row identity');return keys.length===1?keys[0]:JSON.stringify(keys);}
 const isAppendOnly=table=>table==='answer_logs'||table==='unit_sessions';
 function validPreference(key,value){if(key==='mode')return ['ja','en','ja_en'].includes(value);if(key==='autoAdvance')return typeof value==='boolean';if(key==='daily'||key==='weekly')return value===null||Number.isInteger(value)&&value>0&&value<=(key==='daily'?1440:10080);return false;}
 function compareTime(a,b){return Date.parse(a||'')-Date.parse(b||'');}
 function sortAnswers(logs){return [...logs].sort((a,b)=>{const at=Date.parse(a.answeredAt??a.answered_at),bt=Date.parse(b.answeredAt??b.answered_at);return (at-bt)||String(a.eventId??a.event_id).localeCompare(String(b.eventId??b.event_id),'en');});}
 function answerRow(event,kind='vocabulary'){
  const eventId=UUID_PATTERN.test(event.eventId||event.event_id||'')?(event.eventId||event.event_id):uuid();
  const legacy={...event,eventId};
  return {event_id:eventId,session_id:String(event.sessionId||event.session_id||'legacy'),question_id:String(event.questionId||event.question_id||`${event.wordId||event.word_id||event.articleId||event.article_id}-${event.mode}`),word_id:event.wordId??event.word_id??null,article_id:event.articleId??event.article_id??null,kind:event.kind||kind,material_version:event.materialVersion??event.material_version??null,mode:event.mode,selected_choice_id:event.selectedChoiceId??event.selected_choice_id??null,correct_choice_id:event.correctChoiceId??event.correct_choice_id??null,correct:!!event.correct,skipped:!!event.skipped,...((event.timedOut??event.timed_out)?{timed_out:true}:{}),answered_at:event.answeredAt||event.answered_at,legacy_payload:legacy};
 }
 function answerEvent(row){return {...(row.legacy_payload||{}),eventId:row.event_id,sessionId:row.session_id,questionId:row.question_id,wordId:row.word_id,articleId:row.article_id,kind:row.kind,materialVersion:row.material_version,mode:row.mode,selectedChoiceId:row.selected_choice_id,correctChoiceId:row.correct_choice_id,correct:row.correct,skipped:row.skipped,...(row.timed_out===true?{timedOut:true}:{}),answeredAt:row.answered_at};}
 function validateRow(table,row){rowKey(table,row);if(table==='preferences'&&!validPreference(row.setting_key,row.value))throw Error('Invalid preference');if(table==='answer_logs'){if(!UUID_PATTERN.test(row.event_id)||!['ja','en','ja_en'].includes(row.mode)||!['vocabulary','comprehension','collocation'].includes(row.kind)||typeof row.correct!=='boolean'||typeof row.skipped!=='boolean'||!Number.isFinite(Date.parse(row.answered_at)))throw Error('Invalid answer log');}if(table==='unit_sessions'){if(!['ja','en','ja_en'].includes(row.mode)||row.total!==10||!Number.isInteger(row.correct)||row.correct<0||row.correct>10||!Number.isFinite(Date.parse(row.completed_at)))throw Error('Invalid unit session');}if(!isAppendOnly(table)&&!Number.isFinite(Date.parse(row.updated_at)))throw Error('Invalid update timestamp');return row;}
 const api={TABLES,PRIMARY_KEYS,UUID_PATTERN,normalize,clone,uuid,rowKey,isAppendOnly,validPreference,compareTime,sortAnswers,answerRow,answerEvent,validateRow};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SyncCore=api;
})(typeof window!=='undefined'?window:globalThis);
