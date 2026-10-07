// Writes docs/stage10-wordlist.md: one review sheet of all word sets (read-only view of materials/vocabulary/*.json).
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),dir=path.join(root,'materials','vocabulary');
const genres=JSON.parse(fs.readFileSync(path.join(dir,'genres.json'),'utf8')).genres.sort((a,b)=>a.order-b.order);
const sets=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='genres.json').map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const cell=text=>String(text??'').replace(/\|/g,'\\|').replace(/\n/g,' ');
const marks='①②③④⑤⑥⑦⑧⑨⑩';
let out=`# 第10段階 単語帳一覧（確認用）\n\n元データ：materials/vocabulary/*.json（${sets.length}セット、${sets.reduce((n,s)=>n+s.items.length,0)}語）。この一覧は自動生成です。直接編集せず、元データを直してから再生成します（\`node scripts/export-wordbook-list.cjs\`）。\n\n- 語・品詞・レベルは CEFR-J v1.5 / Octanove C1/C2 v1.0（ビジネスはさらに BSL 1.2）と機械照合済み。\n- 誤答は、同じジャンルの同じ品詞の語、または同じ品詞・同じレベル帯の語です。✓の位置は出題ごとに入れ替わります。\n- 状態はすべて unverified です。verified への変更はユーザーが元データで行います。\n`;
for(const g of genres){
 for(const set of sets.filter(s=>s.genre===g.id).sort((a,b)=>a.setNumber-b.setNumber)){
  out+=`\n## ${g.name} ${marks[set.setNumber-1]}（${set.id}・${g.levelRange}）\n\n| 語 | 品詞 | Lv | 訳 | 英英定義 | 例文 | 誤答の語 | 状態 |\n|---|---|---|---|---|---|---|---|\n`;
  for(const w of set.items){
   const q=w.questions.ja,wrong=q.distractorHeadwords.filter(Boolean).map((h,i)=>`${h}（${q.choices.filter((_,j)=>j!==q.answerIndex)[i]}）`).join('、');
   out+=`| ${cell(w.headword)} | ${cell(w.partOfSpeech)} | ${cell(w.level)} | ${cell(w.meaning)} | ${cell(w.definition)} | ${cell(w.example)} | ${cell(wrong)} | ${w.status==='verified'?'確認済み':'確認中'} |\n`;
  }
 }
}
fs.writeFileSync(path.join(root,'docs/stage10-wordlist.md'),out);console.log('wrote docs/stage10-wordlist.md');
