const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','account-sync.js'),'utf8');
function api(){const context={window:{}};vm.runInNewContext(source,context);return context.window.AccountSync;}
test('login errors separate credentials, network, server and local persistence failures',()=>{
 const ui=api();
 assert.equal(ui.loginError({code:'invalid_credentials',status:400}),'メールアドレスまたはパスワードが違います');
 assert.equal(ui.loginError({status:401}),'メールアドレスまたはパスワードが違います');
 for(const error of [{code:'connection_failed'},{status:503},{status:400,code:'configuration_failed'},new TypeError('fetch failed')])assert.equal(ui.loginError(error),'サーバーに接続できません。時間をおいて再度お試しください');
 assert.match(ui.loginError({code:'login_failed'}),/端末に保存/);
});
test('last synchronization presentation never includes seconds',()=>{
 const ui=api();const label=ui.dateLabel('2026-10-05T04:13:57.000Z');assert.match(label,/\d{2}:\d{2}$/);assert.doesNotMatch(label,/:57$/);assert.equal(ui.dateLabel(null),null);assert.equal(ui.dateLabel('invalid'),null);
});
test('learning settings edits leave previously stored daily and weekly goals untouched',()=>{
 const {QuizStore,KEYS}=require('../quiz-core.js');const {APP_KEYS}=require('../app-state.js');
 const values=new Map([[APP_KEYS.goals,JSON.stringify({daily:20,weekly:100})]]);
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const store=new QuizStore(storage);store.setSettings({mode:'en',autoAdvance:false});
 assert.deepEqual(JSON.parse(values.get(APP_KEYS.goals)),{daily:20,weekly:100});
 assert.equal(JSON.parse(values.get(KEYS.settings)).mode,'en');assert.equal(new QuizStore(storage).settings.autoAdvance,false);
});
function allText(element){return [element.textContent||'',...element.children.map(allText)].join(' ');}
function domApi(backend){
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.listeners={};this.classList={add(){},remove(){}};this.validity={valid:true};this.value='';this.dataset={};}
  append(...elements){for(const element of elements){element.parent=this;this.children.push(element);}}
  setAttribute(key,value){this.attributes[key]=value;}removeAttribute(key){delete this.attributes[key];}
  addEventListener(event,action){this.listeners[event]=action;}focus(){}showModal(){this.open=true;}close(){this.open=false;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
  replaceChildren(...children){this.children=[];this.append(...children);}
  querySelectorAll(selector){const all=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);if(selector==='*')return all;return all.filter(child=>selector.split(',').some(part=>part.trim().startsWith('.')?child.className?.split(' ').includes(part.trim().slice(1)):child.tagName===part.trim()));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 }
 const body=new Element('body'),document={body,createElement:tag=>new Element(tag)},values=new Map(),context={window:{SupabaseSync:backend,AppUI:{creditMarkup:()=>''}},document,localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},setTimeout(){}};
 vm.runInNewContext(source,context);return {ui:context.window.AccountSync,body,values,context};
}
test('pending login locks password, eye, submit and guest until failure settles',async()=>{
 let rejectLogin;const backend={getState:()=>({enabled:true}),login:()=>new Promise((_,reject)=>{rejectLogin=reject;})};
 const {ui,body,values}=domApi(backend);ui.openLogin();const dialog=body.children[0],form=dialog.querySelector('form'),inputs=dialog.querySelectorAll('input');inputs[0].value='user@example.test';inputs[1].value='password-value';
 const flight=form.listeners.submit({preventDefault(){}});assert.equal(dialog.querySelectorAll('input,button').every(control=>control.disabled),true);
 const guest=dialog.querySelector('.login-guest');guest.listeners.click();assert.equal(body.children[0],dialog);assert.equal(values.size,0);
 rejectLogin({code:'invalid_credentials',status:400});await flight;assert.equal(dialog.querySelectorAll('input,button').every(control=>!control.disabled),true);assert.equal(inputs[1].value,'');assert.equal(dialog.querySelectorAll('.login-error')[1].textContent,'メールアドレスまたはパスワードが違います');
});
test('login succeeds directly to home without an import prompt, button, count or toast',async()=>{
 let current={enabled:true};let homeCalls=[];
 const backend={getState:()=>current,login:async()=>{current={enabled:true,user:{id:'user'},migrationPreview:{available:true,counts:{answer_logs:7,preferences:4}},migrationResult:{success:false}};}};
 const {ui,body,context}=domApi(backend);context.window.go=view=>homeCalls.push(view);
 ui.openLogin();const dialog=body.children[0],form=dialog.querySelector('form'),inputs=dialog.querySelectorAll('input');inputs[0].value='user@example.test';inputs[1].value='password-value';
 await form.listeners.submit({preventDefault(){}});
 assert.equal(body.children.length,0);assert.deepEqual(homeCalls,['home']);assert.equal(ui.openImport,undefined);
 ui.openData();const dataText=allText(body.children[0]);assert.doesNotMatch(dataText,/取り込|取り込み|11 件/);assert.equal(body.children[0].querySelector('.account65-toast'),null);
});

test('past migration verification failures are not exposed as import errors or retry actions',()=>{
 const backend={getState:()=>({enabled:true,user:{id:'user'},migrationPreview:{available:true,counts:{answer_logs:7}},migrationResult:{success:false,successCount:7,failureCount:2}}),blockedData:()=>[]};
 const {ui,body}=domApi(backend);ui.openData();assert.doesNotMatch(allText(body.children[0]),/取り込|取り込み|再試行/);assert.equal(body.children[0].querySelector('.account65-import-failed'),null);
});

test('blocked items are only exposed under data management, safely and individually discardable',async()=>{
 let records=[{table:'preferences',key:'opaque-key',revision:3,row:{setting_key:'daily',value:null},error:'raw database error'}];let discarded;
 const backend={getState:()=>({enabled:true,user:{id:'hidden-user-id',email:'user@example.test'},blockedCount:records.length}),blockedData:()=>records,discardBlocked:async(...args)=>{discarded=args;records=[];}};
 const {ui,body}=domApi(backend);ui.openAccount();assert.equal(body.children[0].querySelector('.account65-blocked'),null);ui.openData();const dialog=body.children[0],details=dialog.querySelector('.account65-blocked');assert.ok(details);const allText=element=>[element.textContent||'',...element.children.map(allText)].join(' ');const text=allText(details);assert.match(text,/送信できないデータが 1 件あります/);assert.match(text,/日目標：未設定/);for(const hidden of ['opaque-key','hidden-user-id','raw database error'])assert.ok(!text.includes(hidden));
 const discard=details.querySelector('button');discard.listeners.click();assert.equal(discarded,undefined);const confirm=dialog.querySelector('.account65-discard-confirm');assert.match(allText(confirm),/学習記録は端末に残ります/);await confirm.querySelectorAll('button').find(button=>button.textContent==='破棄').listeners.click();assert.deepEqual(discarded,['preferences','opaque-key',3]);assert.equal(body.children[0].querySelector('.account65-blocked'),null);
});

test('an empty blocked collection and successful migration create no extra notices',()=>{
 const backend={getState:()=>({enabled:true,user:{id:'user'},blockedCount:0,migrationResult:{success:true},migrationPreview:{available:true,counts:{}}}),blockedData:()=>[]};const {ui,body}=domApi(backend);ui.openData();assert.equal(body.children[0].querySelector('.account65-blocked'),null);assert.equal(body.children[0].querySelector('.account65-import-failed'),null);
});

test('blocked session and article records expose actual score and reading state',()=>{
 const backend={getState:()=>({enabled:true,user:{id:'user'}}),blockedData:()=>[{table:'unit_sessions',row:{correct:7,total:10}},{table:'article_states',row:{read:true}}]};const {ui,body}=domApi(backend);ui.openData();const text=body.children[0].querySelector('.account65-blocked').querySelectorAll('p').map(p=>p.textContent).join(' ');assert.match(text,/7 \/ 10/);assert.match(text,/読了/);
});
