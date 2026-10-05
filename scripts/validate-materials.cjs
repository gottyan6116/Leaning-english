const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const result=spawnSync(process.execPath,[path.join(__dirname,'validate-articles.cjs'),...(process.argv.includes('--write')?['--report']:[])],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const {validateItem}=require('../quiz-core.js'),entries=[],ids=new Set(),heads=new Set(),errors=[],articles=[],vocabularyRefs=[],wordIndex={},generated=[],searchRows=[];
const json=x=>JSON.stringify(x,null,2)+'\n',hash=text=>crypto.createHash('sha256').update(text).digest('hex');
function artifact(relative,text){generated.push([relative,text]);return{path:relative,sha256:hash(text)};}
for(const folder of ['vocabulary','articles'])for(const file of fs.readdirSync(path.join(root,'materials',folder)).filter(x=>x.endsWith('.json')&&x!=='index.json')){
 const relative=`materials/${folder}/${file}`,destination=path.join(root,relative),raw=fs.readFileSync(destination,'utf8'),text=raw.replace(/\r\n/g,'\n'),material=JSON.parse(text);
 // Git publishes LF via .gitattributes. Keep the local server and hashes identical too.
 if(raw!==text){if(process.argv.includes('--write'))fs.writeFileSync(destination,text);else errors.push(`Material uses CRLF: ${relative}. Regenerate with --write before importing.`);}
 if(ids.has(material.id))errors.push(`Duplicate material ID: ${material.id}`);ids.add(material.id);
 if(material.publishedAt!==null&&(!/(Z|[+-]\d\d:\d\d)$/.test(material.publishedAt)||!Number.isFinite(Date.parse(material.publishedAt))))errors.push(`Invalid publication date: ${file}`);
 if(folder==='vocabulary'){
  if(!['B2','C1','C2'].includes(material.level)||!Number.isInteger(material.unitNumber)||material.items?.length!==10)errors.push(`Invalid unit: ${file}`);
  for(const item of material.items||[]){if(!validateItem(item))errors.push(`Invalid bilingual item: ${item.id}`);if(ids.has(item.id))errors.push(`Duplicate word ID: ${item.id}`);ids.add(item.id);const head=item.headword.toLowerCase();if(heads.has(head))errors.push(`Duplicate unit headword: ${head}`);heads.add(head);
   for(const mode of ['ja','en']){const q=item.questions[mode];if(!q.choiceIds||new Set(q.choiceIds).size!==4||q.correctChoiceId!==q.choiceIds[q.answerIndex])errors.push(`Invalid choice IDs: ${item.id}/${mode}`);const lengths=q.choices.map(x=>Array.from(x.trim()).length),rank=[...lengths].sort((a,b)=>b-a);if(lengths[q.answerIndex]===rank[0]&&lengths.filter(n=>n===rank[0]).length===1&&rank[0]>=rank[1]*1.2)errors.push(`Correct choice too long: ${item.id}/${mode}`);}
  }
 }
 if(material.publishedAt){entries.push({id:material.id,kind:material.kind,version:material.version,publishedAt:material.publishedAt,path:relative,sha256:hash(text)});
  if(folder==='articles'){
   const metadata=Object.fromEntries(['id','kind','status','version','publishedAt','title','summaryJa','category','level','readingMinutes','photo'].map(k=>[k,material[k]]));metadata.sourcePublishedAt=material.sources[0].publishedAt;metadata.articlePath=relative;articles.push(metadata);searchRows.push({id:material.id,searchText:[material.title,material.summaryJa,material.category,...material.vocabulary.flatMap(v=>[v.headword,v.meaning])].join(" ")});
   const items=material.vocabulary.map(v=>({...v,sourceKind:'article',articleId:material.id,materialVersion:material.version}));for(const item of items){if(!validateItem(item))errors.push(`Invalid article vocabulary ${item.id}`);if(ids.has(item.id))errors.push(`Duplicate word ID ${item.id}`);ids.add(item.id);wordIndex[item.id]={articleId:material.id};}
   const ref=artifact(`materials/article-vocabulary/${file}`,json({id:material.id,version:material.version,kind:'article-vocabulary',publishedAt:material.publishedAt,items}));vocabularyRefs.push({id:material.id,version:material.version,...ref});
  }
 }
}
if(errors.length){errors.forEach(e=>console.error(e));process.exit(1);}
articles.sort((a,b)=>Date.parse(b.sourcePublishedAt)-Date.parse(a.sourcePublishedAt)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.id.localeCompare(b.id));
const articleIndex=artifact('materials/articles/index.json',json({id:'article-index',version:1,articles}));
const articleSearch=artifact('materials/search/article-index.json',json({id:'article-search',version:1,articles:searchRows.sort((a,b)=>a.id.localeCompare(b.id))}));
const content=json({version:2,articleSearch:{id:'article-search',version:1,...articleSearch},materials:entries.sort((a,b)=>a.id.localeCompare(b.id)),articleIndex:{id:'article-index',version:1,...articleIndex},articleVocabulary:vocabularyRefs.sort((a,b)=>a.id.localeCompare(b.id)),wordIndex});generated.push(['materials/manifest.json',content]);
for(const [relative,text] of generated){const destination=path.join(root,relative);if(process.argv.includes('--write')){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,text);}else if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==text){console.error(`Generated catalog missing or stale: ${relative}. Validate and regenerate before importing.`);process.exit(1);}}
console.log(`Material import validation: ${entries.length} materials / 0 errors; metadata and vocabulary ${process.argv.includes('--write')?'generated':'match verified JSON'}`);
