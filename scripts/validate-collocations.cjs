const fs=require('node:fs'),path=require('node:path');
const Core=require('../collocation-core.js');
const file=path.join(__dirname,'..','materials','collocations','article-collocations.json');
// Returns {errors,warnings,material,text}. wordIds: Set of known article vocabulary IDs.
function validateCollocations(wordIds){
 const errors=[],warnings=[],raw=fs.readFileSync(file,'utf8'),text=raw.replace(/\r\n/g,'\n'),material=JSON.parse(text),ids=new Set(),forms=new Set();
 if(material.id!=='article-collocations'||material.kind!=='collocations'||!Number.isInteger(material.version))errors.push('collocations: invalid header');
 if(!Array.isArray(material.items)||!material.items.length)errors.push('collocations: items required');
 for(const c of material.items||[]){
  errors.push(...Core.validateCollocation(c,wordIds));
  if(ids.has(c.id))errors.push(`${c.id}: duplicate ID`);ids.add(c.id);
  const key=`${c.wordId}|${Core.slug(c.form)}`;if(forms.has(key))errors.push(`${c.id}: duplicate combination for the word`);forms.add(key);
  if(c.fill&&!Core.maskedExample(c))warnings.push(`${c.id}: example does not contain the blanked word; the example is shown after answering`);
  if(c.misuse&&!Core.misuseItem(c,material.items))errors.push(`${c.id}: misuse cannot form a question (needs two sibling combinations)`);
 }
 return {errors,warnings,material,text};
}
module.exports={validateCollocations,file};
if(require.main===module){const r=validateCollocations();r.warnings.forEach(w=>console.warn(w));r.errors.forEach(e=>console.error(e));console.log(`collocations: ${r.material.items.length} items, ${r.errors.length} errors, ${r.warnings.length} warnings`);process.exit(r.errors.length?1:0);}
