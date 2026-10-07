const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {validateItems}=require('../scripts/validate-listening.cjs');
const root=path.join(__dirname,'..'),material=JSON.parse(fs.readFileSync(path.join(root,'materials/listening/listening-items.json'),'utf8'));
test('five original listening passages are valid, unverified and listed in the manifest with the right hash',()=>{
 assert.equal(material.items.length,5);assert.deepEqual(validateItems(material.items),[]);
 assert.ok(material.items.every(i=>i.status==='unverified'&&i.origin==='original-for-this-app'));
 assert.deepEqual([...new Set(material.items.map(i=>i.question.answerIndex))].sort(),[0,1,2],'the correct answer is not always in the same position');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'materials/manifest.json'),'utf8')),text=fs.readFileSync(path.join(root,'materials/listening/listening-items.json'),'utf8');
 assert.equal(manifest.listening.path,'materials/listening/listening-items.json');assert.equal(manifest.listening.sha256,crypto.createHash('sha256').update(text).digest('hex'));
 const result=spawnSync(process.execPath,['scripts/validate-listening.cjs'],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
});
test('the validator rejects broken passages and unfair questions',()=>{
 const ok=material.items[0],bad=patch=>validateItems([{...ok,...patch}]);
 assert.ok(bad({id:'x'}).length);assert.ok(bad({genre:'旅行'}).length);assert.ok(bad({status:'draft'}).length);assert.ok(bad({origin:'copied'}).length);
 assert.ok(bad({text:['Only one paragraph here that is long enough to count as words but not as two paragraphs of text.']}).length);
 assert.ok(bad({text:['Too short.','Also short.']}).length);
 assert.ok(bad({question:{...ok.question,choices:['a','a','b']}}).length);assert.ok(bad({question:{...ok.question,answerIndex:3}}).length);
 const long={...ok.question,choices:['これは正解の選択肢でとても長い文章になっています','短い','別の短い'],answerIndex:0};assert.ok(bad({question:long}).some(e=>/uniquely longest/.test(e)));
 assert.ok(validateItems([ok,{...ok}]).some(e=>/duplicate/.test(e)));
});
test('the listening screen lists the earlier passages and the new ones, and switching changes the passage',()=>{
 const spoken=[],toasts=[];let html='';
 const legacyLesson=n=>({title:'Legacy '+n,genre:'仕事',word:0,text:['Legacy text '+n+'.']});
 const ctx={lessons:[legacyLesson(1),legacyLesson(2),legacyLesson(3)],words:[{en:'compelling',ja:'説得力のある'}],esc:s=>String(s),stopAudio(){},render(){},toast:m=>toasts.push(m),listeningMode:'問題',playing:false,view:'listen',window:{scrollTo(){},MaterialCatalog:{listening:()=>material.items}}};
 ctx.listening=null;ctx.toggleAudio=null;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(root,'stage11.js'),'utf8').replace('listening=function','globalThis.listening=function').replace('toggleAudio=function','globalThis.toggleAudio=function'),ctx);
 assert.equal(ctx.window.ListeningUI.items().length,8);
 html=ctx.listening();assert.equal((html.match(/ListeningUI\.select\(/g)||[]).length,8);assert.match(html,/Legacy 1/);assert.match(html,/aria-current="true"/);
 ctx.window.ListeningUI.select('listen-002');assert.equal(ctx.window.ListeningUI.current().title,'A delayed train');assert.match(ctx.listening(),/A delayed train/);
 const q=material.items[1].question;ctx.window.ListeningUI.answer(q.answerIndex);ctx.window.ListeningUI.answer((q.answerIndex+1)%3);assert.deepEqual(toasts,['正解です！','もう一度、聴いてみましょう']);
});
