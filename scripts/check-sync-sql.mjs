// Disposable, in-memory PostgreSQL with mocked Supabase Auth. Never contacts Supabase.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE_URL||'@electric-sql/pglite');
const db=new PGlite();let checks=0;
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
try {
 await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 insert into auth.users values('${A}'),('${B}');`);
 const files=(await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
 for(const file of files)await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
 ok(files.length===7,'seven ordered migrations applied');
 const tables=['answer_logs','saved_words','preferences','unit_sessions','article_states','opinion_drafts'];
 const rows=await db.query(`select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname in ('public','private') and relkind='r'`);
 ok(rows.rows.length===7&&rows.rows.every(r=>r.relrowsecurity),'all seven tables have RLS');
 ok((await db.query(`select count(*)::int n from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname in ('public','private') and prosecdef`)).rows[0].n===0,'no privileged functions');
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${A}',false);`);
 const fixture={
  answer_logs:`(user_id,event_id,session_id,question_id,mode,correct,answered_at) values('${A}','33333333-3333-4333-8333-333333333333','session','word-ja','ja',true,now())`,
  saved_words:`(user_id,word_key,payload,saved,updated_at) values('${A}','word','{}',true,'2026-01-02')`,
  preferences:`(user_id,setting_key,value,updated_at) values('${A}','mode','"ja"','2026-01-02')`,
  unit_sessions:`(user_id,session_id,unit_id,mode,total,correct,completed_at) values('${A}','unit-session','c1-01','ja',10,8,now())`,
  article_states:`(user_id,article_id,read,updated_at) values('${A}','article',true,'2026-01-02')`,
  opinion_drafts:`(user_id,article_id,prompt_id,body,updated_at) values('${A}','article','opinion','Draft','2026-01-02')`
 };
 for(const table of tables){await db.exec(`insert into public.${table} ${fixture[table]}`);await assert.rejects(db.exec(`insert into public.${table} ${fixture[table].replaceAll(A,B)}`));checks++;}
 for(const key of ['daily','weekly']){
  await db.exec(`insert into public.preferences(user_id,setting_key,value,updated_at) values('${A}','${key}',NULL,'2026-01-02')`);
  ok((await db.query(`select value from public.preferences where setting_key='${key}'`)).rows[0].value===null,'unset goal accepted as SQL NULL');
  await db.exec(`update public.preferences set value='null'::jsonb,updated_at='2026-01-03' where setting_key='${key}'`);
  ok((await db.query(`select value from public.preferences where setting_key='${key}'`)).rows[0].value===null,'unset goal accepted as JSON null');
  const max=key==='daily'?1440:10080;
  for(const bad of ['0','-1','1.5',String(max+1),'true','"unset"']){await assert.rejects(db.exec(`update public.preferences set value='${bad}'::jsonb,updated_at='2026-01-04' where setting_key='${key}'`));checks++;}
  await db.exec(`update public.preferences set value='${max}'::jsonb,updated_at='2026-01-04' where setting_key='${key}'`);
  ok((await db.query(`select value from public.preferences where setting_key='${key}'`)).rows[0].value===max,'valid upper goal accepted');
 }
 for(const key of ['mode','autoAdvance'])for(const value of ['NULL',"'null'::jsonb"]){await assert.rejects(db.exec(`insert into public.preferences(user_id,setting_key,value,updated_at) values('${A}','${key}',${value},'2026-01-05') on conflict(user_id,setting_key) do update set value=excluded.value,updated_at=excluded.updated_at`));checks++;}
 const stamp=(await db.query(`select server_updated_at::text s from public.preferences where setting_key='mode'`)).rows[0].s;
 for(const date of ['2026-01-01','2026-01-02']){const result=await db.query(`insert into public.preferences(user_id,setting_key,value,updated_at,server_updated_at) values('${A}','mode','"en"','${date}','1900-01-01') on conflict(user_id,setting_key) do update set value=excluded.value,updated_at=excluded.updated_at,server_updated_at=excluded.server_updated_at returning *`);ok(result.rows.length===0,'older or equal upsert ignored');}
 ok((await db.query(`select value,server_updated_at::text s from public.preferences where setting_key='mode'`)).rows[0].s===stamp,'ignored update preserves received timestamp');
 await db.exec(`insert into public.preferences(user_id,setting_key,value,updated_at,server_updated_at) values('${A}','mode','"en"','2026-01-03','1900-01-01') on conflict(user_id,setting_key) do update set value=excluded.value,updated_at=excluded.updated_at,server_updated_at=excluded.server_updated_at`);
 const newer=(await db.query(`select value,server_updated_at::text s from public.preferences where setting_key='mode'`)).rows[0];ok(newer.value==='en'&&!newer.s.startsWith('1900'),'newer upsert accepted with server timestamp');
 for(const table of ['saved_words','article_states','opinion_drafts']){await db.exec(`update public.${table} set updated_at='2026-01-01',server_updated_at='1900-01-01'`);ok((await db.query(`select updated_at::text u,server_updated_at::text s from public.${table}`)).rows.every(r=>r.u.startsWith('2026-01-02')&&!r.s.startsWith('1900')),'other mutable table rejects old changes');}
 for(const kind of ['vocabulary','comprehension','collocation'])await db.exec(`insert into public.answer_logs(user_id,event_id,session_id,question_id,kind,mode,correct,answered_at) values('${A}',gen_random_uuid(),'session','q-${kind}','${kind}','en',true,now())`);
 ok((await db.query(`select count(distinct kind)::int n from public.answer_logs where question_id like 'q-%'`)).rows[0].n===3,'collocation answer kind accepted alongside existing kinds');
 await assert.rejects(db.exec(`insert into public.answer_logs(user_id,event_id,session_id,question_id,kind,mode,correct,answered_at) values('${A}',gen_random_uuid(),'session','q-bad','grammar','en',true,now())`));checks++;
 let stamp2=0;for(const mode of ['ja','en','ja_en','def_en']){stamp2++;
  await db.exec(`insert into public.answer_logs(user_id,event_id,session_id,question_id,mode,correct,answered_at) values('${A}',gen_random_uuid(),'session','q-mode-${mode}','${mode}',true,now())`);
  await db.exec(`insert into public.unit_sessions(user_id,session_id,unit_id,mode,total,correct,completed_at) values('${A}','mode-${mode}','unit','${mode}',10,5,now())`);
  await db.exec(`insert into public.preferences(user_id,setting_key,value,updated_at) values('${A}','mode','"${mode}"','2026-01-03 01:0${stamp2}') on conflict(user_id,setting_key) do update set value=excluded.value,updated_at=excluded.updated_at`);
  ok((await db.query(`select value from public.preferences where setting_key='mode'`)).rows[0].value===mode,'mode preference accepts '+mode);
 }
 for(const bad of ['ja-en','JA','','en_ja','def-en','definition']){
  await assert.rejects(db.exec(`insert into public.answer_logs(user_id,event_id,session_id,question_id,mode,correct,answered_at) values('${A}',gen_random_uuid(),'session','q-bad-mode','${bad}',true,now())`));checks++;
  await assert.rejects(db.exec(`insert into public.unit_sessions(user_id,session_id,unit_id,mode,total,correct,completed_at) values('${A}','bad-${bad}','unit','${bad}',10,5,now())`));checks++;
  await assert.rejects(db.exec(`update public.preferences set value='"${bad}"'::jsonb,updated_at='2026-01-03 02:00' where setting_key='mode'`));checks++;
 }
 ok((await db.query(`select bool_and(not timed_out) ok from public.answer_logs`)).rows[0].ok===true,'timed_out defaults to false for every existing row');
 await db.exec(`insert into public.answer_logs(user_id,event_id,session_id,question_id,mode,correct,skipped,timed_out,answered_at) values('${A}',gen_random_uuid(),'session','q-timeout','ja_en',false,false,true,now())`);
 ok((await db.query(`select count(*)::int n from public.answer_logs where timed_out`)).rows[0].n===1,'timed_out row stored');
 await assert.rejects(db.exec(`insert into public.answer_logs(user_id,event_id,session_id,question_id,mode,correct,timed_out,answered_at) values('${A}',gen_random_uuid(),'session','q-null',  'en',false,NULL,now())`));checks++;
 await assert.rejects(db.exec(`insert into public.preferences(user_id,setting_key,value,updated_at) values('${A}','autoAdvance','"ja_en"'::jsonb,'2026-02-03')`));checks++;
 await db.exec(`update public.preferences set value='"ja"'::jsonb,updated_at='2026-01-03 03:00' where setting_key='mode'`);
 await db.exec(`insert into public.answer_logs ${fixture.answer_logs} on conflict(user_id,event_id) do nothing;insert into public.unit_sessions ${fixture.unit_sessions} on conflict(user_id,session_id) do nothing;`);
 ok((await db.query("select count(*)::int n from public.answer_logs where question_id='word-ja'")).rows[0].n===1,'answer resend deduplicated');
 ok((await db.query('select max(correct)::int n from public.unit_sessions')).rows[0].n===8,'session resend deduplicated; best read from sessions');
 await assert.rejects(db.exec(`update public.preferences set user_id='${B}',updated_at='2026-01-04'`));checks++;
 await db.exec(`select set_config('request.jwt.claim.sub','${B}',false)`);
 for(const table of tables)ok((await db.query(`select * from public.${table}`)).rows.length===0,'other user cannot read '+table);
 await db.exec('reset role;set role anon');
 for(const table of tables){await assert.rejects(db.query(`select * from public.${table}`));checks++;}
 await assert.rejects(db.query(`select public.before_user_created_allowlist('{}')`));checks++;
 await db.exec(`reset role;insert into private.allowed_emails(email) values('one@example.test'),('two@example.test');set role supabase_auth_admin;`);
 for(const [email,provider,allowed] of [['ONE@example.test','google',true],['two@example.test','google',true],['other@example.test','google',false],['one@example.test','email',true],['other@example.test','email',false],['one@example.test','github',false],['one@example.test',null,false]]){
  const result=await db.query('select public.before_user_created_allowlist($1::jsonb) result',[JSON.stringify({user:{email,app_metadata:{provider}}})]);ok(Boolean(result.rows[0].result.error)!==allowed,'Hook registration gate');
 }
 await db.exec(`reset role;delete from auth.users where id='${A}'`);
 for(const table of tables)ok((await db.query(`select * from public.${table}`)).rows.length===0,'account cascade '+table);
 console.log(`SQL checks: ${checks} passed (isolated PostgreSQL; real Supabase/Auth/API not connected)`);
} finally {await db.close()}
