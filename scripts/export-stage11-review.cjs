// Writes docs/stage11-review.md: review sheet for the stage 11 content (new sets 4-6 and the def_en question of sets 1-3).
// The mark column flags words whose "definition -> English" question needs a human look: another choice, put into the
// blanked sentence, can still read as a grammatical sentence, so only the meaning decides which choice is right.
const fs=require('node:fs'),path=require('node:path');
const Quiz=require('../quiz-core.js');
const root=path.join(__dirname,'..'),dir=path.join(root,'materials','vocabulary');
const genres=JSON.parse(fs.readFileSync(path.join(dir,'genres.json'),'utf8')).genres.sort((a,b)=>a.order-b.order);
const sets=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='genres.json').map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const cell=text=>String(text??'').replace(/\|/g,'\\|').replace(/\n/g,' ');
const marks='①②③④⑤⑥';
const vowel=w=>/^[aeiou]/i.test(w);
// Re-applies the inflection of the surface form to another word (null when the surface form is irregular).
function inflect(head,surface,other){
 const h=head.toLowerCase(),s=surface.toLowerCase();
 if(s===h)return other;
 for(const suffix of ['ing','ed','es','s','d','er','ers']){
  if(s===h+suffix||s===h.slice(0,-1)+suffix&&h.endsWith('e'))return suffix==='d'||/e$/.test(other)&&['ing','ed','er','ers'].includes(suffix)?other.replace(/e$/,'')+(suffix==='d'?'d':suffix):other+suffix;
  if(['ing','ed'].includes(suffix)&&s===h+h.slice(-1)+suffix)return other+other.slice(-1)+suffix;
 }
 if(h.endsWith('y')&&(s===h.slice(0,-1)+'ied'||s===h.slice(0,-1)+'ies'))return other.endsWith('y')?other.slice(0,-1)+s.slice(h.length-1):null;
 return null;
}
function substitutions(word){
 const masked=Quiz.maskExample(word),out=[];
 const q=word.questions.def_en;
 for(const [i,choice] of q.choices.entries()){
  if(i===q.answerIndex)continue;
  const form=inflect(word.headword,word.exampleSurface,choice);if(form===null)continue;
  const before=masked.slice(0,masked.indexOf('___')).trim().split(/\s+/).pop()||'';
  if(/^an?$/i.test(before)&&(before.toLowerCase()==='an')!==vowel(form))continue; // a/an clash: cannot be grammatical
  const filled=masked.replace('___',form);out.push(filled);
 }
 return out;
}
let count=0,marked=0;
let out=`# 第11段階 確認用一覧（全300語）\n\n元データ：materials/vocabulary/*.json。この一覧は自動生成です。直接編集せず、元データを直してから再生成します（\`node scripts/export-stage11-review.cjs\`）。\n\n- 区分「新規」は今回作った④〜⑥の150語、「追加」は既存①〜③の150語に「定義→英」の問題と空欄の例文（exampleSurface）を追加した分です（既存の訳・定義・例文・誤答は変更していません）。\n- 目視：★は、他の選択肢を空欄に入れても文として読める（文法上成り立つ）語です。意味で正解が1つに決まるかを見てください。「他の選択肢を入れた文」に、その文を載せています。-は、他の選択肢が文法上成り立たない語です。\n- 選択肢は ✓ が正解。実際の出題では毎回並びが入れ替わります。状態はすべて unverified です。\n- 4形式：英→日（ja）、英→英（en：定義文）、日→英（ja_en）、定義→英（def_en：定義を見て英単語を選ぶ）。\n`;
for(const g of genres){
 for(const set of sets.filter(s=>s.genre===g.id).sort((a,b)=>a.setNumber-b.setNumber)){
  out+=`\n## ${g.name} ${marks[set.setNumber-1]}（${set.id}・${g.levelRange}・${set.setNumber>=4?'新規':'追加'}）\n\n| 語 | 品詞 | 訳 | 定義 | 空欄の例文 | 英→日 | 英→英 | 日→英 | 定義→英 | 目視 | 他の選択肢を入れた文 |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for(const w of set.items){
   const show=q=>q.choices.map((c,i)=>i===q.answerIndex?c+' ✓':c).join(' / ');
   const subs=substitutions(w);count++;if(subs.length)marked++;
   out+=`| ${cell(w.headword)} | ${cell(w.partOfSpeech)} | ${cell(w.meaning)} | ${cell(w.definition)} | ${cell(Quiz.maskExample(w))} | ${cell(show(w.questions.ja))} | ${cell(show(w.questions.en))} | ${cell(show(w.questions.ja_en))} | ${cell(show(w.questions.def_en))} | ${subs.length?'★':'-'} | ${cell(subs.join(' ／ '))} |\n`;
  }
 }
}
fs.writeFileSync(path.join(root,'docs/stage11-review.md'),out);
console.log(`wrote docs/stage11-review.md: ${count} words, ${marked} marked for visual check`);
