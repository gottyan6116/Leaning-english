const test=require('node:test'),assert=require('node:assert/strict');
const {createView}=require('../vocabulary-view.js');
test('review filter includes unsaved unit mistakes and skips, matching home count, without inflating saved count',()=>{
 const saved=[{id:'a'},{id:'d'}],review=[saved[0],{id:'b'},{id:'c'}];const view=createView(saved,review,item=>item.id==='d'?'定着':'未学習');
 assert.equal(view.count('すべて'),2);assert.equal(view.count('復習予定'),review.length);assert.deepEqual(view.items('復習予定').map(x=>x.id),['a','b','c']);assert.equal(view.status(saved[0]),'復習予定');assert.equal(view.count('未学習'),0);assert.equal(view.count('定着'),1);
 const next=createView(saved,[saved[0],{id:'c'}],()=> '学習中');assert.equal(next.count('復習予定'),2);assert.deepEqual(next.items('すべて'),saved);
});
test('sections preserve state rules, omit empty sections and do not duplicate saved review words',()=>{
 const saved=[{id:'a'},{id:'b'},{id:'c'},{id:null,headword:'personal'}],review=[saved[0],{id:'unit-wrong'}];
 const view=createView(saved,review,item=>item.id==='b'?'学習中':item.id==='c'?'定着':'未学習');
 const sections=view.sections();assert.deepEqual(sections.map(x=>x.state),['復習予定','学習中','未学習','定着']);assert.deepEqual(sections.map(x=>x.items.length),[2,1,1,1]);
 assert.equal(sections.flatMap(x=>x.items).filter(x=>x.id==='a').length,1);
 assert.deepEqual(createView([],[],()=> '未学習').sections(),[]);
 assert.deepEqual(createView([saved[2]],[],()=> '定着').sections().map(x=>x.state),['定着']);
});
