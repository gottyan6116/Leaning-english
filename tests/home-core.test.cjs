const test=require('node:test'),assert=require('node:assert/strict');
const H=require('../home-core.js');
const jst=(y,m,d,h=12,min=0)=>Date.UTC(y,m-1,d,h-9,min); // a JST wall-clock time as a timestamp
const iso=ts=>new Date(ts).toISOString();
const vocab=(ts,extra={})=>({answeredAt:iso(ts),wordId:'w1',sessionId:'s1',correct:true,mode:'ja',...extra});
const TODAY='2026-10-07'; // Wednesday

test('Japan time date boundaries: 23:59 and 00:00 fall on different days regardless of the machine time zone',()=>{
 assert.equal(H.jstDate(Date.UTC(2026,9,6,14,59,59)),'2026-10-06');assert.equal(H.jstDate(Date.UTC(2026,9,6,15,0,0)),'2026-10-07');
 assert.equal(H.jstDate(jst(2026,10,7,0,0)),'2026-10-07');assert.equal(H.jstDate(jst(2026,10,7,23,59)),'2026-10-07');
 assert.equal(H.jstDate(jst(2026,12,31,23,30)),'2026-12-31');assert.equal(H.jstDate(jst(2027,1,1,0,30)),'2027-01-01');
 assert.equal(H.addDays('2026-10-31',1),'2026-11-01');assert.equal(H.addDays('2026-03-01',-1),'2026-02-28');assert.equal(H.addDays('2028-03-01',-1),'2028-02-29');
});
test('greeting and date text follow Japan time',()=>{
 assert.equal(H.greetingWord(jst(2026,10,7,3,59)),'こんばんは');assert.equal(H.greetingWord(jst(2026,10,7,4,0)),'おはようございます');assert.equal(H.greetingWord(jst(2026,10,7,9,59)),'おはようございます');
 assert.equal(H.greetingWord(jst(2026,10,7,10,0)),'こんにちは');assert.equal(H.greetingWord(jst(2026,10,7,17,59)),'こんにちは');assert.equal(H.greetingWord(jst(2026,10,7,18,0)),'こんばんは');
 assert.equal(H.formatDate(jst(2026,10,7,9)),'10月7日（水）');assert.equal(H.formatDate(jst(2026,10,11,9)),'10月11日（日）');
 assert.equal(H.formatDate(Date.UTC(2026,9,6,15,30)),'10月7日（水）','late evening in UTC is already the next day in Japan');
});
test('weeks start on Monday and span month boundaries',()=>{
 assert.deepEqual(H.weekDates('2026-10-07'),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']);
 assert.equal(H.weekStart('2026-10-11'),'2026-10-05');assert.equal(H.weekStart('2026-10-05'),'2026-10-05');
 assert.deepEqual(H.weekDates('2026-10-31').slice(0,2),['2026-10-26','2026-10-27']);assert.equal(H.weekDates('2026-10-31')[6],'2026-11-01');
 assert.equal(H.weekDates('2026-10-07',-1)[0],'2026-09-28');assert.equal(H.weekDates('2026-10-07',1)[0],'2026-10-12');
 assert.equal(H.monthTitle(H.weekDates('2026-10-07')),'2026年10月');assert.equal(H.monthTitle(H.weekDates('2026-10-31')),'2026年10月','the month of the Thursday names the week');
 assert.equal(H.label('2026-10-01'),'10/1');
});
test('learning days come from answers of every kind and article reads',()=>{
 const data={vocabLogs:[vocab(jst(2026,10,5,8))],collocLogs:[{answeredAt:iso(jst(2026,10,6,9)),collocationId:'c1',sessionId:'c'}],articleAnswers:[{answeredAt:iso(jst(2026,10,3,9)),articleId:'a',sessionId:'r'}],reads:{a:{completedAt:iso(jst(2026,10,2,23,50))},b:{completedAt:null}}};
 assert.deepEqual([...H.learningDays(data)].sort(),['2026-10-02','2026-10-03','2026-10-05','2026-10-06']);
 assert.equal(H.learningDays({}).size,0);assert.equal(H.learningDays({vocabLogs:[{answeredAt:'broken'}]}).size,0,'unparseable times are ignored');
});
test('streak: continues through yesterday, breaks on a gap, and is 0 without records',()=>{
 const days=ds=>new Set(ds);
 assert.equal(H.streak(days([]),TODAY),0);
 assert.equal(H.streak(days(['2026-10-07']),TODAY),1);
 assert.equal(H.streak(days(['2026-10-04','2026-10-05','2026-10-06','2026-10-07']),TODAY),4);
 assert.equal(H.streak(days(['2026-10-04','2026-10-05','2026-10-06']),TODAY),3,'today not studied yet: yesterday keeps the streak');
 assert.equal(H.streak(days(['2026-10-03','2026-10-04']),TODAY),0,'two days ago is too old');
 assert.equal(H.streak(days(['2026-10-01','2026-10-02','2026-10-04','2026-10-05','2026-10-07']),TODAY),1,'a gap resets the count');
 assert.equal(H.streak(days(['2026-09-29','2026-09-30','2026-10-01','2026-10-02']),'2026-10-03'),4,'months are crossed correctly');
 const week=H.lastDays(days(['2026-10-05','2026-10-07']),TODAY);assert.equal(week.length,7);assert.equal(week[0].date,'2026-10-01');assert.equal(week[6].date,TODAY);
 assert.deepEqual(week.filter(d=>d.learned).map(d=>d.label),['10/5','10/7']);
});
test('week statistics count answers per day and distinct words, collocations and read articles of this week only',()=>{
 const data={
  vocabLogs:[vocab(jst(2026,10,4,23,59),{wordId:'old'}),vocab(jst(2026,10,5,0,1),{wordId:'w1'}),vocab(jst(2026,10,5,9),{wordId:'w1',skipped:true,correct:false}),vocab(jst(2026,10,7,9),{wordId:'w2',timedOut:true,correct:false}),vocab(jst(2026,10,12,0,1),{wordId:'next'})],
  collocLogs:[{answeredAt:iso(jst(2026,10,6,9)),collocationId:'c1',wordId:'w1',sessionId:'c'},{answeredAt:iso(jst(2026,10,6,9,5)),collocationId:'c1',wordId:'w1',sessionId:'c'},{answeredAt:iso(jst(2026,10,7,9)),collocationId:'c2',wordId:'w9',sessionId:'c'}],
  articleAnswers:[{answeredAt:iso(jst(2026,10,7,10)),articleId:'a',sessionId:'r'}],
  reads:{a:{completedAt:iso(jst(2026,10,7,10,5))},b:{completedAt:iso(jst(2026,10,1,10))}}
 };
 const s=H.weekStats(data,TODAY);
 assert.deepEqual(s.series,[2,2,3,0,0,0,0],'skips and time-outs are answers; the previous Sunday and next Monday are excluded');
 assert.equal(s.total,7);assert.equal(s.words,2,'distinct words of vocabulary answers only');assert.equal(s.collocations,2);assert.equal(s.articles,1,'only reads of this week');assert.equal(s.todayIndex,2);
 const empty=H.weekStats({},TODAY);assert.deepEqual(empty.series,[0,0,0,0,0,0,0]);assert.equal(empty.total,0);assert.equal(empty.words,0);
 assert.equal(H.PROGRESS_METRIC,'answers');assert.equal(H.METRICS.answers.label,'今週の回答数');
});
test('minutes are estimated at 30 seconds per question',()=>{assert.equal(H.minutesFor(10),5);assert.equal(H.minutesFor(3),2);assert.equal(H.minutesFor(1),1);assert.equal(H.minutesFor(24),12);assert.equal(H.minutesFor(0),1);});
test('the practice set: first not-cleared set in genre and number order; when all are cleared, the lowest best, ties to the earlier set',()=>{
 const genres=[{id:'b',order:2},{id:'a',order:1}],sets=[{id:'b1',genre:'b',setNumber:1},{id:'a2',genre:'a',setNumber:2},{id:'a1',genre:'a',setNumber:1}];
 assert.equal(H.pickSet(genres,sets,()=>null).id,'a1');
 assert.equal(H.pickSet(genres,sets,s=>s.id==='a1'?10:null).id,'a2');
 assert.equal(H.pickSet(genres,sets,s=>s.id==='a1'?10:s.id==='a2'?9:null).id,'a2','a 9/10 set is not cleared');
 assert.equal(H.pickSet(genres,sets,()=>10).id,'a1','all cleared and tied: genre order, then set number');
 assert.equal(H.pickSet(genres,sets,s=>({a1:10,a2:10,b1:10})[s.id]).id,'a1');
 assert.equal(H.pickSet([],[],()=>null),null);
});
const articles=[{id:'n2',title:'Newest',readingMinutes:6},{id:'n1',title:'Older',readingMinutes:4}];
const base={wordReview:0,collocReview:0,set:{id:'basic-01',title:'基礎単語①'},articles,readIds:new Set()};
test('today tasks: review when there is something to review, otherwise a set, a collocation quiz and the newest unread article',()=>{
 let t=H.tasks(base,{});
 assert.deepEqual(t.map(x=>[x.kind,x.title,x.sub,x.done]),[['vocab','基礎単語①','10問・約5分',false],['colloc','組み合わせクイズ','10問・約5分',false],['article','記事を読む','Newest・約6分',false]]);
 t=H.tasks({...base,wordReview:7,collocReview:3},{});assert.deepEqual([t[0].title,t[0].sub,t[1].title,t[1].sub],['今日の復習','7語・約4分','組み合わせの復習','3件・約2分']);
 t=H.tasks({...base,readIds:new Set(['n2'])},{});assert.equal(t[2].title,'記事を読む');assert.match(t[2].sub,/Older/,'the newest article that is still unread');
 t=H.tasks({...base,readIds:new Set(['n1','n2'])},{});assert.equal(t[2].title,'記事を読み直す');assert.match(t[2].sub,/Newest/);
 t=H.tasks({...base,articles:[],set:null},{});assert.equal(t[0].action,'none');assert.equal(t[2].action,'none');
 t=H.tasks(base,{vocab:true,article:true});assert.deepEqual(t.map(x=>x.done),[true,false,true]);
});
test('the primary button: first task, next task, or nothing when everything is done',()=>{
 const list=done=>H.tasks(base,done);
 assert.deepEqual(H.primaryState(list({})),{kind:'start',task:list({})[0],label:'最初のタスクをはじめる'});
 const mid=H.primaryState(list({vocab:true}));assert.equal(mid.label,'次のタスクをはじめる');assert.equal(mid.task.kind,'colloc');
 assert.equal(H.primaryState(list({vocab:true,colloc:true})).task.kind,'article');
 assert.equal(H.primaryState(list({vocab:true,colloc:true,article:true})).kind,'complete');
 assert.equal(H.primaryState([{kind:'vocab',action:'none',done:false}]).kind,'complete','tasks that cannot start never offer a button');
});
test('completion: local record, 10+ answers of one synced session, or an article read today; yesterday does not count',()=>{
 const answers=(n,session,ts,kind='vocab')=>Array.from({length:n},(_,i)=>kind==='vocab'?vocab(ts+i*1000,{sessionId:session}):{answeredAt:iso(ts+i*1000),collocationId:'c'+i,sessionId:session});
 assert.deepEqual(H.doneToday({},TODAY),{vocab:false,colloc:false,article:false});
 assert.deepEqual(H.doneToday({completions:[{date:TODAY,kind:'colloc',sessionId:'x'},{date:'2026-10-06',kind:'vocab',sessionId:'y'}]},TODAY),{vocab:false,colloc:true,article:false});
 assert.equal(H.doneToday({vocabLogs:answers(10,'s',jst(2026,10,7,9))},TODAY).vocab,true);
 assert.equal(H.doneToday({vocabLogs:answers(9,'s',jst(2026,10,7,9))},TODAY).vocab,false,'a short session is not enough without a local record');
 assert.equal(H.doneToday({vocabLogs:[...answers(5,'s1',jst(2026,10,7,9)),...answers(5,'s2',jst(2026,10,7,10))]},TODAY).vocab,false,'answers of different sessions are not added together');
 assert.equal(H.doneToday({vocabLogs:answers(10,'s',jst(2026,10,6,23,50))},TODAY).vocab,false,'yesterday');
 assert.equal(H.doneToday({collocLogs:answers(10,'c',jst(2026,10,7,9),'colloc')},TODAY).colloc,true);
 assert.equal(H.doneToday({reads:{a:{completedAt:iso(jst(2026,10,7,8))}}},TODAY).article,true);assert.equal(H.doneToday({reads:{a:{completedAt:iso(jst(2026,10,6,8))}}},TODAY).article,false);
 assert.equal(H.doneToday({articleAnswers:[{answeredAt:iso(jst(2026,10,7,8)),articleId:'a',sessionId:'r'}]},TODAY).article,false,'answering a question is not reading the article');
});
test('completions are recorded once per session with the Japan date and kept to a bounded list',()=>{
 let list=H.addCompletion([],'vocab','s1',jst(2026,10,7,23,59));assert.deepEqual(list.map(c=>[c.date,c.kind,c.sessionId]),[['2026-10-07','vocab','s1']]);
 assert.equal(H.addCompletion(list,'vocab','s1',jst(2026,10,8,0,1)),list,'the same session is never recorded twice');
 assert.equal(H.addCompletion(list,'colloc','s1',jst(2026,10,7,23,59)).length,2);assert.equal(H.addCompletion(list,'listening','s2',0),list);
 let long=[];for(let i=0;i<250;i++)long=H.addCompletion(long,'vocab','s'+i,jst(2026,10,7,9));assert.equal(long.length,200);assert.equal(long[199].sessionId,'s249');
});
test('recent learning: sessions and articles newest first, three at most, with readable ages',()=>{
 const now=jst(2026,10,7,12,0);
 const data={vocabLogs:[vocab(jst(2026,10,7,11,30),{wordId:'a1',sessionId:'s1'}),vocab(jst(2026,10,7,11,31),{wordId:'a2',sessionId:'s1'}),vocab(jst(2026,10,7,10,0),{wordId:'z9',sessionId:'s2'}),vocab(jst(2026,10,5,9,0),{wordId:'a1',sessionId:'s3'})],
  collocLogs:[{answeredAt:iso(jst(2026,10,7,11,55)),collocationId:'c',wordId:'w',sessionId:'cs'}],articleAnswers:[{answeredAt:iso(jst(2026,10,7,8,0)),articleId:'art',sessionId:'r'}],reads:{art:{completedAt:iso(jst(2026,10,7,8,10))},gone:{completedAt:iso(jst(2026,10,7,7,0))}}};
 const resolve={setTitleOf:ids=>ids.every(id=>id.startsWith('a'))?'基礎単語①':null,articleTitle:id=>id==='art'?'A good article':null};
 const list=H.recent(data,now,resolve);
 assert.deepEqual(list.map(x=>[x.kind,x.title,x.sub]),[['colloc','組み合わせのクイズ','組み合わせ・5分前'],['vocab','基礎単語①','単語・29分前'],['vocab','単語の復習','単語・2時間前']]);
 assert.equal(H.recent(data,now,resolve,10).length,5,'unknown articles are skipped; sessions and articles are separate entries');
 assert.deepEqual(H.recent({},now,resolve),[]);
 assert.equal(H.agoText(now-30000,now),'たった今');assert.equal(H.agoText(now-26*3600000,now),'10月6日');assert.equal(H.agoText(now+60000,now),'たった今');
});
