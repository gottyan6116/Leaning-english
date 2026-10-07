// One-time build of the stage 10 word sets (5 genres x 3 sets) from the authoring data below.
// After it runs, materials/vocabulary/*.json are the source of truth. It refuses to overwrite them without --force.
// Every word is checked against the open word lists in materials/validation (CEFR-J v1.5, Octanove C1/C2 v1.0, BSL 1.2).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),dir=path.join(root,'materials','vocabulary');
if(fs.existsSync(path.join(dir,'basic-01.json'))&&!process.argv.includes('--force')){console.error('word sets already exist; edit the JSON directly (or pass --force to rebuild)');process.exit(1);}
function csv(file){return fs.readFileSync(path.join(root,'materials/validation',file),'utf8').replace(/^﻿/,'').split(/\r?\n/).slice(1).filter(Boolean).map(l=>{const p=l.split(',');return {head:p[0],pos:p[1],level:p[2]};});}
const LISTS=[
 {name:'CEFR-J Wordlist',version:'1.5',rows:csv('cefrj-vocabulary-profile-1.5.csv'),url:'https://github.com/openlanguageprofiles/olp-en-cefrj/blob/master/cefrj-vocabulary-profile-1.5.csv',license:'CEFR-J (free with citation)'},
 {name:'Octanove Vocabulary Profile C1/C2',version:'1.0',rows:csv('octanove-vocabulary-profile-c1c2-1.0.csv'),url:'https://github.com/openlanguageprofiles/olp-en-cefrj/blob/master/octanove-vocabulary-profile-c1c2-1.0.csv',license:'CC-BY-SA-4.0'}
];
const BSL=new Set(fs.readFileSync(path.join(root,'materials/validation/bsl-1.2-lemmatized-for-teaching.csv'),'utf8').split(/\r?\n/).filter(Boolean).map(l=>l.split(',')[0].trim().toLowerCase()));
const GENRES=[
 {id:'basic',name:'基礎単語',order:1,levelRange:'A1〜A2',bands:['A1','A2']},
 {id:'daily',name:'日常単語',order:2,levelRange:'A2〜B1',bands:['A2','B1']},
 {id:'business',name:'ビジネス単語',order:3,levelRange:'B1〜B2',bands:['B1','B2']},
 {id:'advanced',name:'アドバンス単語',order:4,levelRange:'B2〜C1',bands:['B2','C1']},
 {id:'super',name:'超アドバンス単語',order:5,levelRange:'C1〜C2',bands:['C1','C2']}
];
const band=id=>GENRES.find(g=>g.id===id).bands;
function find(head,pos,bands){for(const list of LISTS){const hit=list.rows.find(r=>r.head.split('/').includes(head)&&r.pos===pos&&bands.includes(r.level));if(hit)return {...hit,list};}return null;}
const W=(h,pos,ja,def,ex,d)=>({h,pos,ja,def,ex,d});
const D=(head,ja,def)=>({head,ja,def});
// [genre, setNumber, setId, words]
const SETS=[
 ['basic',1,'basic-01',[
  W('kitchen','noun','台所','a room where people cook food','She is making soup in the kitchen.',[D('bathroom','浴室','a room where people wash their bodies'),D('classroom','教室','a room where students have lessons'),D('library','図書館','a room where people read and borrow books')]),
  W('ticket','noun','切符','a piece of paper that lets you travel','I bought a train ticket at the station.',[D('map','地図','a piece of paper that shows places'),D('letter','手紙','a piece of paper that carries a message'),D('bill','請求書','a piece of paper that shows a price')]),
  W('bridge','noun','橋','a structure that lets people cross a river','We walked across the old bridge.',[D('tower','塔','a tall structure that you can see from far away'),D('fence','柵','a structure that goes around a garden'),D('building','建物','a structure with walls and a roof')]),
  W('pocket','noun','ポケット','a small part of clothes where you keep things','He put his phone in his pocket.',[D('skirt','スカート','a piece of clothing that hangs from the waist'),D('button','ボタン','a small round object that closes clothes'),D('glove','手袋','a piece of clothing that covers a hand')]),
  W('borrow','verb','借りる','to take something and give it back later','Can I borrow your pen for a minute?',[D('wash','洗う','to clean something with water'),D('catch','捕まえる','to take hold of something that moves'),D('listen','聞く','to pay attention to a sound')]),
  W('carry','verb','運ぶ','to hold something and take it to a place','She carries her lunch to school in a bag.',[D('wait','待つ','to stay in a place until something happens'),D('clean','掃除する','to take dirt off something'),D('open','開ける','to move something so that it is not closed')]),
  W('forget','verb','忘れる','to fail to remember something','I forgot my umbrella on the train.',[D('answer','答える','to say something when someone asks'),D('send','送る','to make something go to another place'),D('enjoy','楽しむ','to feel pleasure from something')]),
  W('heavy','adjective','重い','weighing a lot','This bag is too heavy for me.',[D('busy','忙しい','having a lot of things to do'),D('tired','疲れた','needing to rest or sleep'),D('hungry','空腹の','wanting to eat food')]),
  W('empty','adjective','空の','having nothing inside','The box was empty when we opened it.',[D('wet','ぬれた','covered with water'),D('dark','暗い','without much light'),D('dirty','汚れた','covered with dirt')]),
  W('noisy','adjective','うるさい','making a lot of sound','The street was noisy all night.',[D('cheap','安い','costing very little money'),D('tall','背が高い','measuring a lot from bottom to top'),D('hungry','空腹の','wanting to eat food')])
 ]],
 ['basic',2,'basic-02',[
  W('airport','noun','空港','a place where planes arrive and leave','We waited at the airport for two hours.'),
  W('umbrella','noun','傘','a thing that keeps rain off your head','Take an umbrella because it may rain.'),
  W('corner','noun','角','the place where two streets meet','The shop is on the corner of the street.'),
  W('shoulder','noun','肩','the part of the body next to the neck','He carried the bag on his shoulder.'),
  W('wash','verb','洗う','to clean something with water','I wash my hands before dinner.'),
  W('catch','verb','捕まえる','to take hold of something that moves','She can catch the ball with one hand.',[D('clean','掃除する','to take dirt off something'),D('enjoy','楽しむ','to feel pleasure from something'),D('answer','答える','to say something when someone asks')]),
  W('push','verb','押す','to use force to move something away','Please push the door to open it.'),
  W('tired','adjective','疲れた','needing to rest or sleep','I was tired after the long walk.'),
  W('cheap','adjective','安い','costing very little money','These shoes were cheap.'),
  W('tall','adjective','背が高い','having a great height','My brother is very tall.',[D('noisy','うるさい','making a lot of sound'),D('busy','忙しい','having a lot of things to do'),D('hungry','空腹の','wanting to eat food')])
 ]],
 ['basic',3,'basic-03',[
  W('mountain','noun','山','a very high hill','We climbed the mountain on Sunday.'),
  W('bottle','noun','瓶','a container with a narrow neck','She filled the bottle with water.'),
  W('holiday','noun','休暇','a time when you do not work','We spent our holiday at the beach.'),
  W('ground','noun','地面','the surface that you walk on','The ground was wet after the rain.'),
  W('send','verb','送る','to make something go to another place','I will send you a message tonight.'),
  W('enjoy','verb','楽しむ','to feel pleasure from something','They enjoy walking in the park.'),
  W('answer','verb','答える','to say something when someone asks','He answered the question quickly.'),
  W('quiet','adjective','静かな','making very little sound','The library is a quiet place.'),
  W('busy','adjective','忙しい','having a lot of things to do','My mother is busy on Mondays.'),
  W('dark','adjective','暗い','without much light','It was dark when we got home.')
 ]],
 ['daily',1,'daily-01',[
  W('dentist','noun','歯科医','a doctor who looks after your teeth','I visit the dentist twice a year.'),
  W('appointment','noun','予約','a time that you arrange to see someone','I have a dentist appointment at ten.',[D('apartment','アパート','a set of rooms for living in one building'),D('countryside','田舎','land outside towns and cities'),D('traffic','交通','the cars and trucks on a road')]),
  W('luggage','noun','荷物','the bags that you take on a trip','Please keep your luggage with you.'),
  W('traffic','noun','交通','the cars and trucks on a road','The traffic was heavy this morning.'),
  W('cancel','verb','取り消す','to say that something will not happen','They cancelled the picnic because of rain.'),
  W('repair','verb','修理する','to make something broken work again','He repaired the bike in the garage.'),
  W('reserve','verb','予約する','to ask for something to be kept for you','I reserved a table for four.'),
  W('comfortable','adjective','快適な','giving you a pleasant and relaxed feeling','This sofa is very comfortable.',[D('crowded','混雑した','full of many people'),D('dangerous','危険な','likely to cause harm'),D('embarrassed','恥ずかしい','feeling shy or foolish in front of others')]),
  W('convenient','adjective','便利な','easy to use or to reach','The station is convenient for shopping.',[D('crowded','混雑した','full of many people'),D('dangerous','危険な','likely to cause harm'),D('impossible','不可能な','not able to be done')]),
  W('nervous','adjective','緊張した','worried and unable to relax','She felt nervous before the interview.')
 ]],
 ['daily',2,'daily-02',[
  W('receipt','noun','レシート','a paper that shows what you paid for','Keep the receipt in case you want to return it.'),
  W('schedule','noun','予定表','a plan of what will happen and when','My schedule for Monday is full.'),
  W('apartment','noun','アパート','a set of rooms for living in one building','They rent a small apartment near the park.'),
  W('invitation','noun','招待','a request to come to an event','I got an invitation to her party.'),
  W('deliver','verb','配達する','to take something to a person or place','The shop delivers food to your door.'),
  W('recommend','verb','勧める','to say that something is good to try','Can you recommend a good restaurant?',[D('deliver','配達する','to take something to a person or place'),D('discover','発見する','to find something for the first time'),D('prepare','準備する','to make something ready')]),
  W('rent','verb','賃借りする','to pay money to use a place or thing','We rent a car when we travel.'),
  W('polite','adjective','礼儀正しい','showing good manners to other people','The waiter was very polite.'),
  W('crowded','adjective','混雑した','full of many people','The train was crowded this morning.'),
  W('familiar','adjective','見慣れた','seen or heard many times before','The song sounded familiar to me.')
 ]],
 ['daily',3,'daily-03',[
  W('fridge','noun','冷蔵庫','a machine that keeps food cold','Put the milk in the fridge.'),
  W('pharmacy','noun','薬局','a shop where medicines are sold','The pharmacy closes at nine.'),
  W('rubbish','noun','ごみ','things that you throw away','Put the rubbish in the bin.'),
  W('gym','noun','ジム','a place where people exercise','He goes to the gym after work.'),
  W('pack','verb','荷造りする','to put things into a bag or box','I packed my bag the night before.'),
  W('recycle','verb','再利用する','to use waste again to make new things','We recycle bottles and paper.'),
  W('bake','verb','焼く','to cook food in an oven','She bakes bread every Sunday.'),
  W('patient','adjective','辛抱強い','able to wait without getting angry','Be patient; the bus will come soon.'),
  W('relaxed','adjective','くつろいだ','feeling calm and not worried','He felt relaxed on the beach.'),
  W('cheerful','adjective','陽気な','happy and full of good spirits','The shop owner is always cheerful.')
 ]],
 ['business',1,'business-01',[
  W('deadline','noun','締め切り','the time by which a task must be finished','The deadline for the report is Friday.'),
  W('client','noun','顧客','a person who pays for a service','We met a new client this morning.'),
  W('refund','noun','返金','money that is paid back to a customer','She asked for a refund for the broken lamp.'),
  W('shortage','noun','不足','not having enough of something','There is a shortage of skilled workers.'),
  W('obtain','verb','入手する','to get something by asking or trying','You must obtain a permit first.'),
  W('postpone','verb','延期する','to move an event to a later time','The meeting was postponed until next week.'),
  W('repay','verb','返済する','to pay back money that you borrowed','He repaid the loan in two years.'),
  W('urgent','adjective','緊急の','needing action or attention at once','I have an urgent message for you.'),
  W('thorough','adjective','徹底的な','done with great care and attention to detail','The team made a thorough check of the plan.'),
  W('ambitious','adjective','野心的な','having a strong wish to succeed','The company has an ambitious sales target.')
 ]],
 ['business',2,'business-02',[
  W('merger','noun','合併','the joining of two companies into one','The merger created the largest bank in the region.'),
  W('brochure','noun','小冊子','a thin book with details about a product','The hotel sent us a colour brochure.'),
  W('feedback','noun','意見','comments about how well someone has done','We asked customers for feedback on the new app.'),
  W('warranty','noun','保証','a written promise to repair a product','The laptop has a two-year warranty.'),
  W('clarify','verb','明確にする','to make something easier to understand','Could you clarify what you mean?'),
  W('simplify','verb','簡素化する','to make something easier to do','The new form simplifies the process.'),
  W('upgrade','verb','格上げする','to change something to a better version','We upgraded our computers last month.'),
  W('competent','adjective','有能な','able to do a job well','She is a competent manager.'),
  W('affordable','adjective','手頃な価格の','not too expensive for most people','The company sells affordable laptops.'),
  W('valid','adjective','有効な','officially acceptable for a period of time','Your ticket is valid for three days.')
 ]],
 ['business',3,'business-03',[
  W('recession','noun','景気後退','a period when the economy gets weaker','Many shops closed during the recession.'),
  W('audit','noun','監査','an official check of a company\'s accounts','The audit found no serious errors.'),
  W('applicant','noun','応募者','a person who asks formally for a job','Each applicant must send a short letter.'),
  W('supervisor','noun','上司','a person who guides other workers','My supervisor approved the plan.'),
  W('enforce','verb','実施させる','to make people obey a rule or law','The city enforces strict parking rules.'),
  W('compile','verb','まとめる','to collect information and put it together','She compiled a report from several sources.'),
  W('endorse','verb','支持する','to say publicly that you support something','The union endorsed the new agreement.'),
  W('eligible','adjective','資格のある','having the right to do or receive something','Students are eligible for a discount.'),
  W('profitable','adjective','利益の出る','making more money than it costs','The shop became profitable last year.'),
  W('reluctant','adjective','気が進まない','not willing to do something','He was reluctant to sign the contract.')
 ]],
 ['advanced',1,'advanced-01',[
  W('consensus','noun','合意','an agreement shared by most people','The group reached a consensus after a long talk.'),
  W('dilemma','noun','板挟み','a hard choice between two options','She faced a dilemma between family and work.'),
  W('bureaucracy','noun','官僚制','a system with many official rules and steps','The bureaucracy delayed the building project.'),
  W('controversy','noun','論争','a public argument about something','The new law caused great controversy.'),
  W('concede','verb','認める','to admit that something is true or right','He conceded that the plan had some weaknesses.'),
  W('confront','verb','直面する','to face a difficult person or problem','The manager confronted the issue directly.'),
  W('persist','verb','粘る','to keep going in spite of problems','She persisted with her studies despite many problems.'),
  W('coherent','adjective','一貫した','logical and easy to follow','The report gave a coherent account of events.'),
  W('eloquent','adjective','雄弁な','able to speak clearly and with force','She gave an eloquent speech at the meeting.'),
  W('subtle','adjective','微妙な','not obvious and hard to notice','There is a subtle difference between the two words.')
 ]],
 ['advanced',2,'advanced-02',[
  W('consent','noun','同意','permission to do something','Parents must give written consent for the trip.'),
  W('alliance','noun','同盟','an agreement between groups to work together','The two parties formed an alliance before the vote.'),
  W('flaw','noun','欠陥','a mistake or weakness in something','The test revealed a serious flaw in the design.'),
  W('outlook','noun','見通し','what is likely to happen in the future','The economic outlook is better than last year.'),
  W('reinforce','verb','補強する','to make something stronger','The results reinforce our earlier findings.'),
  W('suppress','verb','抑え込む','to stop something from being seen or heard','The government tried to suppress the news.'),
  W('inherit','verb','受け継ぐ','to get things when someone dies','She inherited the house from her aunt.'),
  W('legitimate','adjective','正当な','fair and allowed by the law','He has a legitimate reason for being late.',[D('eloquent','雄弁な','able to speak clearly and with force'),D('competent','有能な','able to do a job well'),D('affordable','手頃な価格の','not too expensive for most people')]),
  W('adverse','adjective','不利な','harmful or likely to cause problems','Adverse weather forced the team to stay indoors.'),
  W('modest','adjective','控えめな','not large and not too proud of yourself','He lives in a modest house near the station.')
 ]],
 ['advanced',3,'advanced-vocabulary-c1-01',[]],
 ['super',1,'super-01',[
  W('turmoil','noun','混乱','a situation of great confusion and worry','The sudden news left the whole office in turmoil.',[D('jurisdiction','司法権','the power to make legal decisions in an area'),D('quirk','奇癖','a habit that other people find strange'),D('fossil','化石','the remains of a plant kept in old rock')]),
  W('legacy','noun','遺産','something that a person leaves for the future',"The mayor's main legacy is the new public library.",[D('tact','如才なさ','the ability to speak without upsetting people'),D('specimen','標本','a single example used to study a whole group'),D('hostility','敵意','a strong feeling of anger toward someone')]),
  W('hypocrisy','noun','偽善','pretending to be better than you really are','Many people criticised the hypocrisy of the speech.',[D('complexity','複雑さ','the state of having many connected parts'),D('trauma','心の傷','a deep shock after a terrible event'),D('sponsorship','後援','money given to support an event or person')]),
  W('scenario','noun','筋書き','an imagined series of events that might happen','In the worst scenario, the match would be cancelled.',[D('fraction','断片','a small part of a whole thing'),D('drawback','欠点','a disadvantage that makes something less useful'),D('expedition','探検隊','a group sent on a long trip for a special purpose')]),
  W('evoke','verb','喚起する','to bring a feeling or memory to mind','The smell of bread evoked memories of my childhood.',[D('suffice','足りる','to be enough for a particular need'),D('comprise','構成する','to be made up of particular parts'),D('concur','同意する','to have the same opinion as someone')]),
  W('comply','verb','従う','to do what a rule or request says','All visitors must comply with the safety rules.',[D('marvel','驚嘆する','to feel great surprise and admiration'),D('congregate','集まる','to come together in a large group'),D('formulate','考案する','to prepare a plan or idea carefully')]),
  W('depict','verb','描写する','to show something in a picture or in words','The painting depicts a village in winter.',[D('expire','期限が切れる','to come to the end of a set time'),D('prowl','うろつく','to move quietly around a place'),D('speculate','推測する','to form an opinion without enough facts')]),
  W('candid','adjective','率直な','honest and direct in what you say','She gave a candid answer about her mistakes.',[D('eccentric','風変わりな','unusual in a way that people find odd'),D('tedious','退屈な','boring because it lasts too long'),D('portable','持ち運べる','easy to carry from place to place')]),
  W('versatile','adjective','用途の広い','able to be used in many different ways','A simple black coat is a versatile piece of clothing.',[D('vertical','垂直の','going straight up from the ground'),D('vicious','悪質な','cruel and likely to cause harm'),D('smug','うぬぼれた','too pleased with oneself')]),
  W('superficial','adjective','表面的な','looking only at the surface','His knowledge of the subject is rather superficial.',[D('placid','穏やかな','calm and not easily upset'),D('unconventional','型破りな','different from what most people do'),D('ferocious','獰猛な','fierce and likely to attack')])
 ]],
 ['super',2,'super-02',[
  W('ingenuity','noun','工夫の才','skill in finding clever new ways to do things','The engineer solved the problem with great ingenuity.'),
  W('rapport','noun','信頼関係','a close and friendly understanding between people','The teacher quickly built a rapport with her class.'),
  W('conformity','noun','順応','behaviour that follows the usual rules of a group','The school values creativity more than conformity.'),
  W('discourse','noun','言説','serious talk or writing about a subject','Public discourse about the issue has become angry.'),
  W('perpetuate','verb','助長する','to make a bad situation continue','Such stories perpetuate old stereotypes.'),
  W('exert','verb','及ぼす','to use power or influence on something','The moon exerts a strong pull on the sea.'),
  W('resonate','verb','共鳴する','to have a strong meaning for someone','Her message resonated with many young voters.'),
  W('robust','adjective','頑丈な','strong and unlikely to fail','The company has a robust plan for growth.'),
  W('tenacious','adjective','粘り強い','very determined and unwilling to give up','She is a tenacious reporter who never drops a story.'),
  W('insightful','adjective','鋭い','showing a deep understanding','His insightful comments changed the discussion.')
 ]],
 ['super',3,'super-03',[
  W('minutiae','noun','細部','very small and exact details','The committee argued over the minutiae of the contract.'),
  W('adversary','noun','敵対者','a person or group that you compete against','The two companies have been adversaries for years.'),
  W('demise','noun','終焉','the end of something that was once successful','The demise of the local newspaper saddened many readers.'),
  W('pinnacle','noun','頂点','the highest or most successful point','Winning the prize was the pinnacle of her career.'),
  W('bequeath','verb','遺贈する','to leave money or things to someone when you die','He bequeathed his books to the university.'),
  W('squander','verb','浪費する','to waste money, time or chances','They squandered the chance to win the game.'),
  W('fluctuate','verb','変動する','to change often between high and low','Prices fluctuate from one season to the next.'),
  W('stringent','adjective','厳格な','very strict and difficult to meet','The factory must meet stringent safety standards.'),
  W('convoluted','adjective','入り組んだ','very complicated and hard to follow','The film has a convoluted plot that confuses many viewers.'),
  W('meticulous','adjective','細心の','very careful about small details','She keeps meticulous records of every sale.')
 ]]
];
// Rebuilt C1(1): ids, examples and the original selection stay; translations and definitions follow the new policy.
const C1=[
 ['vocab-000001','constraint','noun','制約','a limit on what you can do'],
 ['vocab-000002','scrutiny','noun','精査','careful and close examination'],
 ['vocab-000003','premise','noun','前提','an idea that an argument is based on'],
 ['vocab-000004','allegation','noun','疑惑','a claim that has not been proved'],
 ['vocab-000005','alleviate','verb','和らげる','to make pain or trouble less severe'],
 ['vocab-000006','compel','verb','強いる','to force someone to do something'],
 ['vocab-000007','impede','verb','妨げる','to make progress slow or difficult'],
 ['vocab-000008','plausible','adjective','ありそうな','seeming likely to be true'],
 ['vocab-000009','inherent','adjective','固有の','forming a basic part of something'],
 ['vocab-000010','thereby','adverb','それによって','as a result of the action mentioned']
];
const C1_EXPLICIT={plausible:[D('adverse','不利な','harmful or likely to cause problems'),D('eloquent','雄弁な','able to speak clearly and with force'),D('affordable','手頃な価格の','not too expensive for most people')],thereby:[D('beforehand','事前に','at a time before something happens'),D('ordinarily','通常は','most of the time'),D('enormously','とてつもなく','to a very great degree')]};
// Pairs that must never be used as each other's distractor (synonyms, antonyms, close relatives).
const CONFLICTS=[['reserve','cancel'],['comfortable','relaxed'],['patient','relaxed'],['clarify','simplify'],['eligible','valid'],['client','applicant'],['applicant','supervisor'],['robust','tenacious'],['demise','pinnacle'],['stringent','meticulous'],['concede','confront'],['consent','alliance'],['suppress','reinforce'],['legitimate','adverse'],['ambiguity','controversy'],['bureaucracy','controversy'],['postpone','cancel'],['cheap','empty'],['quiet','noisy'],['tired','busy'],['wash','clean'],['alleviate','impede'],['constraint','premise'],['scrutiny','allegation'],['plausible','inherent'],['consensus','controversy'],['recycle','repair'],['consensus','consent'],['eligible','competent'],['nervous','relaxed'],['appointment','invitation'],['rent','reserve'],['comfortable','convenient'],['plausible','coherent'],['plausible','legitimate'],['coherent','legitimate'],['insightful','superficial'],['ingenuity','conformity'],['deliver','send'],['send','deliver']];
const conflict=(a,b)=>CONFLICTS.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
const len=s=>Array.from(String(s).trim()).length;
function lengthOk(arr,answerIndex,maxRatio){const l=arr.map(len),r=[...l].sort((a,b)=>b-a);if(l[answerIndex]===r[0]&&l.filter(n=>n===r[0]).length===1&&r[0]>=r[1]*1.2)return false;return r[0]/r[r.length-1]<=maxRatio;}
const hash=text=>parseInt(crypto.createHash('sha1').update(text).digest('hex').slice(0,8),16);
const errors=[];
// 1) normalise all words
const all=[];let nextId=11,order=0;
for(const [genre,setNumber,setId,words] of SETS){
 if(setId==='advanced-vocabulary-c1-01'){
  const old=JSON.parse(fs.readFileSync(path.join(dir,'c1-unit-01.json'),'utf8'));
  for(const [id,h,pos,ja,def] of C1){const o=old.items.find(x=>x.id===id);if(!o||o.headword!==h)throw Error('C1 item mismatch '+id);words.push({id,h,pos,ja,def,ex:o.example,d:C1_EXPLICIT[h]||null,legacy:o});}
 }
 for(const w of words){w.genre=genre;w.setNumber=setNumber;w.setId=setId;if(!w.id)w.id='vocab-'+String(nextId++).padStart(6,'0');w.order=order++;all.push(w);}
}
// 2) lists check + choose distractors
const poolFor=w=>all.filter(x=>x.genre===w.genre&&x.pos===w.pos&&x.h!==w.h&&!conflict(w.h,x.h));
for(const w of all){
 const hit=find(w.h,w.pos,band(w.genre));if(!hit){errors.push(`${w.h}/${w.pos}: not found in the open lists within ${band(w.genre)}`);continue;}
 w.level=hit.level;w.source=hit;
 if(w.genre==='business'&&!BSL.has(w.h))errors.push(`${w.h}: not in BSL 1.2`);
 if(w.d){for(const d of w.d){const x=find(d.head,w.pos,band(w.genre));if(!x)errors.push(`${w.h}: distractor ${d.head}/${w.pos} not in band`);}
  {const idx=w.order%4,place=(c,wr)=>{const a=[...wr];a.splice(idx,0,c);return a;};if(!lengthOk(place(w.ja,w.d.map(d=>d.ja)),idx,3)||!lengthOk(place(w.def,w.d.map(d=>d.def)),idx,2.5)||!lengthOk(place(w.h,w.d.map(d=>d.head)),idx,3))errors.push(`${w.h}: explicit distractors break the length rule`);}
  continue;}
 const pool=poolFor(w).sort((a,b)=>hash(w.id+a.h)-hash(w.id+b.h));
 let chosen=null;
 outer:for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++)for(let k=j+1;k<pool.length;k++){
  const t=[pool[i],pool[j],pool[k]];
  if(t.some((a,x)=>t.some((b,y)=>x<y&&conflict(a.h,b.h))))continue;
  const idx=w.order%4,place=(c,wr)=>{const a=[...wr];a.splice(idx,0,c);return a;};
  const ja=place(w.ja,t.map(x=>x.ja)),en=place(w.def,t.map(x=>x.def)),je=place(w.h,t.map(x=>x.h));
  if(new Set(ja).size<4||new Set(en).size<4)continue;
  if(lengthOk(ja,idx,3)&&lengthOk(en,idx,2.5)&&lengthOk(je,idx,3)){chosen=t;break outer;}
 }
 if(!chosen){const f={ja:0,en:0,je:0},idx=w.order%4;const place=(c,wr)=>{const a=[...wr];a.splice(idx,0,c);return a;};for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++)for(let k=j+1;k<pool.length;k++){const t=[pool[i],pool[j],pool[k]];if(!lengthOk(place(w.ja,t.map(x=>x.ja)),idx,3))f.ja++;if(!lengthOk(place(w.def,t.map(x=>x.def)),idx,2.5))f.en++;if(!lengthOk(place(w.h,t.map(x=>x.h)),idx,3))f.je++;}errors.push(`${w.h}: no valid distractor set in the ${w.genre}/${w.pos} pool (pool ${pool.length}; failing combos ja/en/je ${f.ja}/${f.en}/${f.je})`);continue;}
 w.d=chosen.map(x=>D(x.h,x.ja,x.def));
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
// 3) write
function questions(w){
 const idx=w.order%4,place=(c,wr)=>{const a=[...wr];a.splice(idx,0,c);return a;};
 const make=(mode,correct,wrongs,heads)=>{const choices=place(correct,wrongs),ids=choices.map((_,i)=>`${w.id}-${mode}-option-${i+1}`);return {choices,answerIndex:idx,choiceIds:ids,correctChoiceId:ids[idx],distractorHeadwords:place(null,heads)};};
 const heads=w.d.map(d=>d.head);
 return {ja:make('ja',w.ja,w.d.map(d=>d.ja),heads),en:make('en',w.def,w.d.map(d=>d.def),heads),ja_en:make('ja_en',w.h,w.d.map(d=>d.head),heads)};
}
const urlOf=w=>w.source.list.url;
for(const [genre,setNumber,setId,words] of SETS){
 const g=GENRES.find(x=>x.id===genre),file=setId==='advanced-vocabulary-c1-01'?'c1-unit-01.json':setId+'.json';
 const old=setId==='advanced-vocabulary-c1-01'?JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')):null;
 const items=words.map(w=>({id:w.id,headword:w.h,partOfSpeech:w.pos,level:w.level,genre,setNumber,meaning:w.ja,definition:w.def,example:w.ex,exampleOrigin:'original-for-this-app',testedSense:`${w.ja}（${w.def}）`,status:'unverified',
  selectionSource:{listName:w.source.list.name,version:w.source.list.version,headword:w.h,partOfSpeech:w.pos,level:w.level,url:urlOf(w),license:w.source.list.license,...(genre==='business'?{businessList:{listName:'Business Service List',version:'1.2',url:'https://www.newgeneralservicelist.com/business-service-list',license:'CC-BY-SA-4.0'}}:{})},
  questions:questions(w)}));
 const set={id:setId,version:old?old.version+1:1,kind:'vocabulary',title:`${g.name} ${'①②③'[setNumber-1]}`,genre,setNumber,level:g.levelRange,status:'draft',publishedAt:old?.publishedAt||'2026-10-07T00:00:00+09:00',license:'CC-BY-SA-4.0',
  levelNotice:'CEFR-J／Octanove Vocabulary Profileのレベル付けに基づく目安',items};
 fs.writeFileSync(path.join(dir,file),JSON.stringify(set,null,2)+'\n');
}
fs.writeFileSync(path.join(dir,'genres.json'),JSON.stringify({id:'wordbook-genres',version:1,kind:'genres',publishedAt:'2026-10-07T00:00:00+09:00',genres:GENRES.map(({id,name,order,levelRange,bands})=>({id,name,order,levelRange,bands}))},null,2)+'\n');
console.log(`${all.length} words in ${SETS.length} sets written`);
