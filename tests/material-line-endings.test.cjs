const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
test('import regeneration normalizes Windows line endings and hashes the actual published bytes',()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'english-material-lines-'));
 try{
  for(const folder of ['materials','scripts','config','docs'])fs.mkdirSync(path.join(temporary,folder),{recursive:true});
  fs.cpSync('materials',path.join(temporary,'materials'),{recursive:true});
  for(const file of ['validate-materials.cjs','validate-articles.cjs','article-level-validation.cjs','validate-collocations.cjs','validate-wordbook.cjs','validate-listening.cjs'])fs.copyFileSync(path.join('scripts',file),path.join(temporary,'scripts',file));
  fs.copyFileSync('config/material-validation-policy.json',path.join(temporary,'config/material-validation-policy.json'));fs.copyFileSync('quiz-core.js',path.join(temporary,'quiz-core.js'));fs.copyFileSync('collocation-core.js',path.join(temporary,'collocation-core.js'));
  const source=path.join(temporary,'materials/articles/work-four-day-week.json');fs.writeFileSync(source,fs.readFileSync(source,'utf8').replace(/\r\n/g,'\n').replace(/\n/g,'\r\n'));
  const result=spawnSync(process.execPath,['scripts/validate-materials.cjs','--write'],{cwd:temporary,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const bytes=fs.readFileSync(source),manifest=JSON.parse(fs.readFileSync(path.join(temporary,'materials/manifest.json'),'utf8')),ref=manifest.materials.find(x=>x.path==='materials/articles/work-four-day-week.json');
  assert.equal(bytes.includes(Buffer.from('\r\n')),false);assert.equal(ref.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
  const verification=spawnSync(process.execPath,['scripts/validate-materials.cjs'],{cwd:temporary,encoding:'utf8'});assert.equal(verification.status,0,verification.stderr);
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
