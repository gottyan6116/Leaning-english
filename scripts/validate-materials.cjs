const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const result=spawnSync(process.execPath,[path.join(__dirname,'validate-articles.cjs'),...(process.argv.includes('--write')?['--report']:[])],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const {validateItem}=require('../quiz-core.js'),entries=[],ids=new Set(),heads=new Set(),errors=[],articles=[],vocabularyRefs=[],wordIndex={},generated=[],searchRows=[];
const json=x=>JSON.stringify(x,null,2)+'\n',hash=text=>crypto.createHash('sha256').update(text).digest('hex');
function artifact(relative,text){generated.push([relative,text]);return{path:relative,sha256:hash(text)};}
for(const folder of ['vocabulary','articles'])for(const file of fs.readdirSync(path.join(root,'materials',folder)).filter(x=>x.endsWith('.json')&&x!=='index.json'&&!(folder==='vocabulary'&&x==='genres.json'))){
 const relative=`materials/${folder}/${file}`,destination=path.join(root,relative),raw=fs.readFileSync(destination,'utf8'),text=raw.replace(/\r\n/g,'\n'),material=JSON.parse(text);
 // Git publishes LF via .gitattributes. Keep the local server and hashes identical too.
 if(raw!==text){if(process.argv.includes('--write'))fs.writeFileSync(destination,text);else errors.push(`Material uses CRLF: ${relative}. Regenerate with --write before importing.`);}
 if(ids.has(material.id))errors.push(`Duplicate material ID: ${material.id}`);ids.add(material.id);
 if(material.publishedAt!==null&&(!/(Z|[+-]\d\d:\d\d)$/.test(material.publishedAt)||!Number.isFinite(Date.parse(material.publishedAt))))errors.push(`Invalid publication date: ${file}`);
 if(folder==='vocabulary'){
  // Detailed word-set rules (word lists, distractors, lengths) live in validate-wordbook.cjs.
  for(const item of material.items||[]){if(ids.has(item.id))errors.push(`Duplicate word ID: ${item.id}`);ids.add(item.id);}
 }
 if(material.publishedAt){entries.push({id:material.id,kind:material.kind,version:material.version,publishedAt:material.publishedAt,path:relative,sha256:hash(text)});
  if(folder==='articles'){
   const metadata=Object.fromEntries(['id','kind','status','version','publishedAt','title','summaryJa','category','level','readingMinutes','photo'].map(k=>[k,material[k]]));metadata.sourcePublishedAt=material.sources[0].publishedAt;metadata.articlePath=relative;articles.push(metadata);searchRows.push({id:material.id,searchText:[material.title,material.summaryJa,material.category,...material.vocabulary.flatMap(v=>[v.headword,v.meaning])].join(" ")});
   const items=material.vocabulary.map(v=>({...v,sourceKind:'article',articleId:material.id,materialVersion:material.version}));for(const item of items){if(!validateItem(item))errors.push(`Invalid article vocabulary ${item.id}`);if(ids.has(item.id))errors.push(`Duplicate word ID ${item.id}`);ids.add(item.id);wordIndex[item.id]={articleId:material.id};}
   const ref=artifact(`materials/article-vocabulary/${file}`,json({id:material.id,version:material.version,kind:'article-vocabulary',publishedAt:material.publishedAt,items}));vocabularyRefs.push({id:material.id,version:material.version,...ref});
  }
 }
}
const collocations=require('./validate-collocations.cjs').validateCollocations(new Set(Object.keys(wordIndex)));
errors.push(...collocations.errors);collocations.warnings.forEach(w=>console.warn('warning: '+w));
{const rawFile=require('./validate-collocations.cjs').file,raw=fs.readFileSync(rawFile,'utf8');if(raw!==collocations.text){if(process.argv.includes('--write'))fs.writeFileSync(rawFile,collocations.text);else errors.push('Collocation material uses CRLF. Regenerate with --write before importing.');}}
const wordbook=require('./validate-wordbook.cjs').validateWordbook();
errors.push(...wordbook.errors);wordbook.warnings.forEach(w=>console.warn('warning: '+w));
{const rawFile=require('./validate-wordbook.cjs').genresFile,raw=fs.readFileSync(rawFile,'utf8');if(raw!==wordbook.genreText){if(process.argv.includes('--write'))fs.writeFileSync(rawFile,wordbook.genreText);else errors.push('Genre material uses CRLF. Regenerate with --write before importing.');}}
const genresRef={id:wordbook.genreMaterial.id,version:wordbook.genreMaterial.version,path:'materials/vocabulary/genres.json',sha256:hash(wordbook.genreText)};
const listening=require('./validate-listening.cjs').validateListening();
errors.push(...listening.errors);
{const rawFile=require('./validate-listening.cjs').file,raw=fs.readFileSync(rawFile,'utf8');if(raw!==listening.text){if(process.argv.includes('--write'))fs.writeFileSync(rawFile,listening.text);else errors.push('Listening material uses CRLF. Regenerate with --write before importing.');}}
const listeningRef={id:listening.material.id,version:listening.material.version,path:'materials/listening/listening-items.json',sha256:hash(listening.text)};
const collocationRef={id:collocations.material.id,version:collocations.material.version,path:'materials/collocations/article-collocations.json',sha256:hash(collocations.text)};
if(errors.length){errors.forEach(e=>console.error(e));process.exit(1);}
articles.sort((a,b)=>Date.parse(b.sourcePublishedAt)-Date.parse(a.sourcePublishedAt)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.id.localeCompare(b.id));
const articleIndex=artifact('materials/articles/index.json',json({id:'article-index',version:1,articles}));
const articleSearch=artifact('materials/search/article-index.json',json({id:'article-search',version:1,articles:searchRows.sort((a,b)=>a.id.localeCompare(b.id))}));
const content=json({version:2,articleSearch:{id:'article-search',version:1,...articleSearch},materials:entries.sort((a,b)=>a.id.localeCompare(b.id)),articleIndex:{id:'article-index',version:1,...articleIndex},articleVocabulary:vocabularyRefs.sort((a,b)=>a.id.localeCompare(b.id)),collocations:collocationRef,genres:genresRef,listening:listeningRef,wordIndex});generated.push(['materials/manifest.json',content]);
for(const [relative,text] of generated){const destination=path.join(root,relative);if(process.argv.includes('--write')){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,text);}else if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==text){console.error(`Generated catalog missing or stale: ${relative}. Validate and regenerate before importing.`);process.exit(1);}}
console.log(`Material import validation: ${entries.length} materials / 0 errors; metadata and vocabulary ${process.argv.includes('--write')?'generated':'match verified JSON'}`);
