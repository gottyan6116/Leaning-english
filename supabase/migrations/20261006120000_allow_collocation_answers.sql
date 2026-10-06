-- Additive change only. Apply to Supabase yourself; no credentials are embedded.
-- Allows answer_logs.kind = 'collocation' (combination quiz answers).
-- The filename number is provisional: rename it to the version Supabase assigns when applied.
begin;
do $$
declare c text;
begin
 select conname into c from pg_constraint
  where conrelid='public.answer_logs'::regclass and contype='c'
    and pg_get_constraintdef(oid) like '%vocabulary%comprehension%';
 if c is not null then execute format('alter table public.answer_logs drop constraint %I',c); end if;
end $$;
alter table public.answer_logs add constraint answer_logs_kind_check
 check (kind in ('vocabulary','comprehension','collocation'));
commit;
