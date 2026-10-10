const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),files=['learning.css','quiz-session.css','stage3.css','stage4.css','records.css'],errors=[];
for(const name of files){const css=fs.readFileSync(path.join(root,name),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 if(/#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/i.test(css))errors.push(`${name}: color literal outside design-tokens.css`);
 if(/(?:linear|radial|conic)-gradient\(|\bblur\(/i.test(css))errors.push(`${name}: gradient or blur`);
 for(const [,value] of css.matchAll(/box-shadow\s*:\s*([^;}]+)/g))if(!/^none$|^var\(--shadow-(?:primary|secondary|choice-correct|choice-wrong|surface)\)$/.test(value.trim()))errors.push(`${name}: unsupported shadow ${value}`);
 for(const [,value] of css.matchAll(/font-weight\s*:\s*([^;}]+)/g))if(!/^(?:400|700|var\(--font-weight-(?:regular|bold)\))(?:!important)?$/.test(value.trim()))errors.push(`${name}: unsupported font weight ${value}`);
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log('PASS: token-only colors, approved shadows, 400/700 weights; no gradient or blur.');
