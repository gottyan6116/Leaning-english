-- Stage 16: expression practice. Additive change only. Apply to Supabase yourself; no credentials are embedded.
-- 1) answer_logs.kind accepts 'expression' (answers of the expression practice). mode keeps using the existing value 'en';
--    the question format and the chosen order are kept in the existing legacy_payload column.
-- 2) study_segments.kind accepts 'expr' (study time of the expression practice).
-- Applied migrations are not edited; the filename number is provisional.
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
 check (kind in ('vocabulary','comprehension','collocation','expression'));

do $$
declare c text;
begin
 select conname into c from pg_constraint
  where conrelid='public.study_segments'::regclass and contype='c'
    and pg_get_constraintdef(oid) like '%vocab%colloc%article%';
 if c is not null then execute format('alter table public.study_segments drop constraint %I',c); end if;
end $$;
alter table public.study_segments add constraint study_segments_kind_check
 check (kind in ('vocab','colloc','article','listening','manual','expr'));

commit;
