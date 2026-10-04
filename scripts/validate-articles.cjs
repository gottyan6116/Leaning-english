const fs=require('node:fs');
const path=require('node:path');
const directory=path.join(__dirname,'../materials/articles');
const errors=[],warnings=[],ids=new Set();
function check(ok,message){if(!ok)errors.push(message);}
function question(q,label,mode){
 const choices=q?.choices;
 check(Array.isArray(choices)&&choices.length===4,`${label}: four choices required`);
 if(!Array.isArray(choices)||choices.length!==4)return;
 check(choices.every(x=>typeof x==='string'&&x.trim()),`${label}: empty choice`);
 check(new Set(choices.map(x=>x.trim().toLowerCase())).size===4,`${label}: duplicate choice`);
 check(Number.isInteger(q.answerIndex)&&q.answerIndex>=0&&q.answerIndex<4,`${label}: invalid answer`);
 const lengths=choices.map(x=>Array.from(x.trim()).length),ranked=[...lengths].sort((a,b)=>b-a);
 if(lengths[q.answerIndex]===ranked[0]&&lengths.filter(x=>x===ranked[0]).length===1&&ranked[0]>=ranked[1]*1.2)errors.push(`${label}: correct answer uniquely longest by 20% or more`);
 const ratio=ranked[0]/ranked[ranked.length-1];
 if(ratio>(mode==='ja'?2.5:1.5))warnings.push(`${label}: length ratio ${ratio.toFixed(2)}`);
}
for(const file of fs.readdirSync(directory).filter(x=>x.endsWith('.json'))){
 const article=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
 check(!ids.has(article.id),`${file}: duplicate article ID`);ids.add(article.id);
 check(article.kind==='article',`${file}: invalid kind`);
 const paragraphIds=new Set(article.paragraphs.map(x=>x.id));
 check(paragraphIds.size===article.paragraphs.length,`${file}: duplicate paragraph ID`);
 const sourceIds=new Set(article.sources.map(x=>x.id));
 for(const p of article.paragraphs){check(p.kind==='editorial'||p.sourceIds.length>0,`${p.id}: missing source`);for(const s of p.sourceIds)check(sourceIds.has(s),`${p.id}: unknown source ${s}`);}
 check(article.vocabulary.length===5,`${file}: five vocabulary items required`);
 for(const v of article.vocabulary){
  check(!ids.has(v.id),`${file}: duplicate vocabulary ID ${v.id}`);ids.add(v.id);
  check(paragraphIds.has(v.contextParagraphId),`${v.id}: unknown context paragraph`);
  check(article.paragraphs.find(p=>p.id===v.contextParagraphId)?.text.includes(v.context),`${v.id}: context does not match text`);
  for(const mode of ['ja','en']){const q=v.questions[mode];question(q,`${v.headword}/${mode}`,mode);check(q?.distractorHeadwords?.length===4&&q.distractorHeadwords.every((x,i)=>i===q.answerIndex?x===null:typeof x==='string'&&x.trim()),`${v.id}/${mode}: distractor origins required`);}
 }
 check(article.comprehension.length===3,`${file}: three comprehension questions required`);
 for(const q of article.comprehension){question(q,q.id,'en');check(q.evidenceParagraphIds.length>0&&q.evidenceParagraphIds.every(id=>paragraphIds.has(id)),`${q.id}: invalid evidence`);}
 check(Boolean(article.opinion?.prompt),`${file}: opinion prompt required`);
 check(article.sources.every(x=>x.url?.startsWith('https://')&&x.title&&x.publisher&&x.publishedAt&&x.checkedAt),`${file}: incomplete source metadata`);
 check(Boolean(article.photo?.photographer&&article.photo.service&&article.photo.licenseUrl&&article.photo.credit),`${file}: missing photo credit`);
 check(article.status!=='draft'||article.publishedAt===null,`${file}: draft must not be published`);
 const wordCount=article.paragraphs.reduce((sum,p)=>sum+p.text.trim().split(/\s+/).length,0);
 console.log(`${file}: ${wordCount} words; 5 vocabulary items / 10 bilingual questions / 3 comprehension questions`);
}
for(const warning of warnings)console.log(`WARNING: ${warning}`);
for(const error of errors)console.error(`ERROR: ${error}`);
console.log(`Validation: ${errors.length} errors, ${warnings.length} warnings`);
if(errors.length)process.exitCode=1;
