-- Additive change only. Apply to Supabase yourself; no credentials are embedded.
-- mode accepts 'def_en' (definition -> English) in answer_logs, unit_sessions and the mode preference.
-- Existing values ('ja','en','ja_en') and existing rows are unchanged.
-- The filename number is provisional: rename it to the version Supabase assigns when applied.
begin;
do $$
declare t text; c text;
begin
 foreach t in array array['answer_logs','unit_sessions'] loop
  select conname into c from pg_constraint
   where conrelid=('public.'||t)::regclass and contype='c'
     and pg_get_constraintdef(oid) like '%mode%' and pg_get_constraintdef(oid) like '%''ja_en''%';
  if c is not null then execute format('alter table public.%I drop constraint %I',t,c); end if;
  execute format('alter table public.%I add constraint %I check (mode in (''ja'',''en'',''ja_en'',''def_en''))',t,t||'_mode_check');
 end loop;
end $$;
alter table public.preferences drop constraint valid_preference;
alter table public.preferences add constraint valid_preference check (
  (setting_key='mode' and value is not null and value in ('"ja"'::jsonb,'"en"'::jsonb,'"ja_en"'::jsonb,'"def_en"'::jsonb)) or
  (setting_key='autoAdvance' and value is not null and jsonb_typeof(value)='boolean') or
  (setting_key in ('daily','weekly') and (value is null or value='null'::jsonb or
    case when jsonb_typeof(value)='number' then
      (value#>>'{}')::numeric=trunc((value#>>'{}')::numeric) and
      (value#>>'{}')::numeric between 1 and case when setting_key='daily' then 1440 else 10080 end
    else false end))
);
commit;
