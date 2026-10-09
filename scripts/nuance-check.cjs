// Detects a collocation nuance (nuanceJa) that only rephrases the Japanese meaning (meaningJa).
// A nuance must carry at least one of: a contrast with similar expressions, a register/situation,
// or typical co-occurring words (an English expression counts as one).
const strip=text=>String(text).replace(/[「」『』、。・（）()\s]/g,'');
function bigrams(text){const t=strip(text),set=new Set();for(let i=0;i<t.length-1;i++)set.add(t.slice(i,i+2));return set;}
function containment(a,b){const A=bigrams(a),B=bigrams(b);if(!A.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/A.size;}
const CONTRAST=['より','ではなく','ほど','違い','対し','一方','とは異なる','と比べ','に近い','よりも','かわり','代わり'];
const REGISTER=['改まっ','日常','会話','書き言葉','話し言葉','フォーマル','カジュアル','報道','ニュース','論文','ビジネス','契約','口語','丁寧','くだけ','公的','学術','広告','メール','堅い'];
const COOCCUR=['よく','後ろに','前に','と一緒','と並','と組み','続く','伴う','結び付'];
const has=(text,list)=>list.some(word=>text.includes(word));
// Returns null when the nuance is informative, otherwise 'template' (certain), 'paraphrase' or 'no-information' (candidates for review).
function check(c){
 const n=String(c.nuanceJa||'');
 if(n===`「${c.meaningJa}」という場面で用いる組み合わせ。`)return 'template';
 const info=has(n,CONTRAST)||has(n,REGISTER)||has(n,COOCCUR)||/[A-Za-z]{2,}/.test(n);
 if(info)return null;
 return containment(n,c.meaningJa)>=0.5?'paraphrase':'no-information';
}
module.exports={check};
