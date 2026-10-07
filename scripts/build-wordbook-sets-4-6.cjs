// One-time build of word sets 4-6 for every genre (stage 11). Same sources, levels and distractor rules as stage 10.
// After it runs, materials/vocabulary/*.json are the source of truth. It refuses to overwrite existing files.
const fs=require('node:fs'),path=require('node:path');
const Quiz=require('../quiz-core.js');
const {definitionLeaks}=require('./validate-wordbook.cjs');
const root=path.join(__dirname,'..'),dir=path.join(root,'materials','vocabulary');
if(fs.existsSync(path.join(dir,'basic-04.json'))&&!process.argv.includes('--force')){console.error('sets 4-6 already exist; edit the JSON directly');process.exit(1);}
function csv(file){return fs.readFileSync(path.join(root,'materials/validation',file),'utf8').replace(/^﻿/,'').split(/\r?\n/).slice(1).filter(Boolean).map(l=>{const p=l.split(',');return {head:p[0],pos:p[1],level:p[2]};});}
const LISTS=[
 {name:'CEFR-J Wordlist',version:'1.5',rows:csv('cefrj-vocabulary-profile-1.5.csv'),url:'https://github.com/openlanguageprofiles/olp-en-cefrj/blob/master/cefrj-vocabulary-profile-1.5.csv',license:'CEFR-J (free with citation)'},
 {name:'Octanove Vocabulary Profile C1/C2',version:'1.0',rows:csv('octanove-vocabulary-profile-c1c2-1.0.csv'),url:'https://github.com/openlanguageprofiles/olp-en-cefrj/blob/master/octanove-vocabulary-profile-c1c2-1.0.csv',license:'CC-BY-SA-4.0'}
];
const BSL=new Set(fs.readFileSync(path.join(root,'materials/validation/bsl-1.2-lemmatized-for-teaching.csv'),'utf8').split(/\r?\n/).filter(Boolean).map(l=>l.split(',')[0].trim().toLowerCase()));
const genres=JSON.parse(fs.readFileSync(path.join(dir,'genres.json'),'utf8')).genres;
const band=id=>genres.find(g=>g.id===id).bands;
function find(head,pos,bands){for(const list of LISTS){const hit=list.rows.find(r=>r.head.split('/').includes(head)&&r.pos===pos&&bands.includes(r.level));if(hit)return {...hit,list};}return null;}
const W=(h,pos,ja,def,ex)=>({h,pos,ja,def,ex});
const n=(...a)=>W(a[0],'noun',...a.slice(1)),v=(...a)=>W(a[0],'verb',...a.slice(1)),j=(...a)=>W(a[0],'adjective',...a.slice(1)),d=(...a)=>W(a[0],'adverb',...a.slice(1));
const SETS=[
 ['basic',4,[
  n('window','窓','an opening in a wall that lets in light','She opened the window to let in some air.'),n('garden','庭','a piece of land with plants near a house','We have lunch in the garden on sunny days.'),n('library','図書館','a place where you can borrow books','I returned my books to the library.'),
  v('cook','料理する','to make food hot so that it can be eaten','My father cooks dinner every night.'),v('climb','登る','to go up something high','The children climbed the tree.'),v('fill','満たす','to put things in until a space is full','She filled the glass with milk.'),
  j('hungry','空腹の','wanting to eat food','I am very hungry after the game.'),j('dirty','汚れた','not clean','Your shoes are dirty.'),
  d('always','いつも','at all times','He always walks to school.'),d('quickly','速く','in a short time','She quickly finished her homework.')]],
 ['basic',5,[
  n('station','駅','a place where trains stop','I met her at the station.'),n('island','島','land with water all around it','They live on a small island.'),n('village','村','a very small town in the country','The village has only one shop.'),
  v('wait','待つ','to stay until something happens','Please wait here for a moment.'),v('clean','掃除する','to take dirt off something','We clean the classroom after lunch.'),v('drop','落とす','to let something fall by accident','Be careful not to drop the plate.'),
  j('wet','ぬれた','covered with water','My hair is wet from the rain.'),j('sweet','甘い','tasting like sugar','The cake was too sweet for me.'),
  d('together','一緒に','with each other','We walked home together.'),d('outside','外で','not in a building','The children are playing outside.')]],
 ['basic',6,[
  n('farm','農場','land where people grow food and keep animals','My uncle works on a farm.'),n('pencil','鉛筆','a thin stick used for writing','Write your name with a pencil.'),n('blanket','毛布','a soft cover that keeps you warm in bed','She put a blanket over the baby.'),
  v('visit','訪ねる','to go and spend time at a place','We visit my grandmother on Sundays.'),v('invite','招く','to ask someone to come to an event','She invited ten friends to her party.'),v('hurry','急ぐ','to move or act fast','Hurry up, or we will miss the bus.'),
  j('sleepy','眠い','ready to go to bed','The baby looks sleepy.'),j('afraid','恐れた','scared of something','She is afraid of dogs.'),
  d('usually','たいてい','most of the time','I usually get up at seven.'),d('carefully','慎重に','so as not to make mistakes','Please carry the cups carefully.')]],
 ['daily',4,[
  n('tourist','観光客','a person who travels for pleasure','A tourist asked me the way to the museum.'),n('souvenir','お土産','something you buy to remember a trip','I bought a small souvenir for my sister.'),n('postcard','絵はがき','a card with a picture that you mail to a friend','She sent us a postcard from Italy.'),
  v('order','注文する','to ask for food or goods to be brought','We ordered two pizzas for dinner.'),v('arrange','手配する','to plan something in advance','She arranged a meeting with the teacher.'),v('prepare','準備する','to make something ready','He is preparing breakfast for the family.'),
  j('exhausted','消耗した','very tired after hard work','The runners were exhausted at the end of the race.'),j('generous','気前のよい','happy to give more than is expected','He is generous with his time.'),
  d('suddenly','突然','quickly and without warning','The lights suddenly went out.'),d('recently','最近','not long ago','I recently moved to a new flat.')]],
 ['daily',5,[
  n('pillow','枕','a soft bag for your head in bed','She put a pillow under her head.'),n('customer','客','a person who buys things from a shop','The customer asked for a smaller size.'),n('discount','割引','a lower price than usual','Students get a discount at the museum.'),
  v('explain','説明する','to make something clear to someone','Can you explain the rules to me?'),v('improve','上達する','to become or make something better','She wants to improve her English.'),v('fasten','留める','to close or join things firmly','Please fasten your seat belt.'),
  j('ordinary','普通の','not special in any way','It was an ordinary day at school.'),j('rough','粗い','having an uneven surface','The path was rough and full of stones.'),
  d('downstairs','階下で','on a lower floor of a building','The kitchen is downstairs.'),d('probably','たぶん','very likely to be true','It will probably rain tomorrow.')]],
 ['daily',6,[
  n('queue','列','a line of people waiting for something','There was a long queue at the bank.'),n('reception','受付','the place in a hotel where guests arrive','Please leave your key at reception.'),n('ingredient','材料','one of the foods used to make a dish','Eggs are the main ingredient in this cake.'),
  v('lend','貸す','to give something for a short time','Can you lend me your umbrella?'),v('lock','鍵をかける','to close with a key','Remember to lock the door.'),v('spill','こぼす','to let liquid fall out by accident','He spilled coffee on his shirt.'),
  j('modern','現代的な','of the present time, not old','The museum has a modern design.'),j('fresh','新鮮な','recently made, picked or caught','These vegetables are fresh from the farm.'),
  d('abroad','海外で','in or to another country','She studied abroad for a year.'),d('afterwards','その後','at a later time','We had dinner, and afterwards we went for a walk.')]],
 ['business',4,[
  n('accountant','会計士','a person whose job is to keep financial records','The accountant checked the figures twice.'),n('retailer','小売業者','a business that sells goods to the public','The retailer lowered its prices before the holidays.'),n('entrepreneur','起業家','a person who starts a new business','The young entrepreneur opened her first shop last year.'),
  v('assemble','組み立てる','to put the parts of something together','The workers assemble the cars by hand.'),v('accumulate','蓄積する','to collect a growing amount over time','Dust accumulated on the old shelves.'),v('facilitate','円滑にする','to make a process easier','Good software can facilitate teamwork.'),
  j('compulsory','義務の','required by a rule or law','Safety training is compulsory for all staff.'),j('costly','費用のかかる','needing a lot of money to buy or do','A mistake at this stage would be costly.'),
  d('annually','毎年','once every year','The company holds a meeting annually.'),d('financially','財政的に','in a way that relates to money','The firm is financially stable.')]],
 ['business',5,[
  n('overtime','残業','work done after normal hours','She earns extra pay for overtime.'),n('resignation','辞職','the act of leaving a job by choice','He handed in his resignation on Monday.'),n('signature','署名','your name written in your own way','Please add your signature at the bottom.'),
  v('inspect','検査する','to look at something closely to check it','The manager inspected the finished products.'),v('merge','合併する','to join with another to form one','The two banks plan to merge next year.'),v('transmit','送信する','to send a signal or message to another place','The device transmits data every minute.'),
  j('innovative','革新的な','using new and original ideas','The firm is known for its innovative designs.'),j('preliminary','予備的な','coming before the main part','The preliminary results were published in May.'),
  d('formally','正式に','in an official way','The contract was formally signed on Friday.'),d('promptly','迅速に','without any delay','She replied to the email promptly.')]],
 ['business',6,[
  n('allowance','手当','extra money given for a special purpose','He receives a travel allowance every month.'),n('replacement','代替品','something that takes the place of another','We ordered a replacement for the broken part.'),n('seminar','セミナー','a small class where people discuss a subject','She gave a seminar on marketing.'),
  v('conceal','隠す','to hide something so that it is not seen','He tried to conceal his mistake.'),v('bargain','値切る','to discuss a price to get a lower one','They bargained with the seller for an hour.'),v('retrieve','取り戻す','to get something back from a place','She retrieved her bag from the lost-property office.'),
  j('seasonal','季節の','happening at a particular time of year','Seasonal workers pick the fruit in autumn.'),j('transparent','透明な','clear enough to see through','The box has a transparent lid.'),
  d('steadily','着実に','at an even, continuing rate','Sales rose steadily over the year.'),d('temporarily','一時的に','for a short time only','The shop is temporarily closed.')]],
 ['advanced',4,[
  n('incentive','動機づけ','something that encourages you to act','A bonus is a strong incentive to work harder.'),n('stereotype','固定観念','a fixed idea about a type of person','The film challenges the stereotype of the lazy teenager.'),n('initiative','主導権','the power to act first and take charge','She took the initiative and called the client.'),
  v('exploit','利用する','to use something to gain an advantage','Smart investors exploit small changes in price.'),v('interfere','干渉する','to get involved in a way that is not wanted','Please do not interfere in my decision.'),v('withdraw','撤回する','to take something back or away','She withdrew her application after the interview.'),
  j('ambiguous','あいまいな','having more than one possible meaning','The instructions were ambiguous, so we asked for help.'),j('comprehensive','包括的な','including all the important parts','The report gives a comprehensive review of the market.'),
  d('remarkably','驚くほど','in a way that is surprising and worth noticing','The team performed remarkably well under pressure.'),d('deliberately','わざと','on purpose and not by accident','He deliberately chose a quiet seat.')]],
 ['advanced',5,[
  n('dispute','紛争','a serious disagreement between two sides','The two firms settled their dispute out of court.'),n('resilience','回復力','the ability to recover quickly from difficulty','The town showed great resilience after the flood.'),n('perspective','視点','a particular way of thinking about something','Travel gave her a wider perspective on life.'),
  v('assess','評価する','to judge the quality or value of something','Teachers assess each student\'s progress every term.'),v('contradict','矛盾する','to say or show the opposite of something','The new data contradict the earlier findings.'),v('compensate','補償する','to give money to make up for a loss','The airline will compensate passengers for the delay.'),
  j('crucial','重大な','extremely important for a result','Good timing is crucial in this job.'),j('decisive','決定的な','having a clear and final effect','Her goal was decisive for the match.'),
  d('undoubtedly','疑いなく','certainly, with no question','She is undoubtedly the best player here.'),d('conversely','逆に','in the opposite way','Some people prefer cities; conversely, others love villages.')]],
 ['advanced',6,[
  n('analogy','類推','a comparison that shows how two things are alike','He used an analogy to explain the idea.'),n('assumption','仮定','something you accept as true without proof','The plan rests on a false assumption.'),n('adversity','逆境','a time of serious difficulty','She stayed positive in the face of adversity.'),
  v('cope','対処する','to deal with a hard situation','She copes well with stress at work.'),v('dominate','支配する','to have the most power or influence over','One company dominates the whole market.'),v('devote','捧げる','to give time or energy to something','He devoted his weekends to the project.'),
  j('objective','客観的な','based on facts rather than feelings','A judge must give an objective opinion.'),j('spontaneous','自発的な','done naturally without being planned','The crowd gave a spontaneous round of applause.'),
  d('substantially','大幅に','to a large degree','Sales increased substantially last quarter.'),d('marginally','わずかに','by a very small amount','Prices rose only marginally this year.')]],
 ['super',4,[
  n('quirk','奇癖','a strange habit that a person has','One of her quirks is eating lunch at ten.'),n('upheaval','大変動','a sudden and big change that causes disorder','The war caused great social upheaval.'),n('protagonist','主人公','the main character in a story','The protagonist of the novel is a young doctor.'),
  v('conceive','思いつく','to form an idea or plan in the mind','He conceived the plan while on holiday.'),v('relinquish','手放す','to give up something such as power','She relinquished her seat on the board.'),v('alienate','疎外する','to make someone feel unwelcome','His rude remarks alienated many supporters.'),
  j('indispensable','不可欠な','so important that you cannot manage without it','A good map is indispensable on this trail.'),j('wary','用心深い','careful about possible danger','She is wary of strangers online.'),
  d('reluctantly','しぶしぶ','in a way that shows you do not want to','He reluctantly agreed to help.'),d('subtly','微妙に','in a way that is not obvious','The colour changes subtly through the day.')]],
 ['super',5,[
  n('irony','皮肉','a situation that is the opposite of what you expect','It was an irony that the fire station burned down.'),n('altruism','利他主義','caring about the needs of others before your own','Her altruism inspired the whole team.'),n('predecessor','前任者','the person who had a job before you','My predecessor left detailed notes.'),
  v('harass','悩ます','to trouble someone again and again','Reporters harassed the family for weeks.'),v('speculate','推測する','to form an opinion without enough facts','People speculate about the cause of the delay.'),v('glean','収集する','to gather facts a little at a time','We gleaned the facts from old letters.'),
  j('negligible','わずかな','too small to matter','The cost of repairs was negligible.'),j('prolific','多作な','producing a large number of works','She is a prolific author with forty books.'),
  d('inexplicably','不可解にも','for a reason that nobody can understand','The train inexplicably stopped in the field.'),d('persuasively','説得力をもって','in a way that makes people agree','She argued persuasively for a change.')]],
 ['super',6,[
  n('respite','小休止','a short rest from something difficult','The rain gave the firefighters a brief respite.'),n('stamina','スタミナ','the strength to keep going for a long time','Marathon runners need great stamina.'),n('cynicism','冷笑','a belief that nobody is truly kind','His cynicism made him hard to impress.'),
  v('embark','乗り出す','to start a new and important activity','She embarked on a career in medicine.'),v('expedite','促進する','to make a process happen faster','Extra staff will expedite the visa process.'),v('bypass','迂回する','to avoid something by going around it','The new road bypasses the town centre.'),
  j('elusive','捉えにくい','hard to find or catch','Success proved elusive for the young team.'),j('benign','良性の','gentle and not causing harm','The doctor said the tumour was benign.'),
  d('naively','世間知らずに','in a way that shows little experience','She naively trusted the stranger.'),d('immensely','非常に','to a very large degree','I enjoyed the concert immensely.')]]
];
const PERSON=new Set(['client','applicant','supervisor','accountant','retailer','entrepreneur','tourist','customer','dentist','protagonist','predecessor','adversary']);
const PAIRS=[['always','usually'],['garden','farm'],['wait','hurry'],['invite','visit'],['clean','dirty'],['tired','sleepy'],['carry','drop'],['catch','drop'],['airport','station'],['wash','clean'],
 ['lend','rent'],['arrange','prepare'],['recently','afterwards'],['suddenly','recently'],['cancel','order'],['reserve','order'],['familiar','ordinary'],
 ['temporarily','annually'],['conceal','retrieve'],['obtain','retrieve'],['simplify','facilitate'],['compile','accumulate'],['urgent','compulsory'],['affordable','costly'],['profitable','costly'],
 ['crucial','decisive'],['remarkably','substantially'],['substantially','marginally'],['stereotype','assumption'],['resilience','adversity'],['exploit','dominate'],['confront','cope'],['subtle','ambiguous'],
 ['cynicism','altruism'],['harass','alienate'],['expedite','bypass'],['conceive','speculate'],['legacy','predecessor'],['turmoil','upheaval'],['hypocrisy','cynicism'],['bequeath','relinquish'],['meticulous','wary'],
 ['quickly','early'],['remarkably','enormously'],['substantially','enormously'],['remarkably','marginally'],['conceive','evoke'],['elusive','convoluted'],['consensus','consent'],['eligible','competent'],['nervous','relaxed'],['appointment','invitation'],['rent','reserve'],['quiet','noisy'],['tired','busy'],['wash','clean']];
const conflict=(a,b)=>PAIRS.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a))||(PERSON.has(a)&&PERSON.has(b));
const len=s=>Array.from(String(s).trim()).length;
function lengthOk(arr,idx,maxRatio){const l=arr.map(len),r=[...l].sort((a,b)=>b-a);if(l[idx]===r[0]&&l.filter(x=>x===r[0]).length===1&&r[0]>=r[1]*1.2)return false;return r[0]/r[r.length-1]<=maxRatio;}
const hash=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const IRREGULAR={withdraw:['withdrew','withdrawn']};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function surfaceOf(w){const h=w.h,b=esc(h),last=b.slice(-1),stem=h.endsWith('e')?esc(h.slice(0,-1)):b,stemY=h.endsWith('y')?esc(h.slice(0,-1)):null;const alts=[b+'(?:s|es|ed|d|ing)?',b+last+'(?:ed|ing)',stem+'(?:ed|ing|er|ers)',...(stemY?[stemY+'(?:ies|ied|ying)']:[]),...(IRREGULAR[h]||[])];const found=w.ex.match(new RegExp('\\b(?:'+alts.join('|')+')\\b','gi'));return found&&found.length===1?found[0]:null;}
// existing words form the distractor pool together with the new ones
const existing=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='genres.json').flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).items).filter(x=>x.setNumber<=3);
const usedHeads=new Set(existing.map(x=>x.headword.toLowerCase())),errors=[];
const all=[];let nextId=existing.reduce((m,x)=>Math.max(m,Number(x.id.slice(6))),0)+1,order=100;
for(const [genre,setNumber,words] of SETS){
 const pos=words.map(w=>w.pos),counts=Object.fromEntries(['noun','verb','adjective','adverb'].map(p=>[p,pos.filter(x=>x===p).length]));
 if(JSON.stringify(counts)!==JSON.stringify({noun:3,verb:3,adjective:2,adverb:2}))errors.push(`${genre}-${setNumber}: part-of-speech balance ${JSON.stringify(counts)}`);
 for(const w of words){w.genre=genre;w.setNumber=setNumber;w.id='vocab-'+String(nextId++).padStart(6,'0');w.order=order++;if(usedHeads.has(w.h.toLowerCase()))errors.push(`${w.h}: duplicate headword`);usedHeads.add(w.h.toLowerCase());all.push(w);}
}
// Distractor-only adverbs (not headwords) so that small adverb pools still offer enough fair choices.
const EXTRA=[['basic','slowly','ゆっくり','at a low speed'],['basic','early','早く','near the start of a period'],['basic','already','すでに','before now'],['basic','upstairs','階上で','on a higher floor of a building'],
 ['advanced','ordinarily','通常は','most of the time'],['advanced','enormously','とてつもなく','to a very great degree'],['advanced','dynamically','動的に','in a way that is full of energy and change'],['advanced','beforehand','事前に','at a time before something happens']].map(([genre,h,ja,def])=>({h,pos:'adverb',ja,def,genre}));
for(const x of EXTRA)if(!find(x.h,'adverb',band(x.genre)))errors.push(`${x.h}: extra distractor not in band`);
const pool=[...EXTRA,...existing.map(x=>({h:x.headword,pos:x.partOfSpeech,ja:x.meaning,def:x.definition,genre:x.genre})),...all.map(x=>({h:x.h,pos:x.pos,ja:x.ja,def:x.def,genre:x.genre}))];
for(const w of all){
 const hit=find(w.h,w.pos,band(w.genre));if(!hit){errors.push(`${w.h}/${w.pos}: not found in the open lists within ${band(w.genre)}`);continue;}
 w.level=hit.level;w.source=hit;if(w.genre==='business'&&!BSL.has(w.h))errors.push(`${w.h}: not in BSL 1.2`);
 const leaks=definitionLeaks(w.h,w.def);if(leaks.length)errors.push(`${w.h}: definition leaks ${leaks}`);
 w.surface=surfaceOf(w);if(!w.surface)errors.push(`${w.h}: cannot blank the example exactly once`);
 const candidates=pool.filter(x=>x.genre===w.genre&&x.pos===w.pos&&x.h!==w.h&&!conflict(w.h,x.h)).sort((a,b)=>hash(w.id+a.h)-hash(w.id+b.h));
 let chosen=null;const idx=w.order%4,place=(c,wr)=>{const a=[...wr];a.splice(idx,0,c);return a;};
 outer:for(let i=0;i<candidates.length;i++)for(let k=i+1;k<candidates.length;k++)for(let m=k+1;m<candidates.length;m++){
  const t=[candidates[i],candidates[k],candidates[m]];if(t.some((a,x)=>t.some((b,y)=>x<y&&conflict(a.h,b.h))))continue;
  const ja=place(w.ja,t.map(x=>x.ja)),en=place(w.def,t.map(x=>x.def)),je=place(w.h,t.map(x=>x.h));
  if(new Set(ja).size<4||new Set(en).size<4)continue;
  if(lengthOk(ja,idx,3)&&lengthOk(en,idx,2.5)&&lengthOk(je,idx,3)){chosen=t;break outer;}
 }
 if(!chosen)errors.push(`${w.h}: no valid distractor set (${w.genre}/${w.pos}, pool ${candidates.length})`);else w.d=chosen;
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
function questions(w){const idx=w.order%4,place=(c,wr)=>{const a=[...wr];a.splice(idx,0,c);return a;},heads=place(null,w.d.map(x=>x.h));
 const make=(mode,correct,wrongs)=>{const choices=place(correct,wrongs),ids=choices.map((_,i)=>`${w.id}-${mode}-option-${i+1}`);return {choices,answerIndex:idx,choiceIds:ids,correctChoiceId:ids[idx],distractorHeadwords:heads};};
 return {ja:make('ja',w.ja,w.d.map(x=>x.ja)),en:make('en',w.def,w.d.map(x=>x.def)),ja_en:make('ja_en',w.h,w.d.map(x=>x.h)),def_en:make('def_en',w.h,w.d.map(x=>x.h))};}
const MARKS='①②③④⑤⑥';
for(const [genre,setNumber,words] of SETS){
 const g=genres.find(x=>x.id===genre);
 const items=words.map(w=>({id:w.id,headword:w.h,partOfSpeech:w.pos,level:w.level,genre,setNumber,meaning:w.ja,definition:w.def,example:w.ex,exampleSurface:w.surface,exampleOrigin:'original-for-this-app',testedSense:`${w.ja}（${w.def}）`,status:'unverified',
  selectionSource:{listName:w.source.list.name,version:w.source.list.version,headword:w.h,partOfSpeech:w.pos,level:w.level,url:w.source.list.url,license:w.source.list.license,...(genre==='business'?{businessList:{listName:'Business Service List',version:'1.2',url:'https://www.newgeneralservicelist.com/business-service-list',license:'CC-BY-SA-4.0'}}:{})},
  questions:questions(w)}));
 const set={id:`${genre}-${String(setNumber).padStart(2,'0')}`,version:1,kind:'vocabulary',title:`${g.name} ${MARKS[setNumber-1]}`,genre,setNumber,level:g.levelRange,status:'draft',publishedAt:'2026-10-07T00:00:00+09:00',license:'CC-BY-SA-4.0',levelNotice:'CEFR-J／Octanove Vocabulary Profileのレベル付けに基づく目安',items};
 fs.writeFileSync(path.join(dir,set.id+'.json'),JSON.stringify(set,null,2)+'\n');
}
console.log(`${all.length} words in ${SETS.length} sets written`);
