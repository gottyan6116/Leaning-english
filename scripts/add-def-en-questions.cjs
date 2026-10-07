// One-time: adds `exampleSurface` and the `def_en` (definition -> English) question to every word of the existing sets.
// The def_en choices reuse the ja_en choices (same words, same position of the answer); IDs follow `<wordId>-def_en-option-N`.
// Re-running is safe: words that already have def_en are left alone.
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','materials','vocabulary');
const IRREGULAR={catch:['caught'],forget:['forgot','forgotten'],send:['sent'],win:['won'],lay:['laid'],make:['made'],repay:['repaid']};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function surfaceOf(word){
 const h=word.headword,b=esc(h),last=b.slice(-1),stem=h.endsWith('e')?esc(h.slice(0,-1)):b,stemY=h.endsWith('y')?esc(h.slice(0,-1)):null;
 const alts=[b+'(?:s|es|ed|d|ing)?',b+last+'(?:ed|ing)',stem+'(?:ed|ing|er|ers)',...(stemY?[stemY+'(?:ies|ied|ying)']:[]),...(IRREGULAR[h]||[])];
 const found=word.example.match(new RegExp('\\b(?:'+alts.join('|')+')\\b','gi'));
 if(!found||found.length!==1)throw Error(`cannot find exactly one surface form of ${h} in: ${word.example}`);
 return found[0];
}
let changed=0;
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='genres.json').sort()){
 const full=path.join(dir,file),set=JSON.parse(fs.readFileSync(full,'utf8'));let touched=false;
 set.items=set.items.map(word=>{
  if(word.questions.def_en&&word.exampleSurface)return word;
  touched=true;
  const je=word.questions.ja_en,def={choices:[...je.choices],answerIndex:je.answerIndex,choiceIds:je.choices.map((_,i)=>`${word.id}-def_en-option-${i+1}`),correctChoiceId:null,distractorHeadwords:[...je.distractorHeadwords]};
  def.correctChoiceId=def.choiceIds[def.answerIndex];
  const next={};for(const [key,value] of Object.entries(word)){next[key]=value;if(key==='example')next.exampleSurface=surfaceOf(word);}
  next.questions={...word.questions,def_en:def};return next;
 });
 if(touched){set.version+=1;fs.writeFileSync(full,JSON.stringify(set,null,2)+'\n');changed++;}
}
console.log(`${changed} set files updated`);
