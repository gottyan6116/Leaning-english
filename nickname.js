(function(root){
 'use strict';
 // Nickname rules and the shared input component (login follow-up screen, account screen, and a future sign-up screen).
 const MAX_LENGTH=20,LEGACY_NAME_KEY='english-notes.ui.display-name.v1';
 // Same rule as the server call in supabase-sync.js: 1-20 characters after trimming, one line only.
 function validate(value){
  const raw=String(value??'');
  if(/[\r\n]/.test(raw))return {ok:false,error:'改行は使えません'};
  const text=raw.trim(),length=Array.from(text).length;
  if(length<1)return {ok:false,error:'ニックネームを入力してください'};
  if(length>MAX_LENGTH)return {ok:false,error:`${MAX_LENGTH}文字以内で入力してください`};
  return {ok:true,value:text};
 }
 // The name stored on this device by the earlier display-name setting; used once as the first suggestion.
 function legacyName(storage){try{const value=(storage||root.localStorage).getItem(LEGACY_NAME_KEY)||'';return validate(value).ok?value.trim():'';}catch(error){return '';}}
 function clearLegacyName(storage){try{(storage||root.localStorage).removeItem(LEGACY_NAME_KEY);}catch(error){/* nothing to clean up */}}
 // Builds <form><label>ニックネーム<input/></label><p role=alert/><button/></form>.
 // options: {value, submitLabel, onSubmit(name) -> Promise}. The component validates, shows errors and disables itself while saving.
 function createField(options={}){
  const doc=root.document,form=doc.createElement('form'),label=doc.createElement('label'),input=doc.createElement('input'),error=doc.createElement('p'),submit=doc.createElement('button');
  const id='nickname-'+Math.random().toString(36).slice(2,8);
  form.className='nickname-form login-form';form.noValidate=true;form.setAttribute('aria-label','ニックネーム');
  label.textContent='ニックネーム';label.htmlFor=id;label.className='nickname-label';
  input.id=id;input.type='text';input.name='nickname';input.autocomplete='nickname';input.value=options.value||'';input.className='nickname-input';input.setAttribute('aria-describedby',id+'-error');input.enterKeyHint='done';
  error.id=id+'-error';error.className='login-error nickname-error';error.setAttribute('role','alert');error.hidden=true;
  submit.type='submit';submit.textContent=options.submitLabel||'保存';submit.className='account65-primary nickname-submit';
  form.append(label,input,error,submit);
  const show=message=>{error.textContent=message||'';error.hidden=!message;if(message)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');};
  let busy=false;
  const setBusy=value=>{busy=value;input.disabled=value;submit.disabled=value;if(value)form.setAttribute('aria-busy','true');else form.removeAttribute('aria-busy');};
  input.addEventListener('input',()=>show(''));
  // Pasted line breaks are rejected rather than silently joined.
  input.addEventListener('paste',event=>{const text=event.clipboardData?.getData?.('text')||'';if(/[\r\n]/.test(text)){event.preventDefault();show('改行は使えません');}});
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy)return;
   const result=validate(input.value);if(!result.ok){show(result.error);input.focus();return;}
   show('');setBusy(true);
   try{await options.onSubmit?.(result.value);}
   catch(failure){show(failure?.message||'保存できませんでした。通信を確認して、もう一度お試しください。');}
   finally{setBusy(false);}
  });
  return {element:form,input,showError:show,setBusy,focus:()=>input.focus()};
 }
 const api={MAX_LENGTH,LEGACY_NAME_KEY,validate,legacyName,clearLegacyName,createField};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Nickname=api;
})(typeof window!=='undefined'?window:globalThis);
