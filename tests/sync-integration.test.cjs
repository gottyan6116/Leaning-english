const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AppState,APP_KEYS}=require('../app-state.js');
const {QuizStore,KEYS}=require('../quiz-core.js');
const {createHash}=require('node:crypto');
const fs=require('node:fs');
test('applied SQL filenames preserve the original migration contents',()=>{
 for(const [name,hash] of [
  ['20261004144629_learning_sync_tables.sql','61162dd574cfd88383288403b71fda4859334acabeeaec227001ba54834c119a'],
  ['20261004144638_google_signup_allowlist.sql','cef7b00eae87b37e0d4e2773deb487d9da0c6b0c1f3111f01085aefc9d004a2e']
 ])assert.equal(createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname,'../supabase/migrations',name),'utf8').replace(/\r\n/g,'\n')).digest('hex'),hash);
});
test('settings and goals are committed in one storage transaction',()=>{
 const values=new Map();let transactions=0,writes=0;
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);writes++},removeItem:k=>values.delete(k),transaction:fn=>{transactions++;const before=new Map(values);try{return fn()}catch(e){values.clear();for(const [k,v] of before)values.set(k,v);throw e}}};
 const state=new AppState(storage,{items:[]});const quiz=new QuizStore(storage);
 state.savePreferences(quiz,{daily:20,weekly:90},{mode:'en',autoAdvance:false});
 assert.equal(transactions,1);assert.equal(writes,2);assert.equal(JSON.parse(storage.getItem(KEYS.settings)).mode,'en');
 assert.deepEqual(JSON.parse(storage.getItem(APP_KEYS.goals)),{daily:20,weekly:90});
});
