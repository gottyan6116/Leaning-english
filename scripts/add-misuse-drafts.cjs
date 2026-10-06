// One-time: registers one draft "unnatural combination" (misuse) per word on its first collocation.
// Drafts are authored for this app and stay unverified until the owner reviews docs/stage8-collocation-list.md.
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'..','materials','collocations','article-collocations.json');
const material=JSON.parse(fs.readFileSync(file,'utf8'));
const heads={};
for(const f of fs.readdirSync(path.join(__dirname,'..','materials','articles')).filter(x=>x.endsWith('.json')&&x!=='index.json'))for(const w of JSON.parse(fs.readFileSync(path.join(__dirname,'..','materials','articles',f),'utf8')).vocabulary)heads[w.id]=w.headword;
const MISUSE={
 craftsmanship:'tall craftsmanship',distinctive:'a distinctive errand',oversee:'oversee a sneeze',transmit:'transmit luggage',cohesion:'hungry cohesion',
 abundance:'an abundance with ～',composition:'hungry composition',tentative:'tentative breakfast',definitive:'definitive pillow',constrain:'constrain a sneeze',
 framework:'hungry framework',practitioners:'tidal practitioners',governance:'velvet governance',interchangeable:'interchangeable breakfast',coverage:'hungry coverage',
 competition:'swallow a competition',training:'swallow training',develop:'develop a sunrise',support:'subtract support',local:'local fraction',
 representation:'velvet representation',dialogue:'tidal dialogue',livelihoods:'velvet livelihoods',affiliated:'affiliated by a union',inclusive:'inclusive pillow',
 recognise:'recognise a sneeze',assess:'assess a sunrise',qualification:'swallow a qualification',accessible:'accessible with people',foundation:'velvet foundation',
 networks:'velvet networks',cooperatives:'tidal cooperatives',indicators:'hungry indicators',heritage:'velvet heritage',evaluation:'hungry evaluation',
 incorporated:'incorporated on a design',compact:'compact sunrise',temporary:'temporary fraction',resumed:'resumed sneezes',perspective:'a velvet perspective',
 community:'a velvet community',warning:'subtract a warning',practise:'practise a sunrise',clear:'a clear sneeze',route:'swallow a route',
 contribute:'contribute a sneeze',perform:'perform a sunrise',response:'subtract a response',estimate:'a velvet estimate',collection:'subtract a collection',
 launch:'launch a sneeze',experimental:'experimental breakfast',equipment:'an equipment',suitable:'suitable at ～',attempt:'do an attempt',
 maritime:'maritime breakfast',logistics:'hungry logistics',operational:'operational sneezes',monitoring:'velvet monitoring',deployment:'tidal deployment',
 retention:'swallow retention',streamline:'streamline a sneeze',undermine:'undermine confidence on ～',stagger:'stagger a sunrise',uniform:'a uniform sneeze'
};
const seen=new Set();let count=0;
for(const c of material.items){
 if(seen.has(c.wordId))continue;seen.add(c.wordId);
 const head=heads[c.wordId],form=MISUSE[head];if(!form)throw Error('no misuse draft for '+head);
 const natural=material.items.filter(x=>x.wordId===c.wordId).map(x=>`「${x.form}」`).join('・');
 c.misuse={form,noteJa:`「${form}」とは言いません。ふつうは${natural}のように使います。`};count++;
}
if(count!==Object.keys(MISUSE).length)throw Error('unused misuse drafts: '+count);
fs.writeFileSync(file,JSON.stringify(material,null,2)+'\n');
console.log('registered',count);
