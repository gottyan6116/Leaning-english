const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('wrong answer renders cross and correct check together, shakes once and does not replay on bookmark redraw',()=>{
 const elements=[],memory=new Map();const element=()=>({innerHTML:'',hidden:true,style:{},setAttribute(){},append(){},remove(){},querySelector(){return null;}});
 const item={id:'test-word',headword:'constraint',meaning:'制約',definition:'a limitation',example:'The budget imposed a constraint.',questions:{ja:{choices:['制約','判断','主張','分析'],answerIndex:0},en:{choices:['a limitation','a decision','a statement','an analysis'],answerIndex:0}}};
 const ctx={EnglishQuiz:require('../quiz-core.js'),C1_UNIT_01:{items:[item]},DEVELOPMENT_VOCABULARY:{items:[]},document:{createElement:()=>{const el=element();elements.push(el);return el;},body:{append(){},classList:{add(){},remove(){}}},addEventListener(){},activeElement:null},navigator:{},esc:s=>s,stopAudio(){},view:'home',render(){},go(){},words:[],setTimeout:()=>1,clearTimeout(){},toast(){}};
 ctx.window={localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../quiz-session.js'),'utf8'),ctx);
 ctx.window.QuizUI.startUnit();ctx.window.QuizUI.answer(1);const html=elements[0].innerHTML;
 assert.match(html,/wrong qs-wrong-enter/);assert.match(html,/M7 7l10 10M17 7 7 17/);assert.match(html,/m5 12 4 4L19 6/);assert.equal((html.match(/ disabled/g)||[]).length,5);
 assert.match(html,/<strong>constraint<\/strong>/);assert.match(html,/>定義<\/span>/);
 ctx.window.QuizUI.bookmark(item.id);assert.doesNotMatch(elements[0].innerHTML,/qs-wrong-enter/);assert.equal(ctx.window.QuizUI.getStore().logs.length,1);
});
