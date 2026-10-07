(function(root){
 'use strict';
 const GUEST_KEY='english-notes.ui.guest-choice.v1';
 const CREDENTIAL_ERROR='メールアドレスまたはパスワードが違います';
 const CONNECTION_ERROR='サーバーに接続できません。時間をおいて再度お試しください';
 const labels={answer_logs:'回答履歴',saved_words:'保存した語',preferences:'設定',unit_sessions:'ユニット履歴',article_states:'記事の記録',opinion_drafts:'意見メモ'};
 let dialog=null,view=null,unsubscribe=null,busy=false;
 const backend=()=>root.SupabaseSync;
 const state=()=>backend()?.getState?.()||{enabled:false};
 function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 function guestSelected(){try{return localStorage.getItem(GUEST_KEY)==='true';}catch(_){return false;}}
 function setGuest(value){try{if(value)localStorage.setItem(GUEST_KEY,'true');else localStorage.removeItem(GUEST_KEY);}catch(_){/* A unavailable UI preference does not prevent learning. */}}
 function loginError(error){const code=String(error?.code||'');if(code==='login_failed')return '端末に保存できませんでした。保存領域を確認して再度お試しください';return code==='invalid_credentials'||(!code&&error?.status===401)?CREDENTIAL_ERROR:CONNECTION_ERROR;}
 function close(){dialog?.close();dialog?.remove();dialog=null;view=null;document.body.classList.remove('login-open');}
 function shell(name,login=false,cancelable=false){close();view=name;dialog=node('dialog',undefined,login?'login-screen':'account-screen');dialog.setAttribute('aria-label',login?(name==='nickname'?'ニックネームを設定':'ログイン'):name);document.body.append(dialog);dialog.addEventListener('cancel',event=>{if(login&&!cancelable){event.preventDefault();return;}close();});dialog.showModal();if(login)document.body.classList.add('login-open');return dialog;}
 function button(text,action,cls='account65-text',parent=dialog){const b=node('button',text,cls);b.type='button';b.addEventListener('click',action);parent.append(b);return b;}
 function header(text,back){const h=node('div',undefined,'account65-header');button('‹',back,'account65-back',h).setAttribute('aria-label','戻る');h.append(node('h2',text));dialog.append(h);}
 function message(text){let box=dialog?.querySelector('.account65-error');if(!box&&dialog){box=node('p',undefined,'account65-error');box.setAttribute('role','alert');dialog.append(box);}if(box)box.textContent=text;}
 async function perform(action,failure,onSuccess){if(busy)return;busy=true;const host=dialog;host?.setAttribute('aria-busy','true');host?.querySelectorAll('button').forEach(b=>b.disabled=true);try{const result=await action();if(onSuccess)onSuccess(result);}catch(error){message(typeof failure==='function'?failure(error):failure);}finally{busy=false;if(host===dialog){host?.removeAttribute('aria-busy');host?.querySelectorAll('button').forEach(b=>b.disabled=false);}}}
 function openLogin(){
  if(!state().enabled){setGuest(true);close();return;}
  shell('login',true);
  dialog.append(node('div',undefined,'login-shape login-shape-one'),node('div',undefined,'login-shape login-shape-two'),node('div',undefined,'login-shape login-shape-three'));
  const wrap=node('div',undefined,'login-wrap'),card=node('div',undefined,'login-card');
  card.append(node('p','Bridge','login-brand'),node('h1','ログイン'));
  const form=node('form',undefined,'login-form');form.setAttribute('aria-label','ログイン');form.noValidate=true;
  const emailLabel=node('label','メールアドレス'),email=node('input');email.type='email';email.name='email';email.autocomplete='email';email.required=true;email.id='login-email';emailLabel.htmlFor=email.id;form.append(emailLabel,email);
  const emailError=node('p',undefined,'login-error');emailError.id='login-email-error';emailError.setAttribute('role','alert');emailError.hidden=true;email.setAttribute('aria-describedby',emailError.id);form.append(emailError);
  const passwordLabel=node('label','パスワード'),passwordWrap=node('div',undefined,'login-password'),password=node('input');password.type='password';password.name='password';password.autocomplete='current-password';password.required=true;password.id='login-password';passwordLabel.htmlFor=password.id;passwordWrap.append(password);
  const eye=button('',()=>{const visible=password.type==='password';password.type=visible?'text':'password';eye.setAttribute('aria-label',visible?'パスワードを隠す':'パスワードを表示');eye.setAttribute('aria-pressed',String(visible));},'login-eye',passwordWrap);eye.setAttribute('aria-label','パスワードを表示');eye.setAttribute('aria-pressed','false');eye.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="m4 4 16 16"/></svg>';
  form.append(passwordLabel,passwordWrap);const passwordError=node('p',undefined,'login-error');passwordError.id='login-password-error';passwordError.setAttribute('role','alert');passwordError.hidden=true;password.setAttribute('aria-describedby',passwordError.id);form.append(passwordError);
  const submit=node('button','ログイン','account65-primary');submit.type='submit';form.append(submit);card.append(form);wrap.append(card);
  const guest=button('ログインせずに使う',()=>{if(busy)return;setGuest(true);close();},'login-guest',wrap);wrap.append(node('p','学習記録はこの端末にのみ保存されます','login-note'));dialog.append(wrap);
  for(const [input,error]of [[email,emailError],[password,passwordError]])input.addEventListener('input',()=>{error.hidden=true;input.removeAttribute('aria-invalid');});
  form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;emailError.hidden=true;passwordError.hidden=true;email.removeAttribute('aria-invalid');password.removeAttribute('aria-invalid');let valid=true;if(!email.value.trim()||!email.validity.valid){emailError.textContent='メールアドレスを正しく入力してください';emailError.hidden=false;email.setAttribute('aria-invalid','true');valid=false;}if(!password.value){passwordError.textContent='パスワードを入力してください';passwordError.hidden=false;password.setAttribute('aria-invalid','true');valid=false;}if(!valid){(emailError.hidden?password:email).focus();return;}busy=true;const host=dialog;host.querySelectorAll('input,button').forEach(control=>control.disabled=true);guest.disabled=true;form.setAttribute('aria-busy','true');const secret=password.value;
   try{await backend().login(email.value.trim(),secret);setGuest(false);nicknamePrompted=false;close();if(root.Router)root.Router.restore();else root.go?.('home');promptNickname();}
   catch(error){password.value='';password.type='password';eye.setAttribute('aria-pressed','false');eye.setAttribute('aria-label','パスワードを表示');passwordError.textContent=loginError(error);passwordError.hidden=false;password.setAttribute('aria-invalid','true');}
   finally{busy=false;if(host===dialog){host.querySelectorAll('input,button').forEach(control=>control.disabled=false);guest.disabled=false;}form.removeAttribute('aria-busy');}
  });
 }
 // Nickname: a full-screen entry once per login while it is unset, and an edit row in the account screen.
 let nicknamePrompted=false;
 const nickname=()=>state().user?.nickname||'';
 function afterNicknameSaved(){root.Nickname?.clearLegacyName();close();if(typeof root.render==='function'&&!document.body.classList.contains('quiz-active'))root.render();}
 function openNicknameSetup(){
  shell('nickname',true,true);nicknamePrompted=true;
  dialog.append(node('div',undefined,'login-shape login-shape-one'),node('div',undefined,'login-shape login-shape-two'),node('div',undefined,'login-shape login-shape-three'));
  const wrap=node('div',undefined,'login-wrap'),card=node('div',undefined,'login-card');
  card.append(node('p','Bridge','login-brand'),node('h1','ニックネームを設定'));
  const field=root.Nickname.createField({value:root.Nickname.legacyName(),submitLabel:'はじめる',onSubmit:async value=>{await backend().updateNickname(value);afterNicknameSaved();}});
  card.append(field.element,node('p','ホームなどで表示されます。あとから変更できます。','nickname-note'));wrap.append(card);dialog.append(wrap);field.focus();
 }
 function promptNickname(){const current=state();if(current.user&&!current.user.nickname&&!nicknamePrompted&&root.Nickname)openNicknameSetup();}
 function openNicknameEdit(){
  shell('ニックネーム');header('ニックネーム',openAccount);
  const field=root.Nickname.createField({value:nickname(),submitLabel:'保存',onSubmit:async value=>{await backend().updateNickname(value);afterNicknameSaved();openAccount();}});
  dialog.append(field.element);field.focus();
 }
 function row(text,action){const b=button('',action,'account65-row');b.append(node('span',text),node('span','›','account65-chevron'));return b;}
 function statusLine(){const holder=dialog?.querySelector('[data-account-status]');if(!holder)return;holder.replaceChildren();const current=state();if(!current.user)return;if(['failed','error'].includes(current.status)){holder.append(node('p','同期できませんでした'));button('再試行',()=>perform(async()=>{await backend().resync();if(state().status==='failed')throw Error('sync');},'同期できませんでした'),'account65-text',holder);}else if(current.pendingCount>0){holder.append(node('p','未送信 '+current.pendingCount+'件'));}}
 function openAccount(){shell('アカウント');header('アカウント',close);const current=state();if(current.user){dialog.append(node('p',current.user.email||'','account65-email'));row('ニックネーム：'+(current.user.nickname||'未設定'),openNicknameEdit);const holder=node('div',undefined,'account65-status');holder.dataset.accountStatus='';holder.setAttribute('role','status');dialog.append(holder);statusLine();}else if(current.enabled){row('ログイン',openLogin);}row('学習設定',openSettings);row('データの管理',openData);if(current.user)button('ログアウト',()=>perform(()=>backend().logout(),'ログアウトできませんでした。もう一度お試しください。',()=>{setGuest(false);openLogin();}));button('このアプリについて',openAbout,'account65-about');}
 function openSettings(){shell('学習設定');header('学習設定',openAccount);const settings=root.AppUI?.learningSettings?.()||root.QuizUI?.getStore?.()?.settings||{};const modeLabel=node('label','出題モード','account65-field'),select=node('select');select.name='mode';for(const [value,label]of [['ja','英語 → 日本語'],['ja_en','日本語 → 英語'],['en','英語 → 英語'],['def_en','定義→英']]){const option=node('option',label);option.value=value;select.append(option);}select.value=settings.mode||'ja';modeLabel.append(select);dialog.append(modeLabel);const autoLabel=node('label',undefined,'account65-toggle'),auto=node('input');auto.type='checkbox';auto.name='autoAdvance';auto.checked=settings.autoAdvance!==false;autoLabel.append(node('span','正解したら自動で次へ'),auto);dialog.append(autoLabel);
  function save(){try{root.AppUI.saveLearningSettings({mode:select.value,autoAdvance:auto.checked});dialog.querySelector('.account65-error')?.remove();}catch(_){const restored=root.AppUI.learningSettings();select.value=restored.mode;auto.checked=restored.autoAdvance;message('設定を保存できませんでした。もう一度お試しください。');}}
  select.addEventListener('change',save);auto.addEventListener('change',save);
 }
 function dateLabel(value){const date=new Date(value);return value&&Number.isFinite(date.getTime())?date.toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):null;}
 function download(data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download='english-notes-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function blockedDescription(entry){
  const record=entry.row||{},parts=[labels[entry.table]||'学習記録'];
  const safeText=value=>typeof value==='string'?value.slice(0,240):'';
  if(entry.table==='preferences'){
   const settingLabels={mode:'出題モード',autoAdvance:'自動送り',daily:'日目標',weekly:'週目標'},key=record.setting_key;
   const value=record.value;let display=value===null?'未設定':typeof value==='boolean'?(value?'オン':'オフ'):typeof value==='number'?String(value):key==='mode'?({ja:'英語 → 日本語',en:'英語 → 英語',ja_en:'日本語 → 英語',def_en:'定義→英'}[value]||''):'';
   if(settingLabels[key])parts.push(settingLabels[key]+(display?'：'+display:''));
  }else if(entry.table==='saved_words'){const word=record.payload||{};for(const value of [word.headword||word.en,word.meaning||word.ja])if(safeText(value))parts.push(safeText(value));}
  else if(entry.table==='opinion_drafts'){if(safeText(record.body))parts.push(safeText(record.body));}
  else if(entry.table==='answer_logs'){const all=root.MaterialCatalog?.items?.()||[],word=all.find(item=>item.id===record.word_id);if(word?.headword)parts.push(safeText(word.headword));if(typeof record.correct==='boolean')parts.push(record.correct?'正解':'誤答');}
  else if(entry.table==='unit_sessions'){const unit=root.MaterialCatalog?.units?.().find(item=>item.id===record.unit_id);if(unit)parts.push(unit.level+' '+(['①','②','③','④','⑤'][unit.unitNumber-1]||unit.unitNumber));if(Number.isFinite(record.correct)&&Number.isFinite(record.total))parts.push(record.correct+' / '+record.total);}
  else if(entry.table==='article_states'){const article=root.MaterialCatalog?.articles?.().find(item=>item.id===record.article_id);if(article?.title)parts.push(safeText(article.title));parts.push(record.read?'読了':'未読了');}
  return parts.join(' — ');
 }
 function blockedPanel(){const previous=dialog?.querySelector('.account65-blocked');previous?.remove();const records=backend()?.blockedData?.()||[];if(!records.length)return;const details=node('details',undefined,'account65-blocked');details.append(node('summary','送信できないデータが '+records.length+' 件あります'));for(const entry of records){const item=node('div',undefined,'account65-blocked-item');item.append(node('p',blockedDescription(entry)));button('破棄',()=>{if(busy)return;dialog.querySelector('.account65-discard-confirm')?.remove();const confirm=node('div',undefined,'account65-discard-confirm');confirm.setAttribute('role','group');confirm.setAttribute('aria-label','送信の取り消し確認');confirm.append(node('p','このデータの送信を取り消しますか？学習記録は端末に残ります。'));button('破棄',()=>perform(()=>backend().discardBlocked(entry.table,entry.key,entry.revision),'送信の取り消しができませんでした。もう一度お試しください。',openData),'account65-text',confirm);button('戻る',()=>confirm.remove(),'account65-text',confirm);item.append(confirm);},'account65-text',item);details.append(item);}dialog.append(details);}
 function openData(){shell('データの管理');header('データの管理',openAccount);const current=state(),last=dateLabel(current.lastSyncedAt);if(last)dialog.append(node('p','最終同期 '+last,'account65-caption'));if(current.user)row('再同期',()=>perform(async()=>{await backend().resync();if(state().status==='failed')throw Error('sync');},'同期できませんでした',openData));row('学習データを書き出す（JSON）',()=>perform(async()=>download(await backend().exportData()),'書き出しできませんでした。もう一度お試しください。'));blockedPanel();}
 function openAbout(){shell('このアプリについて');header('このアプリについて',openAccount);const content=node('div',undefined,'account65-credits');content.innerHTML=root.AppUI?.creditMarkup?.()||'';dialog.append(content);}
 function start(){unsubscribe?.();unsubscribe=backend()?.subscribe?.(()=>{if(view==='アカウント')statusLine();else if(view==='データの管理'&&!busy)blockedPanel();if(!state().user)nicknamePrompted=false;});const current=state();if(current.enabled&&!current.user&&!guestSelected())openLogin();else promptNickname();}
 root.AccountSync={start,openAccount,openLogin,openSettings,openData,openAbout,close,mount:()=>()=>{},destroy:()=>{unsubscribe?.();unsubscribe=null;close();},loginError,dateLabel};
})(window);
