(function(){
 'use strict';
 // Listening: the three earlier passages plus the passages in materials/listening (loaded through MaterialCatalog).
 let currentId=null;
 const legacy=()=>lessons.map((lesson,index)=>({id:'legacy-'+index,title:lesson.title,genre:lesson.genre,level:'B2–C1',text:lesson.text,question:{promptJa:`“${words[lesson.word].en}” の意味は？`,choices:[words[lesson.word].ja,'一時的な','曖昧な'],answerIndex:0}}));
 const fromCatalog=()=>(window.MaterialCatalog?.listening?.()||[]).map(item=>({id:item.id,title:item.title,genre:item.genre,level:item.level,text:item.text,question:{promptJa:item.question.promptJa,choices:item.question.choices,answerIndex:item.question.answerIndex}}));
 const items=()=>[...legacy(),...fromCatalog()];
 const current=()=>{const all=items();return all.find(x=>x.id===currentId)||all[0];};
 function select(id){stopAudio();currentId=id;render();window.scrollTo(0,0);}
 function answer(index){const q=current().question;toast(index===q.answerIndex?'正解です！':'もう一度、聴いてみましょう');}
 listening=function(){
  const item=current(),all=items();
  return `<div class="eyebrow">LISTEN & PRACTICE</div><h1>英語のリズムを、耳から。</h1><div class="tabs">${['自由練習','問題'].map(m=>`<button class="${listeningMode===m?'active':''}" onclick="listeningMode='${m}';render()">${m}モード</button>`).join('')}</div><div class="player"><div class="eyebrow">${esc(item.genre)} · ${esc(item.level)}</div><h2>${esc(item.title)}</h2><button class="play" aria-label="${playing?'停止':'音声を再生'}" onclick="toggleAudio()">${playing?'Ⅱ':'▶'}</button><p>${playing?'再生中':'聴いて、声に出してみましょう'}</p><label>再生速度 <select id="rate" aria-label="再生速度"><option value="0.8">0.8倍</option><option selected value="1">1.0倍</option><option value="1.2">1.2倍</option></select></label></div>${listeningMode==='問題'?`<section class="section"><h2>${esc(item.question.promptJa)}</h2><div class="choices section">${item.question.choices.map((a,i)=>`<button class="choice" onclick="ListeningUI.answer(${i})">${esc(a)}</button>`).join('')}</div></section>`:''}<details class="transcript"><summary>英文を確認する</summary>${item.text.map(p=>`<p>${esc(p)}</p>`).join('')}</details><section class="section ls-list" aria-label="教材を選ぶ"><h2>教材を選ぶ</h2><div class="vocabulary-group">${all.map(x=>`<button class="vocabulary-row" onclick="ListeningUI.select('${esc(x.id)}')" ${x.id===item.id?'aria-current="true"':''}><span class="vocabulary-label"><strong>${esc(x.title)}</strong><small>${esc(x.genre)} · ${esc(x.level)}</small></span>${x.id===item.id?'<span class="ls-now" role="img" aria-label="選択中">✓</span>':'<span class="action-chevron" aria-hidden="true">›</span>'}</button>`).join('')}</div></section>`;
 };
 toggleAudio=function(){
  if(playing){stopAudio();render();return;}
  if(!('speechSynthesis'in window)){toast('このブラウザは音声読み上げに対応していません');return;}
  const rate=Number(document.getElementById('rate').value),u=new SpeechSynthesisUtterance(current().text.join(' '));
  u.lang='en-US';u.rate=rate;u.onend=()=>{playing=false;if(view==='listen')render();};u.onerror=()=>{playing=false;if(view==='listen')render();toast('音声を再生できませんでした');};
  playing=true;window.speechSynthesis.speak(u);render();document.getElementById('rate').value=String(rate);
 };
 window.ListeningUI={select,answer,items,current};
})();
