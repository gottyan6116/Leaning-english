const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'..','materials','listening','listening-items.json');
const GENRES=['仕事','教養','日常・文化'],LEVELS=['A2','B1','B2','C1'],STATUSES=['unverified','verified'];
const len=s=>Array.from(String(s).trim()).length;
const words=text=>String(text).trim().split(/\s+/).filter(Boolean).length;
// Validates listening items (passage read aloud + one comprehension question). Returns an array of error strings.
function validateItems(items){
 const errors=[],ids=new Set();
 if(!Array.isArray(items)||!items.length)return ['listening: items required'];
 for(const item of items){
  const L=item?.id||'(no id)',check=(ok,m)=>{if(!ok)errors.push(`${L}: ${m}`);};
  check(/^listen-\d{3}$/.test(item?.id||''),'invalid ID');check(!ids.has(item?.id),'duplicate ID');ids.add(item?.id);
  for(const key of ['title','titleJa'])check(typeof item?.[key]==='string'&&item[key].trim(),`${key} required`);
  check(GENRES.includes(item?.genre),'invalid genre');check(LEVELS.includes(item?.level),'invalid level');check(STATUSES.includes(item?.status),'invalid status');check(item?.origin==='original-for-this-app','passage must be original');
  const paragraphs=item?.text;check(Array.isArray(paragraphs)&&paragraphs.length>=2&&paragraphs.every(p=>typeof p==='string'&&p.trim()),'at least two non-empty paragraphs required');
  const total=Array.isArray(paragraphs)?paragraphs.reduce((n,p)=>n+words(p),0):0;check(total>=40&&total<=160,`passage length ${total} words is outside 40-160`);
  const q=item?.question;check(typeof q?.promptJa==='string'&&q.promptJa.trim(),'question prompt required');
  check(Array.isArray(q?.choices)&&q.choices.length===3&&q.choices.every(c=>typeof c==='string'&&c.trim())&&new Set(q.choices).size===3,'three distinct choices required');
  check(Number.isInteger(q?.answerIndex)&&q.answerIndex>=0&&q.answerIndex<3,'invalid answer index');
  if(Array.isArray(q?.choices)&&q.choices.length===3&&Number.isInteger(q.answerIndex)){const l=q.choices.map(len),r=[...l].sort((a,b)=>b-a);if(l[q.answerIndex]===r[0]&&l.filter(n=>n===r[0]).length===1&&r[0]>=r[1]*1.2)errors.push(`${L}: correct choice uniquely longest by 20% or more`);}
 }
 return errors;
}
function validateListening(){
 const raw=fs.readFileSync(file,'utf8'),text=raw.replace(/\r\n/g,'\n'),material=JSON.parse(text),errors=[];
 if(material.id!=='listening-items'||material.kind!=='listening'||!Number.isInteger(material.version))errors.push('listening: invalid header');
 errors.push(...validateItems(material.items));
 return {errors,material,text};
}
module.exports={validateItems,validateListening,file};
if(require.main===module){const r=validateListening();r.errors.forEach(e=>console.error(e));console.log(`listening: ${r.material.items.length} items, ${r.errors.length} errors`);process.exit(r.errors.length?1:0);}
