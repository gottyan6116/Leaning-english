(function (root) {
 'use strict';
 let activeCleanup = null;
 const countLabels = {answer_logs:'回答履歴',saved_words:'保存した語',preferences:'設定',unit_sessions:'ユニット履歴',article_states:'記事の記録',opinion_drafts:'意見メモ'};
 function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
 }
 function download(data) {
  if (!data || typeof data !== 'object') throw new Error('Export unavailable');
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link = node('a');
  link.href=url; link.download='english-notes-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function countBlock(title, source) {
  const section = node('div',undefined,'account-sync-counts');
  section.append(node('h4',title));
  const counts = source?.counts || source || {};
  const list = node('dl');
  for (const [key,label] of Object.entries(countLabels)) {
   const raw=counts[key],value=Array.isArray(raw)?raw.length:Number(raw);
   const row=node('div'); row.append(node('dt',label),node('dd',(Number.isFinite(value)?value:0)+'件')); list.append(row);
  }
  section.append(list); return section;
 }
 function mount(container) {
  if (!container) return ()=>{};
  if (activeCleanup) activeCleanup();
  container.querySelector('[data-account-sync]')?.remove();
  const backend=root.SupabaseSync;
  const section=node('section',undefined,'account-sync'); section.dataset.accountSync='';
  section.setAttribute('aria-label','アカウントと学習データ');
  const auth=node('div'),status=node('p',undefined,'account-sync-status'),message=node('p',undefined,'account-sync-message');
  status.setAttribute('role','status'); message.setAttribute('role','status');
  const migration=node('div',undefined,'account-sync-migration'),actions=node('div',undefined,'account-sync-actions');
  section.append(auth,status,message,migration,actions); container.append(section);
  let busy=false,disposed=false,authKey=null,unsubscribe=null,lastImport=null;
  function button(label,action,parent=actions) {
   const element=node('button',label,'account-sync-button'); element.type='button';
   element.addEventListener('click',action); parent.append(element); return element;
  }
  function state() { return backend?.getState?.() || {enabled:false}; }
  function setBusy(value) {
   busy=value;
   section.querySelectorAll('button,input').forEach(element=>{element.disabled=value;});
   section.setAttribute('aria-busy',String(value));
  }
  async function perform(operation,failure,success) {
   if(busy || disposed) return;
   message.textContent=''; setBusy(true);
   try {
    const result=await operation();
    if(!disposed) { if(success) success(result); }
   } catch (_) {
    if(!disposed) message.textContent=failure;
   } finally {
    if(!disposed) { setBusy(false); render(); }
   }
  }
  function render() {
   if(disposed) return;
   const current=state(),enabled=current.enabled===true,user=current.user;
   const key=enabled?(user?.id || user?.email || 'guest'):'disabled';
   if(authKey!==key) {
    authKey=key; auth.replaceChildren(); message.textContent=''; lastImport=null;
    if(enabled) {
     auth.append(node('h3','アカウント'));
     if(user) auth.append(node('p',user.email || 'ログイン中','account-sync-email'));
     else {
      const emailLabel=node('label','メールアドレス'),email=node('input');
      email.type='email'; email.autocomplete='username'; email.name='sync-email'; email.setAttribute('form','account-sync-auth-fields'); emailLabel.append(email);
      const passwordLabel=node('label','パスワード'),password=node('input');
      password.type='password'; password.autocomplete='current-password'; password.name='sync-password'; password.setAttribute('form','account-sync-auth-fields'); passwordLabel.append(password);
      auth.append(emailLabel,passwordLabel);
      const login=()=>{
       if(busy) return;
       const address=email.value.trim(),secret=password.value;
       if(!address || !email.checkValidity() || !secret) { message.textContent='メールアドレスとパスワードを入力してください。'; return; }
       password.value='';
       perform(()=>backend.login(address,secret),'ログインできませんでした。入力内容と接続を確認してください。');
      };
      button('ログイン',login,auth);
      password.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();login();}});
      email.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();password.focus();}});
     }
    }
   }
   status.hidden=!enabled; migration.replaceChildren(); actions.replaceChildren();
   if(enabled) {
    const pending=Number(current.pendingCount)||0;
    const labels={pending:pending?'未送信 '+pending+'件':'未送信あり',syncing:'同期中',failed:'同期に失敗しました。未送信の記録は端末に保存されています。',error:'同期に失敗しました。未送信の記録は端末に保存されています。',synced:'同期済み',idle:user?'同期を待っています':'ログインしていません',guest:'ログインしていません'};
    status.textContent=labels[current.status] || (user?'同期を待っています':'ログインしていません');
    if(user && current.lastSyncedAt) {
     const date=new Date(current.lastSyncedAt);
     if(Number.isFinite(date.getTime())) status.textContent+=' · '+date.toLocaleString('ja-JP');
    }
    if(user) {
     button(['failed','error'].includes(current.status)?'同期を再試行':'再同期',()=>perform(()=>backend.resync(),'同期できませんでした。接続を確認して再試行してください。'));
     button('ログアウト',()=>perform(()=>backend.logout(),'ログアウトできませんでした。もう一度お試しください。'));
     const preview=current.migrationPreview;
     if(preview && !preview.imported && !preview.alreadyImported && preview.available===true) {
      migration.append(node('h3','この端末の学習データを取り込む'));
      migration.append(countBlock('ゲストの記録',preview.guest),countBlock('以前の保存形式の記録',preview.legacy));
      migration.append(node('p','取り込む前に、この端末の対象データをJSONで書き出します。','account-sync-description'));
      button('表示したデータを取り込む',()=>perform(()=>backend.importGuest(),'取り込みを完了できませんでした。記録は端末に残っています。',result=>{lastImport=result;}),migration);
     }
     const result=lastImport || current.migrationResult;
     if(result?.targetCounts) {
      migration.append(node('h3',result.success===true || result.verified===true?'取り込み完了':'取り込み件数の確認'),countBlock('取り込み対象の照合件数',result.targetCounts));
     }
    }
   }
   button('学習データをJSONで書き出す',()=>perform(async()=>download(await backend.exportData()),'書き出しできませんでした。もう一度お試しください。'));
   if(!enabled) actions.prepend(node('h3','学習データ'));
   setBusy(busy);
  }
  render();
  unsubscribe=backend?.subscribe?.(()=>render());
  const cleanup=()=>{disposed=true;if(typeof unsubscribe==='function')unsubscribe();section.querySelectorAll('input[type="password"]').forEach(input=>{input.value='';});if(activeCleanup===cleanup)activeCleanup=null;};
  activeCleanup=cleanup; return cleanup;
 }
 root.AccountSync={mount};
})(window);
