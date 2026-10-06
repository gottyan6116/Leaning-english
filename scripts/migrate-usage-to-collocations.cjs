// One-time migration: article vocabulary `usage.combinations` -> materials/collocations/article-collocations.json.
// After this runs the JSON file is the source of truth. It refuses to overwrite it (IDs must stay stable).
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),dir=path.join(root,'materials','articles'),out=path.join(root,'materials','collocations','article-collocations.json');
if(fs.existsSync(out)){console.error('materials/collocations/article-collocations.json already exists; IDs must stay stable. Edit it directly.');process.exit(1);}
const slug=form=>form.toLowerCase().replace(/～/g,'x').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const TYPE_BY_PATTERN={'動詞＋名詞':'verb_noun','動詞＋名詞＋前置詞':'verb_noun','動詞＋名詞＋不定詞':'verb_noun','形容詞＋名詞':'adj_noun','過去分詞＋名詞':'adj_noun','名詞＋前置詞':'noun_prep'};
// Labels "名詞を含む句"/"動詞を含む句" are too coarse; classify these by hand.
const TYPE_OVERRIDE={
 'statistical framework':'adj_noun','policy framework':'other','develop a framework':'verb_noun',
 'cultural practitioners':'adj_noun','experienced practitioners':'adj_noun','consult practitioners':'verb_noun',
 'cultural governance':'adj_noun','good governance':'adj_noun','governance structure':'other',
 'statistical coverage':'adj_noun','extend coverage':'verb_noun','limited coverage':'adj_noun',
 'political representation':'adj_noun','worker representation':'other','fair representation':'adj_noun',
 'policy dialogue':'other','social dialogue':'adj_noun','open dialogue':'adj_noun',
 'protect livelihoods':'verb_noun','rural livelihoods':'adj_noun','sustainable livelihoods':'adj_noun',
 'local networks':'adj_noun','research networks':'other','support networks':'other',
 'farming cooperatives':'other','worker cooperatives':'other','join cooperatives':'verb_noun',
 'economic indicators':'adj_noun','performance indicators':'other','develop indicators':'verb_noun',
 'cultural heritage':'adj_noun','preserve heritage':'verb_noun','shared heritage':'adj_noun',
 'independent evaluation':'adj_noun','conduct an evaluation':'verb_noun','evaluation criteria':'other',
 'resumed work':'adj_noun','resumed operations':'adj_noun','resumed discussions':'adj_noun',
 'a different perspective':'adj_noun','from a scientific perspective':'other','gain perspective':'verb_noun',
 'manage logistics':'verb_noun','logistics network':'other','logistics costs':'other',
 'environmental monitoring':'adj_noun','continuous monitoring':'adj_noun','monitoring system':'other',
 'system deployment':'other','deployment plan':'other','large-scale deployment':'adj_noun'
};
// Fill-in data: [blanked word, three distractors that do not normally combine with the headword].
// Authored for this app; every entry ships as unverified and is reviewed by the owner.
const A=['subtract','unplug','swallow'],ADJ=['hungry','tidal','velvet'],N=['sneeze','fraction','pillow'],NP=['sneezes','fractions','pillows'],M=['luggage','furniture','breakfast'];
const FILL={
 'traditional craftsmanship':['traditional',ADJ],'fine craftsmanship':['fine',ADJ],'preserve craftsmanship':['preserve',A],
 'a distinctive feature':['feature',N],'a distinctive flavour':['flavour',N],'a distinctive style':['style',N],
 'oversee a process':['process',N],'oversee production':['production',M],'transmit knowledge':['knowledge',M],
 'social cohesion':['social',ADJ],'strengthen cohesion':['strengthen',A],'relative abundance':['relative',ADJ],
 'chemical composition':['chemical',ADJ],'analyse the composition':['analyse',A],
 'tentative evidence':['evidence',M],'a tentative conclusion':['conclusion',N],'a tentative plan':['plan',N],
 'definitive evidence':['evidence',M],'a definitive answer':['answer',N],'a definitive account':['account',N],
 'constrain the range':['range',N],'constrain a model':['model',N],'interchangeable parts':['parts',NP],'interchangeable terms':['terms',NP],
 'statistical framework':['statistical',ADJ],'develop a framework':['develop',A],
 'cultural practitioners':['cultural',ADJ],'experienced practitioners':['experienced',ADJ],'consult practitioners':['consult',A],
 'cultural governance':['cultural',ADJ],'good governance':['good',ADJ],
 'statistical coverage':['statistical',ADJ],'extend coverage':['extend',A],'limited coverage':['limited',ADJ],
 'enter a competition':['enter',A],'win a competition':['win',A],'a business competition':['business',ADJ],
 'receive training':['receive',A],'provide training':['provide',A],'practical training':['practical',ADJ],
 'develop an idea':['idea',['sneeze','fraction','sunrise']],'develop a plan':['plan',['sneeze','fraction','sunrise']],'develop skills':['skills',NP],
 'offer support':['offer',A],'financial support':['financial',ADJ],
 'local people':['people',['sneeze','fraction','whisper']],'a local business':['business',['sneeze','fraction','whisper']],'the local community':['community',['sneeze','fraction','whisper']],
 'political representation':['political',ADJ],'fair representation':['fair',ADJ],'social dialogue':['social',ADJ],'open dialogue':['open',ADJ],
 'protect livelihoods':['protect',A],'rural livelihoods':['rural',ADJ],'sustainable livelihoods':['sustainable',ADJ],
 'inclusive policy':['policy',N],'inclusive discussion':['discussion',N],'inclusive workplace':['workplace',N],
 'recognise skills':['skills',NP],'recognise experience':['experience',M],
 'assess skills':['skills',NP],'assess an applicant':['applicant',['pillow','sneeze','breakfast']],'assess the quality':['quality',['pillow','sneeze','breakfast']],
 'gain a qualification':['gain',A],'a professional qualification':['professional',ADJ],'a recognised qualification':['recognised',ADJ],
 'accessible services':['services',NP],'lay a foundation':['lay',A],'a strong foundation':['strong',['hungry','sudden','velvet']],
 'local networks':['local',ADJ],'join cooperatives':['join',A],'economic indicators':['economic',ADJ],'develop indicators':['develop',A],
 'cultural heritage':['cultural',ADJ],'preserve heritage':['preserve',A],'shared heritage':['shared',ADJ],
 'independent evaluation':['independent',ADJ],'conduct an evaluation':['conduct',A],
 'compact design':['design',N],'compact device':['device',N],'compact camera':['camera',N],
 'temporary closure':['closure',N],'temporary position':['position',N],'temporary shelter':['shelter',N],
 'resumed work':['work',['sneeze','fraction','pillow']],'resumed operations':['operations',NP],'resumed discussions':['discussions',NP],
 'a different perspective':['different',ADJ],'gain perspective':['gain',A],
 'a coastal community':['coastal',['hungry','velvet','sleepy']],'support a community':['support',A],
 'receive a warning':['receive',A],'issue a warning':['issue',['subtract','unplug','sharpen']],
 'practise a skill':['skill',N],'clear instructions':['instructions',NP],'a clear message':['message',N],
 'plan a route':['plan',A],'follow a route':['follow',A],
 'contribute an idea':['idea',N],'contribute time':['time',N],'perform a poem':['poem',N],
 'receive a response':['receive',A],'a positive response':['positive',['hungry','tidal','velvet']],
 'a rough estimate':['rough',ADJ],'make an estimate':['make',A],'publish a collection':['publish',A],
 'launch a balloon':['balloon',N],'launch a mission':['mission',N],
 'experimental technology':['technology',['sneeze','fraction','breakfast']],'an experimental design':['design',N],'experimental equipment':['equipment',['sneeze','fraction','breakfast']],
 'suitable conditions':['conditions',NP],'a suitable time':['time',N],'make an attempt':['make',A],
 'maritime safety':['safety',['breakfast','sunrise','fraction']],'maritime trade':['trade',['breakfast','sunrise','fraction']],'maritime transport':['transport',['breakfast','sunrise','fraction']],
 'operational needs':['needs',NP],'operational costs':['costs',NP],'operational efficiency':['efficiency',N],
 'environmental monitoring':['environmental',ADJ],'continuous monitoring':['continuous',ADJ],
 'manage logistics':['manage',A],'improve retention':['improve',A],
 'streamline a process':['process',N],'streamline operations':['operations',NP],'streamline communication':['communication',N],
 'undermine authority':['authority',N],'stagger payments':['payments',NP],'a uniform policy':['policy',N],'uniform standards':['standards',NP]
};
const items=[],seen=new Set();
for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.json')&&x!=='index.json').sort()){
 const article=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
 for(const word of article.vocabulary){for(const c of word.usage.combinations){
  const id=`col-${word.id}-${slug(c.form)}`;if(seen.has(id))throw Error('duplicate '+id);seen.add(id);
  const type=TYPE_OVERRIDE[c.form]||TYPE_BY_PATTERN[c.pattern]||'other';
  const fill=FILL[c.form];if(fill&&!c.form.split(/\s+/).includes(fill[0]))throw Error('blank not in form: '+c.form);
  items.push({id,wordId:word.id,articleId:article.id,form:c.form,type,patternDetail:c.pattern,meaningJa:c.meaningJa,nuanceJa:c.nuanceJa,example:c.example,exampleOrigin:c.exampleOrigin,status:c.status,fill:fill?{blank:fill[0],distractors:[...fill[1]]}:null,misuse:null});
 }}
}
fs.writeFileSync(out,JSON.stringify({id:'article-collocations',version:1,kind:'collocations',publishedAt:'2026-10-06T00:00:00+09:00',items},null,2)+'\n');
console.log(`${items.length} collocations, ${items.filter(x=>x.fill).length} with fill-in data`);
