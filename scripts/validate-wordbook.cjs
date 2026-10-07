const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),dir=path.join(root,'materials','vocabulary');
const genresFile=path.join(dir,'genres.json');
function csv(file){return fs.readFileSync(path.join(root,'materials/validation',file),'utf8').replace(/^﻿/,'').split(/\r?\n/).slice(1).filter(Boolean).map(l=>{const p=l.split(',');return {head:p[0],pos:p[1],level:p[2]};});}
const LISTS=[csv('cefrj-vocabulary-profile-1.5.csv'),csv('octanove-vocabulary-profile-c1c2-1.0.csv')];
const BSL=new Set(fs.readFileSync(path.join(root,'materials/validation/bsl-1.2-lemmatized-for-teaching.csv'),'utf8').split(/\r?\n/).filter(Boolean).map(l=>l.split(',')[0].trim().toLowerCase()));
const listed=(head,pos,bands)=>LISTS.some(rows=>rows.some(r=>r.head.split('/').includes(head)&&r.pos===pos&&bands.includes(r.level)));
const len=s=>Array.from(String(s).trim()).length;
const Quiz=require('../quiz-core.js');
const MODES=['ja','en','ja_en','def_en'],STATUSES=['unverified','verified'];
// Words of a definition that give the answer away: the headword, its inflections, or a word from the same family
// (shared leading letters; y/i alternation such as apply/application). Short headwords (4 letters or fewer) match inflections only.
function definitionLeaks(headword,definition){
 const norm=w=>{const t=String(w).toLowerCase();return t.endsWith('y')&&t.length>3?t.slice(0,-1)+'i':t;},head=norm(headword),stem=head.slice(0,Math.min(5,head.length));
 return String(definition).toLowerCase().split(/[^a-z]+/).filter(Boolean).filter(token=>{
  const t=norm(token);
  if(head.length<=4)return t===head||(t.startsWith(head)&&t.length<=head.length+3);
  return t.startsWith(stem)||(t.length>=5&&head.startsWith(t.slice(0,5)));
 });
}
// Validates the genre definitions and every word set. Returns {errors,warnings,sets,genres,genreText}.
function validateWordbook(){
 const errors=[],warnings=[],check=(ok,message)=>{if(!ok)errors.push(message);};
 const genreText=fs.readFileSync(genresFile,'utf8').replace(/\r\n/g,'\n'),genreMaterial=JSON.parse(genreText),genres=genreMaterial.genres||[];
 check(genreMaterial.id==='wordbook-genres'&&genreMaterial.kind==='genres'&&Number.isInteger(genreMaterial.version),'genres: invalid header');
 check(genres.length>0&&new Set(genres.map(g=>g.id)).size===genres.length&&new Set(genres.map(g=>g.order)).size===genres.length,'genres: ids and orders must be unique');
 for(const g of genres)check(/^[a-z0-9-]+$/.test(g.id)&&g.name&&Number.isInteger(g.order)&&Array.isArray(g.bands)&&g.bands.length>0&&g.levelRange,`genre ${g.id}: invalid fields`);
 const sets=[],ids=new Set(),heads=new Set(),setIds=new Set(),positions=new Set();
 for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.json')&&x!=='genres.json').sort()){
  const set=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8').replace(/\r\n/g,'\n')),label=`${file}`;sets.push(set);
  const genre=genres.find(g=>g.id===set.genre);
  check(!!genre,`${label}: unknown genre ${set.genre}`);check(set.kind==='vocabulary'&&/^[a-z0-9-]+$/.test(set.id),`${label}: invalid set header`);
  check(!setIds.has(set.id),`${label}: duplicate set ID`);setIds.add(set.id);
  check(Number.isInteger(set.setNumber)&&set.setNumber>=1,`${label}: invalid setNumber`);
  const position=`${set.genre}:${set.setNumber}`;check(!positions.has(position),`${label}: duplicate genre/set number ${position}`);positions.add(position);
  check(Array.isArray(set.items)&&set.items.length===10,`${label}: a set must contain exactly 10 words`);
  const bands=genre?.bands||[];
  for(const w of set.items||[]){
   const id=w.id||'(no id)',L=`${label}/${id}`;
   check(/^vocab-\d{6}$/.test(id),`${L}: invalid word ID`);check(!ids.has(id),`${L}: duplicate word ID`);ids.add(id);
   const headKey=String(w.headword).toLowerCase();check(!heads.has(headKey),`${L}: duplicate headword ${w.headword}`);heads.add(headKey);
   for(const key of ['headword','partOfSpeech','meaning','definition','example','testedSense'])check(typeof w[key]==='string'&&w[key].trim(),`${L}: ${key} required`);
   check(w.genre===set.genre&&w.setNumber===set.setNumber,`${L}: genre/set number must match the set`);
   check(bands.includes(w.level),`${L}: level ${w.level} outside ${bands}`);check(STATUSES.includes(w.status),`${L}: invalid status`);check(w.exampleOrigin==='original-for-this-app',`${L}: example must be original`);
   check(listed(w.headword,w.partOfSpeech,[w.level]),`${L}: ${w.headword}/${w.partOfSpeech}/${w.level} not found in the open word lists`);
   if(set.genre==='business')check(BSL.has(headKey),`${L}: ${w.headword} is not in the Business Service List 1.2`);
   check(w.selectionSource?.listName&&w.selectionSource?.license&&w.selectionSource?.url,`${L}: selection source required`);
   const leaks=definitionLeaks(w.headword,w.definition);check(leaks.length===0,`${L}: the definition contains the headword or a related word (${leaks.join(', ')})`);
   const masked=Quiz.maskExample(w);check(masked!==null&&masked.includes(Quiz.BLANK)&&masked.split(Quiz.BLANK).length===2,`${L}: exampleSurface must occur exactly once in the example`);if(masked!==null)check(masked.replace(Quiz.BLANK,w.exampleSurface).toLowerCase()===w.example.toLowerCase(),`${L}: the blanked example does not restore to the original sentence`);
   const stem=headKey.slice(0,Math.max(3,headKey.length-2));check(w.example.toLowerCase().includes(stem),`${L}: example should contain the headword`);
   for(const mode of MODES){
    const q=w.questions?.[mode],M=`${L}/${mode}`;
    if(!(q&&Array.isArray(q.choices)&&q.choices.length===4)){errors.push(`${M}: four choices required`);continue;}
    check(q.choices.every(x=>typeof x==='string'&&x.trim())&&new Set(q.choices.map(x=>x.trim().toLowerCase())).size===4,`${M}: empty or duplicate choice`);
    check(Number.isInteger(q.answerIndex)&&q.answerIndex>=0&&q.answerIndex<4,`${M}: invalid answer index`);
    check(Array.isArray(q.choiceIds)&&new Set(q.choiceIds).size===4&&q.correctChoiceId===q.choiceIds[q.answerIndex],`${M}: invalid choice IDs`);
    const correct={ja:w.meaning,en:w.definition,ja_en:w.headword,def_en:w.headword}[mode];check(q.choices[q.answerIndex]===correct,`${M}: the marked answer is not the word's own ${mode} value`);
    const lengths=q.choices.map(len),ranked=[...lengths].sort((a,b)=>b-a);
    if(lengths[q.answerIndex]===ranked[0]&&lengths.filter(n=>n===ranked[0]).length===1&&ranked[0]>=ranked[1]*1.2)errors.push(`${M}: correct choice uniquely longest by 20% or more`);
    if(ranked[0]/ranked[3]>3)warnings.push(`${M}: length ratio ${(ranked[0]/ranked[3]).toFixed(2)}`);
    const heads4=q.distractorHeadwords;check(Array.isArray(heads4)&&heads4.length===4&&heads4[q.answerIndex]===null,`${M}: distractorHeadwords must mark the answer slot with null`);
    for(const [i,h] of (heads4||[]).entries()){if(i===q.answerIndex||h===null)continue;check(h!==w.headword,`${M}: distractor equals the answer`);check(listed(h,w.partOfSpeech,bands),`${M}: distractor ${h}/${w.partOfSpeech} is not a same-POS word within ${bands}`);}
    if(mode==='def_en'){check(JSON.stringify(q.choices)===JSON.stringify(w.questions.ja_en?.choices)&&q.answerIndex===w.questions.ja_en?.answerIndex,`${M}: def_en must reuse the ja_en choices`);check(JSON.stringify(q.choiceIds)===JSON.stringify(q.choices.map((_,i)=>`${w.id}-def_en-option-${i+1}`)),`${M}: unexpected choice IDs`);}
    if(mode==='ja_en'||mode==='def_en')check(JSON.stringify((heads4||[]).filter(Boolean))===JSON.stringify(q.choices.filter((_,i)=>i!==q.answerIndex)),`${M}: ja_en choices must equal the distractor headwords`);
   }
  }
 }
 return {errors,warnings,sets,genres,genreText,genreMaterial};
}
module.exports={validateWordbook,definitionLeaks,genresFile};
if(require.main===module){const r=validateWordbook();r.warnings.forEach(w=>console.warn('warning: '+w));r.errors.forEach(e=>console.error(e));console.log(`wordbook: ${r.genres.length} genres, ${r.sets.length} sets, ${r.sets.reduce((n,s)=>n+s.items.length,0)} words, ${r.errors.length} errors, ${r.warnings.length} warnings`);process.exit(r.errors.length?1:0);}
