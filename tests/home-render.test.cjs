const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const Quiz=require('../quiz-core.js'),HomeCore=require('../home-core.js'),WordbookCore=require('../wordbook-core.js');
const basic=JSON.parse(fs.readFileSync(path.join(root,'materials/vocabulary/basic-01.json'),'utf8'));
const genres=JSON.parse(fs.readFileSync(path.join(root,'materials/vocabulary/genres.json'),'utf8')).genres;
const articles=[{id:'a2',title:'Newest article',level:'B1',category:'仕事',readingMinutes:4,sourcePublishedAt:'2026-10-05T00:00:00Z',photo:{assetPath:'assets/x.jpg'}},{id:'a1',title:'Older article',level:'A2',category:'教養',readingMinutes:3,sourcePublishedAt:'2026-10-02T00:00:00Z'}];
function build(values={},{name=''}={}){
 const memory=new Map(Object.entries(values)),local=new Map();
 const storage={getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,String(v))};
 const elementStub=()=>({querySelector:()=>null,innerHTML:'',outerHTML:''});
 const ctx={HomeCore,esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),document:{addEventListener(){},querySelector:()=>null,body:{classList:{contains:()=>false}}},view:'home',
  render(){},go(){},home(){return '';},
  window:{render(){},go(){},HomeCore,WordbookCore,EnglishQuiz:Quiz,AppStorage:storage,localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
   SupabaseSync:{getState:()=>({user:name?{id:'u',nickname:name}:null}),subscribe(){}},
   QuizUI:{getStore:()=>({settings:{mode:'ja'}})},AppUI:{reviewItems:()=>[]},CollocationUI:{getStore:()=>({logs:[]}),reviewItems:()=>[]},
   MaterialCatalog:{genres:()=>genres,sets:()=>[basic],articles:()=>articles}}};
 ctx.window.window=ctx.window;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(root,'stage12.js'),'utf8'),ctx);
 return {html:()=>ctx.window.home(),ctx,memory};
}
test('a brand-new learner sees every block without holes, fake numbers or empty frames',()=>{
 const page=build().html();
 assert.doesNotMatch(page,/undefined|NaN|null/);
 assert.match(page,/基礎単語①/);assert.match(page,/組み合わせクイズ/);assert.match(page,/記事を読む/);assert.match(page,/最初のタスクをはじめる/);assert.match(page,/0 \/ 3 完了/);
 assert.doesNotMatch(page,/hm-recent/,'no record, no recent-learning card');
 assert.match(page,/今日から始めましょう/);assert.doesNotMatch(page,/hm-week-checks/);
 assert.equal((page.match(/class="hm-bar /g)||[]).length,7);assert.match(page,/<strong>0<small>問<\/small>/);assert.match(page,/今週の回答数/);
 assert.doesNotMatch(page,/リスニング|LISTEN|ベル|今日も一歩ずつ/);
 assert.equal((page.match(/data-hm-article=/g)||[]).length,2);assert.ok(page.indexOf('Newest article')<page.indexOf('Older article'),'newest first');
 assert.doesNotMatch(page,/hm-name/,'no display name, no name in the greeting');
});
test('the greeting and nav name come from the account nickname; guests get a plain greeting',()=>{
 assert.match(build({}, {name:'Taka'}).html(),/hm-name"><span class="hm-comma">、<\/span>Takaさん/);
 assert.doesNotMatch(build().html(),/hm-name/,'a guest has no name');
 assert.equal(build({}, {name:'  Mika '}).ctx.window.HomeUI.displayName(),'Mika');assert.equal(build().ctx.window.HomeUI.displayName(),'');
 assert.equal(typeof build().ctx.window.HomeUI.setDisplayName,'undefined','the device-only display name is gone');
});
test('with records: counts, streak and the three tasks come from the stored answers',()=>{
 const now=Date.now(),stamp=back=>new Date(now-back*86400000).toISOString();
 const events=[0,1,2].flatMap(back=>Array.from({length:4},(_,i)=>({eventId:`e${back}${i}`,wordId:basic.items[i].id,mode:'ja',correct:true,skipped:false,answeredAt:stamp(back),sessionId:'s'+back,kind:'vocabulary'})));
 const page=build({'english-notes.quiz.answers.v1':JSON.stringify(events),'english-notes.article.read.v1':JSON.stringify({a2:{completedAt:stamp(0)}})}).html();
 assert.match(page,/<strong>3<\/strong>日連続/);assert.match(page,/<strong>4<small>語<\/small>/);assert.match(page,/<strong>1<small>本<\/small>/);assert.match(page,/基礎単語①/);
 assert.match(page,/記事を読む<\/strong><small>Older article/,'the newest article is read, so the next unread one is offered');
 assert.match(page,/hm-recent/);assert.match(page,/1 \/ 3 完了/);
});
test('when every task is done there is no start button, only a completion note',()=>{
 const now=new Date().toISOString();
 const events=Array.from({length:10},(_,i)=>({eventId:'v'+i,wordId:basic.items[i].id,mode:'ja',correct:true,skipped:false,answeredAt:now,sessionId:'sv',kind:'vocabulary'}));
 const colloc=Array.from({length:10},(_,i)=>({collocationId:'c'+i,answeredAt:now,sessionId:'sc'}));
 const built=build({'english-notes.quiz.answers.v1':JSON.stringify(events),'english-notes.article.read.v1':JSON.stringify({a2:{completedAt:now}})});
 built.ctx.window.CollocationUI.getStore=()=>({logs:colloc});
 const page=built.html();
 assert.match(page,/今日の学習は完了です/);assert.doesNotMatch(page,/data-hm-start/);assert.match(page,/3 \/ 3 完了/);
});
