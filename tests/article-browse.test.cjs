const test=require('node:test'),assert=require('node:assert/strict');
const Browse=require('../article-browse.js');
const rows=[
 {id:'a',title:'Skills at Work',summaryJa:'技能を認める',searchText:'Skills at Work 技能を認める recognition 仕事',category:'仕事',level:'B1',sourcePublishedAt:'2026-10-05'},
 {id:'b',title:'Culture',summaryJa:'文化',searchText:'Culture 文化 heritage 日常・文化',category:'日常・文化',level:'C1',sourcePublishedAt:'2026-09-20'}
];
test('search combines category, level, and vocabulary without article bodies',()=>{
 assert.deepEqual(Browse.select(rows,{category:'work',level:'B1',q:'RECOGNITION'}).map(x=>x.id),['a']);
 assert.equal(Browse.select(rows,{category:'work',level:'C1',q:'skills'}).length,0);
});
test('URL round trip preserves unrelated parameters and separates all-list from top',()=>{
 const url=Browse.url('https://example.test/?v=keep',{category:'work',level:'B1',q:'skills'});
 assert.deepEqual(Browse.route(url),{category:'work',level:'B1',q:'skills',list:false});assert.ok(url.includes('v=keep'));
 assert.equal(Browse.route(Browse.url(url,{list:true})).list,true);
 assert.deepEqual(Browse.route(Browse.url(url,{})),{category:'',level:'',q:'',list:false});
 assert.equal(Browse.route('https://example.test/?level=INVALID&category=invalid').level,'');
});
test('source dates determine NEW and past boundaries',()=>{
 const now=new Date('2026-10-05T12:00:00Z');assert.equal(Browse.age('2026-09-28',now),7);assert.equal(Browse.age('2026-09-20',now),15);
 assert.equal(Browse.isNew(rows[0],now),true);assert.equal(Browse.isNew({sourcePublishedAt:'2026-10-06'},now),false);
});
test('small catalogs and empty results contain no empty mosaic or past blocks',()=>{
 const small=Browse.render(rows,{},{});assert.doesNotMatch(small,/class="ab-mosaic"|class="ab-past"/);
 const empty=Browse.render(rows,{q:'nothing'},{});assert.match(empty,/条件に合う記事がありません/);assert.doesNotMatch(empty,/class="ab-results-grid"|class="ab-mosaic"|class="ab-past"/);
});
test('mosaic is exclusive to unfiltered top and shelves are limited to three',()=>{
 const catalog=Array.from({length:8},(_,i)=>({...rows[0],id:String(i)}));
 const top=Browse.render(catalog,{},{});assert.match(top,/class="ab-mosaic"/);assert.equal((top.match(/ab-card ab-shelf/g)||[]).length,3);assert.doesNotMatch(top,/class="ab-past"/);
 const result=Browse.render(catalog,{level:'B1'},{});assert.doesNotMatch(result,/class="ab-mosaic"|class="ab-shelves"/);assert.match(result,/B1の記事 8件/);
});

test('mosaic omits dates and reading times while shelves and result cards retain them',()=>{
 const catalog=Array.from({length:5},(_,i)=>({...rows[0],id:String(i),readingMinutes:3}));
 const top=Browse.render(catalog,{},{}),mosaic=top.match(/<section class="ab-mosaic"[\s\S]*?<\/section>/)[0];
 assert.doesNotMatch(mosaic,/元記事|約3分|ab-tile-date/);assert.match(mosaic,/ab-tile-level/);assert.match(mosaic,/ab-category-tag/);
 assert.match(top.slice(top.indexOf('class="ab-shelves"')),/元記事/);assert.match(top.slice(top.indexOf('class="ab-shelves"')),/約3分/);
 const result=Browse.render(catalog,{level:'B1'},{});assert.match(result,/元記事/);assert.match(result,/約3分/);
});
