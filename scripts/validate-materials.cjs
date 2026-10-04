const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const result=spawnSync(process.execPath,[path.join(__dirname,'validate-articles.cjs')],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const {validateItem}=require('../quiz-core.js'),entries=[],ids=new Set(),heads=new Set(),errors=[];
for(const folder of ['vocabulary','articles'])for(const file of fs.readdirSync(path.join(root,'materials',folder)).filter(x=>x.endsWith('.json'))){
 const relative=`materials/${folder}/${file}`,text=fs.readFileSync(path.join(root,relative),'utf8'),material=JSON.parse(text);
 if(ids.has(material.id))errors.push(`Duplicate material ID: ${material.id}`);ids.add(material.id);
 if(material.publishedAt!==null&&(!/(Z|[+-]\d\d:\d\d)$/.test(material.publishedAt)||!Number.isFinite(Date.parse(material.publishedAt))))errors.push(`Invalid publication date: ${file}`);
 if(folder==='vocabulary'){
  if(!['B2','C1','C2'].includes(material.level)||!Number.isInteger(material.unitNumber)||material.items?.length!==10)errors.push(`Invalid unit: ${file}`);
  for(const item of material.items||[]){if(!validateItem(item))errors.push(`Invalid bilingual item: ${item.id}`);if(ids.has(item.id))errors.push(`Duplicate word ID: ${item.id}`);ids.add(item.id);const head=item.headword.toLowerCase();if(heads.has(head))errors.push(`Duplicate unit headword: ${head}`);heads.add(head);
   for(const mode of ['ja','en']){const q=item.questions[mode];if(!q.choiceIds||new Set(q.choiceIds).size!==4||q.correctChoiceId!==q.choiceIds[q.answerIndex])errors.push(`Invalid choice IDs: ${item.id}/${mode}`);const lengths=q.choices.map(x=>Array.from(x.trim()).length),rank=[...lengths].sort((a,b)=>b-a);if(lengths[q.answerIndex]===rank[0]&&lengths.filter(n=>n===rank[0]).length===1&&rank[0]>=rank[1]*1.2)errors.push(`Correct choice too long: ${item.id}/${mode}`);}
  }
 }
 if(material.publishedAt)entries.push({id:material.id,kind:material.kind,version:material.version,publishedAt:material.publishedAt,path:relative,sha256:crypto.createHash('sha256').update(text).digest('hex')});
}
if(errors.length){errors.forEach(e=>console.error(e));process.exit(1);}
const content=JSON.stringify({version:1,materials:entries.sort((a,b)=>a.id.localeCompare(b.id))},null,2)+'\n',destination=path.join(root,'materials/manifest.json');
if(process.argv.includes('--write'))fs.writeFileSync(destination,content);else if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==content){console.error('Manifest is missing or stale. Validate and regenerate before importing.');process.exit(1);}
console.log(`Material import validation: ${entries.length} materials / 0 errors; manifest ${process.argv.includes('--write')?'generated':'matches verified JSON'}`);
