const test=require('node:test'),assert=require('node:assert/strict');
const {createView}=require('../vocabulary-view.js');
test('review filter includes unsaved unit mistakes and skips, matching home count, without inflating saved count',()=>{
 const saved=[{id:'a'},{id:'d'}],review=[saved[0],{id:'b'},{id:'c'}];const view=createView(saved,review,item=>item.id==='d'?'定着':'未学習');
 assert.equal(view.count('すべて'),2);assert.equal(view.count('復習予定'),review.length);assert.deepEqual(view.items('復習予定').map(x=>x.id),['a','b','c']);assert.equal(view.status(saved[0]),'復習予定');assert.equal(view.count('未学習'),0);assert.equal(view.count('定着'),1);
 const next=createView(saved,[saved[0],{id:'c'}],()=> '学習中');assert.equal(next.count('復習予定'),2);assert.deepEqual(next.items('すべて'),saved);
});
