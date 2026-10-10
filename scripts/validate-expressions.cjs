// Validates materials/expressions (stage 16): the expressions and their practice questions.
const fs=require('node:fs'),path=require('node:path');
const {check:nuanceProblem}=require('./nuance-check.cjs');
const defaultDir=path.join(__dirname,'..','materials','expressions');
const POLITENESS=['casual','neutral','polite'],STRENGTH=['soft','neutral','firm'],SETTING=['work','daily','both'],FORMATS=['scene','tone','order','dialogue'],STATUS=['unverified','verified'];
// Coarse politeness shown in the table is derived from the 1-5 rank used by the ordering questions.
// A nuance of an expression is informative when it names a situation, a person, a register or a contrast (or carries English text).
const MARKERS=['会議','雑談','友人','友達','上司','部下','同僚','取引先','顧客','目上','初対面','親しい','口頭','メール','文章','スピーチ','議論','討論','場面','場で','相手','日常','仕事','改まっ','くだけ','丁寧','砕け','堅','より','ではなく','違い','対し','一方','とは異なる'];
const informative=text=>nuanceProblem({nuanceJa:text,meaningJa:''})===null||MARKERS.some(m=>text.includes(m));
const levelOfRank=rank=>rank<=2?'casual':rank===3?'neutral':'polite';
const MIN_PER_FUNCTION=6,MAX_PER_FUNCTION=9,MIN_QUESTIONS_PER_FUNCTION=10,MAX_SHARE=0.6;
function validateExpressions(dir=defaultDir){
 const errors=[],read=name=>{const text=fs.readFileSync(path.join(dir,name),'utf8').replace(/\r\n/g,'\n');return {text,json:JSON.parse(text)};};
 const {text,json:material}=read('expressions.json'),{text:questionText,json:questionMaterial}=read('expression-questions.json');
 const err=(id,message)=>errors.push(`${id}: ${message}`);
 if(material.id!=='expressions'||material.kind!=='expressions'||!Number.isInteger(material.version))err('expressions','invalid header');
 if(questionMaterial.id!=='expression-questions'||questionMaterial.kind!=='expression-questions'||!Number.isInteger(questionMaterial.version))err('expression-questions','invalid header');
 const categories=new Map((material.categories||[]).map(c=>[c.id,c])),functions=new Map((material.functions||[]).map(f=>[f.id,f]));
 for(const f of functions.values()){if(!categories.has(f.categoryId))err(f.id,'unknown category');if(!f.name||!Number.isInteger(f.order))err(f.id,'name and order required');}
 const items=material.items||[],byId=new Map(),seenText=new Map();
 for(const e of items){
  const label=e.id||'(no id)';
  if(!/^expr-[a-z0-9]+-[a-z0-9]+$/.test(e.id||''))err(label,'invalid ID');
  if(byId.has(e.id))err(label,'duplicate ID');byId.set(e.id,e);
  for(const key of ['expression','nuanceJa'])if(typeof e[key]!=='string'||!e[key].trim())err(label,`${key} required`);
  const norm=String(e.expression||'').trim().toLowerCase();if(seenText.has(norm))err(label,`duplicate expression (also ${seenText.get(norm)})`);seenText.set(norm,label);
  if(!functions.has(e.functionId))err(label,'unknown function');
  if(!POLITENESS.includes(e.politeness))err(label,'invalid politeness');if(!STRENGTH.includes(e.strength))err(label,'invalid strength');if(!SETTING.includes(e.setting))err(label,'invalid setting');
  if(!Number.isInteger(e.politenessRank)||e.politenessRank<1||e.politenessRank>5)err(label,'politenessRank must be 1-5');
  else if(levelOfRank(e.politenessRank)!==e.politeness)err(label,'politenessRank does not match politeness');
  if(!STATUS.includes(e.status))err(label,'invalid status');
  if(e.cautionJa!==null&&e.cautionJa!==undefined&&(typeof e.cautionJa!=='string'||!e.cautionJa.trim()))err(label,'cautionJa must be null or text');
  if(typeof e.nuanceJa==='string'){if(Array.from(e.nuanceJa).length<25)err(label,'nuance too short');if(!informative(e.nuanceJa))err(label,'nuance gives no difference, situation or typical words');}
  const lines=e.dialogue;
  if(!Array.isArray(lines)||lines.length<4||lines.length>6||lines.some(l=>!l||!['A','B'].includes(l.speaker)||typeof l.text!=='string'||!l.text.trim()))err(label,'dialogue needs 2-3 exchanges (4-6 lines by A and B)');
  else if(lines.some((l,i)=>i>0&&l.speaker===lines[i-1].speaker))err(label,'dialogue speakers must alternate');
 }
 for(const e of items){
  const label=e.id,related=e.related;
  if(!Array.isArray(related)||related.length<1||related.length>3)err(label,'1-3 related expressions required');
  else{const seen=new Set();for(const r of related){const target=byId.get(r.id);
   if(!target)err(label,`related expression ${r.id} does not exist`);else if(target.functionId!==e.functionId)err(label,`related expression ${r.id} belongs to another function`);
   if(r.id===e.id)err(label,'an expression cannot be related to itself');if(seen.has(r.id))err(label,`related ${r.id} listed twice`);seen.add(r.id);
   if(typeof r.noteJa!=='string'||!r.noteJa.trim())err(label,`related ${r.id} needs a one-line difference`);}}
 }
 // Spread inside each function.
 for(const f of functions.values()){
  const list=items.filter(e=>e.functionId===f.id);
  if(list.length<MIN_PER_FUNCTION||list.length>MAX_PER_FUNCTION)err(f.id,`${list.length} expressions (need ${MIN_PER_FUNCTION}-${MAX_PER_FUNCTION})`);
  for(const [name,values,key,required] of [['politeness',POLITENESS,'politeness',values=>values],['strength',STRENGTH,'strength',values=>values],['setting',SETTING,'setting',()=>['work','daily']]]){
   const counts=Object.fromEntries(values.map(v=>[v,list.filter(e=>e[key]===v).length]));
   for(const v of required(values))if(!counts[v])err(f.id,`no expression with ${name} ${v}`);
   for(const [v,n] of Object.entries(counts))if(list.length&&n/list.length>MAX_SHARE)err(f.id,`${name} ${v} is ${n} of ${list.length} (more than ${MAX_SHARE*100}%)`);
  }
 }
 // Practice questions.
 const questions=questionMaterial.items||[],qids=new Set();
 for(const q of questions){
  const label=q.id||'(no id)';
  if(qids.has(q.id))err(label,'duplicate ID');qids.add(q.id);
  const anchor=byId.get(q.expressionId);if(!anchor)err(label,'unknown expression');
  if(!FORMATS.includes(q.format))err(label,'invalid format');if(!STATUS.includes(q.status))err(label,'invalid status');
  if(typeof q.promptJa!=='string'||!q.promptJa.trim())err(label,'prompt required');
  if(q.format==='dialogue'&&!String(q.promptJa).includes('____'))err(label,'dialogue prompt needs a blank (____)');
  if(typeof q.reasonJa!=='string'||!q.reasonJa.trim())err(label,'reason required');
  const choices=q.choices;
  if(!Array.isArray(choices)||choices.length!==4){err(label,'four choices required');continue;}
  const ids=choices.map(c=>c.id),texts=choices.map(c=>String(c.text||'').trim().toLowerCase());
  if(new Set(ids).size!==4||ids.some(x=>!x))err(label,'four unique choice IDs required');
  if(new Set(texts).size!==4||texts.some(x=>!x))err(label,'four distinct choice texts required');
  for(const c of choices)if(c.expressionId&&!byId.has(c.expressionId))err(label,`choice ${c.id} points to an unknown expression`);
  if(q.format==='order'){
   const order=q.correctOrder;
   if(!Array.isArray(order)||order.length!==4||new Set(order).size!==4||order.some(x=>!ids.includes(x)))err(label,'correctOrder must list the four choice IDs');
   else{
    const ranks=order.map(id=>byId.get(choices.find(c=>c.id===id)?.expressionId)?.politenessRank);
    if(ranks.some(r=>!Number.isInteger(r)))err(label,'every choice of an ordering question must be an expression');
    else if(ranks.some((r,i)=>i>0&&r<=ranks[i-1]))err(label,`correct order is not strictly casual-to-polite (ranks ${ranks.join(',')})`);
    if(order.every((id,i)=>id===ids[i]))err(label,'choices are already in the correct order');
    if(!q.notesJa||order.some(id=>typeof q.notesJa[id]!=='string'||!q.notesJa[id].trim()))err(label,'a note for every choice is required');
   }
  }else{
   if(!ids.includes(q.answerId))err(label,'answerId must be one of the choices');
   const wrong=ids.filter(id=>id!==q.answerId);
   if(!q.whyNotJa||wrong.some(id=>typeof q.whyNotJa[id]!=='string'||!q.whyNotJa[id].trim()))err(label,'a reason why each other choice does not fit is required');
   if(q.whyNotJa&&q.answerId in q.whyNotJa)err(label,'the correct choice must not have a why-not reason');
   if(anchor&&q.format!=='dialogue'&&!choices.some(c=>c.expressionId===anchor.id))err(label,'the anchor expression must be one of the choices');
   if(anchor&&q.format==='tone'&&choices.find(c=>c.id===q.answerId)?.expressionId!==anchor.id)err(label,'the answer of a tone question must be its anchor expression');
   if(anchor&&['scene','dialogue'].includes(q.format)&&choices.find(c=>c.id===q.answerId)?.expressionId!==anchor.id)err(label,'the answer must be its anchor expression');
   for(const c of choices)if(!c.expressionId)err(label,`choice ${c.id} should be an expression of the function`);
   if(anchor)for(const c of choices)if(c.expressionId&&byId.get(c.expressionId)?.functionId!==anchor.functionId)err(label,`choice ${c.id} belongs to another function`);
  }
 }
 for(const f of functions.values()){
  const qs=questions.filter(q=>byId.get(q.expressionId)?.functionId===f.id);
  if(qs.length<MIN_QUESTIONS_PER_FUNCTION)err(f.id,`${qs.length} questions (need at least ${MIN_QUESTIONS_PER_FUNCTION})`);
  for(const e of items.filter(x=>x.functionId===f.id))if(!qs.some(q=>q.expressionId===e.id))err(e.id,'no practice question');
 }
 return {errors,material,questionMaterial,text,questionText};
}
module.exports={validateExpressions,levelOfRank};
if(require.main===module){const r=validateExpressions();r.errors.forEach(e=>console.error(e));console.log(`expressions: ${r.material.items.length} expressions, ${r.questionMaterial.items.length} questions, ${r.errors.length} errors`);process.exit(r.errors.length?1:0);}
