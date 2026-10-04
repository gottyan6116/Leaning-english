-- Read-only verification. Do not query email values or credentials.
select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and ((n.nspname='public' and c.relname in
 ('answer_logs','saved_words','preferences','unit_sessions','article_states','opinion_drafts'))
 or (n.nspname='private' and c.relname='allowed_emails')) order by 1,2;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where tablename in ('answer_logs','saved_words','preferences','unit_sessions','article_states','opinion_drafts','allowed_emails') order by 1,2,3;

select event_object_schema,event_object_table,trigger_name,event_manipulation,action_timing
from information_schema.triggers where event_object_table in
 ('answer_logs','saved_words','preferences','unit_sessions','article_states','opinion_drafts','allowed_emails') order by 1,2,3,4;

select n.nspname,p.proname,p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='private' and p.proname in ('accept_newer_client_update','stamp_server_received_at'))
 or (n.nspname='public' and p.proname='before_user_created_allowlist');

select has_table_privilege('anon','private.allowed_emails','SELECT') as anon_can_read_allowlist,
 has_table_privilege('authenticated','private.allowed_emails','SELECT') as authenticated_can_read_allowlist,
 has_function_privilege('anon','public.before_user_created_allowlist(jsonb)','EXECUTE') as anon_can_call_hook,
 has_function_privilege('authenticated','public.before_user_created_allowlist(jsonb)','EXECUTE') as authenticated_can_call_hook;
