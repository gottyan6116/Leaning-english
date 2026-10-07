const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../nickname.js');
function fakeDocument(){
 const make=tag=>{const el={tag,children:[],attrs:{},handlers:{},hidden:false,disabled:false,value:'',textContent:'',focused:false,
  append(...items){el.children.push(...items);},setAttribute(k,v){el.attrs[k]=String(v);},removeAttribute(k){delete el.attrs[k];},
  addEventListener(type,fn){(el.handlers[type]||=[]).push(fn);},focus(){el.focused=true;}};return el;};
 return {createElement:make};
}
function build(options){
 const root=globalThis;const previous=root.document;root.document=fakeDocument();
 let field;try{field=N.createField(options);}finally{root.document=previous;}
 return field;
}
const fire=(el,type,event={})=>Promise.all((el.handlers[type]||[]).map(fn=>fn({preventDefault(){event.prevented=true;},...event})));
test('nickname rule: 1-20 characters after trimming, one line, counted as characters',()=>{
 assert.deepEqual(N.validate('  Taka  '),{ok:true,value:'Taka'});assert.equal(N.validate('Bridge').ok,true);
 assert.equal(N.validate('').ok,false);assert.equal(N.validate('   ').ok,false);assert.equal(N.validate(null).ok,false);
 assert.equal(N.validate('a'.repeat(20)).ok,true);assert.equal(N.validate('a'.repeat(21)).ok,false);
 assert.equal(N.validate('あ'.repeat(20)).ok,true);assert.equal(N.validate('あ'.repeat(21)).ok,false);assert.equal(N.validate('😀'.repeat(20)).ok,true,'an emoji is one character');
 assert.equal(N.validate('a\nb').ok,false);assert.equal(N.validate('a\r\nb').ok,false);assert.match(N.validate('a\nb').error,/改行/);
 assert.equal(N.validate(' \n ').ok,false);
});
test('the legacy device-only name is only a first suggestion and is removed once used',()=>{
 const store=(initial={})=>{const m=new Map(Object.entries(initial));return {getItem:k=>m.has(k)?m.get(k):null,removeItem:k=>m.delete(k),has:k=>m.has(k)};};
 assert.equal(N.legacyName(store({[N.LEGACY_NAME_KEY]:' Taka '})),'Taka');assert.equal(N.legacyName(store()),'');
 assert.equal(N.legacyName(store({[N.LEGACY_NAME_KEY]:'x'.repeat(40)})),'','an invalid old value is not suggested');
 const s=store({[N.LEGACY_NAME_KEY]:'Taka'});N.clearLegacyName(s);assert.equal(s.has(N.LEGACY_NAME_KEY),false);
 assert.equal(N.legacyName({getItem(){throw new Error('blocked');}}),'','blocked storage never breaks the screen');
});
test('the input component validates, shows errors, locks while saving and reports failures',async()=>{
 const saved=[];let fail=null,release=null;
 const field=build({value:'Taka',submitLabel:'はじめる',onSubmit:async name=>{saved.push(name);if(release)await new Promise(r=>release=r);if(fail)throw fail;}});
 const [label,input,error,submit]=field.element.children;
 assert.equal(input.value,'Taka');assert.equal(submit.textContent,'はじめる');assert.equal(error.hidden,true);assert.equal(input.type,'text');assert.equal(label.htmlFor,input.id);
 input.value='';await fire(field.element,'submit');assert.equal(saved.length,0);assert.equal(error.hidden,false);assert.match(error.textContent,/入力/);assert.equal(input.attrs['aria-invalid'],'true');assert.equal(input.focused,true);
 await fire(input,'input');assert.equal(error.hidden,true);assert.equal(input.attrs['aria-invalid'],undefined);
 input.value='a\nb';await fire(field.element,'submit');assert.equal(saved.length,0);assert.match(error.textContent,/改行/);
 const paste={clipboardData:{getData:()=>'x\ny'}};await fire(input,'paste',paste);assert.equal(paste.prevented,true);assert.match(error.textContent,/改行/);
 const ok={clipboardData:{getData:()=>'single'}};await fire(input,'paste',ok);assert.equal(ok.prevented,undefined);
 input.value='  Bridge  ';await fire(field.element,'submit');assert.deepEqual(saved,['Bridge']);assert.equal(input.disabled,false);assert.equal(submit.disabled,false);
 fail=new Error('通信できません');input.value='Taka';await fire(field.element,'submit');assert.equal(error.textContent,'通信できません');assert.equal(error.hidden,false);assert.equal(submit.disabled,false);
 fail=null;release=()=>{};const first=fire(field.element,'submit');assert.equal(input.disabled,true,'locked while saving');assert.equal(submit.disabled,true);const second=await fire(field.element,'submit');assert.equal(saved.length,3,'a second submit while saving is ignored');release();await first;
});
