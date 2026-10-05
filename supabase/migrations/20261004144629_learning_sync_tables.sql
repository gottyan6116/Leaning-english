-- Additive schema only. Apply to Supabase yourself; no credentials are embedded.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.answer_logs (
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid not null, session_id text not null, question_id text not null,
 word_id text, article_id text, kind text not null default 'vocabulary' check(kind in ('vocabulary','comprehension')),
 mode text not null check(mode in ('ja','en')), selected_choice_id text, correct_choice_id text,
 correct boolean not null, skipped boolean not null default false,
 answered_at timestamptz not null, material_version integer,
 legacy_payload jsonb, server_updated_at timestamptz not null default now(),
 primary key(user_id,event_id)
);
create table public.saved_words (
 user_id uuid not null references auth.users(id) on delete cascade,
 word_key text not null check(word_key=lower(btrim(word_key)) and length(word_key)>0),
 catalog_word_id text, payload jsonb not null check(jsonb_typeof(payload)='object'),
 saved boolean not null, deleted_at timestamptz, updated_at timestamptz not null,
 server_updated_at timestamptz not null default now(), primary key(user_id,word_key)
);
create table public.preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 setting_key text not null, value jsonb not null, updated_at timestamptz not null,
 server_updated_at timestamptz not null default now(), primary key(user_id,setting_key),
 constraint valid_preference check (
  (setting_key='mode' and value in ('"ja"'::jsonb,'"en"'::jsonb)) or
  (setting_key='autoAdvance' and jsonb_typeof(value)='boolean') or
  (setting_key in ('daily','weekly') and (value='null'::jsonb or
   case when jsonb_typeof(value)='number' then
    (value#>>'{}')::numeric=trunc((value#>>'{}')::numeric) and
    (value#>>'{}')::numeric between 1 and case when setting_key='daily' then 1440 else 10080 end
   else false end))
 )
);
create table public.unit_sessions (
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id text not null, unit_id text not null, mode text not null check(mode in ('ja','en')),
 total smallint not null check(total=10), correct smallint not null check(correct between 0 and total),
 completed_at timestamptz not null, server_updated_at timestamptz not null default now(),
 primary key(user_id,session_id)
);
create table public.article_states (
 user_id uuid not null references auth.users(id) on delete cascade,
 article_id text not null, read boolean not null, read_at timestamptz,
 updated_at timestamptz not null, server_updated_at timestamptz not null default now(),
 primary key(user_id,article_id)
);
create table public.opinion_drafts (
 user_id uuid not null references auth.users(id) on delete cascade,
 article_id text not null, prompt_id text not null, body text not null,
 updated_at timestamptz not null, deleted_at timestamptz,
 server_updated_at timestamptz not null default now(), primary key(user_id,article_id,prompt_id)
);

-- Invoker triggers: no privileged lookup, no dedicated synchronization RPC.
create function private.stamp_server_received_at() returns trigger
 language plpgsql security invoker set search_path=pg_catalog as $$
begin
 new.server_updated_at := now();
 return new;
end $$;
create function private.accept_newer_client_update() returns trigger
 language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if tg_op='UPDATE' and new.updated_at <= old.updated_at then return null; end if;
 new.server_updated_at := now();
 return new;
end $$;
revoke all on function private.stamp_server_received_at() from public,anon,authenticated;
revoke all on function private.accept_newer_client_update() from public,anon,authenticated;

do $$ declare name text; begin
 foreach name in array array['answer_logs','saved_words','preferences','unit_sessions','article_states','opinion_drafts'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public, anon, authenticated',name);
  execute format('grant select, insert, delete on public.%I to authenticated',name);
  execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',name);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',name);
  execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',name);
  execute format('create index %I on public.%I(user_id,server_updated_at)',name||'_sync_cursor',name);
 end loop;
 foreach name in array array['saved_words','preferences','article_states','opinion_drafts'] loop
  execute format('grant update on public.%I to authenticated',name);
  execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',name);
  execute format('create trigger accept_newer_update before insert or update on public.%I for each row execute function private.accept_newer_client_update()',name);
 end loop;
 foreach name in array array['answer_logs','unit_sessions'] loop
  execute format('create trigger stamp_received_at before insert or update on public.%I for each row execute function private.stamp_server_received_at()',name);
 end loop;
end $$;
grant usage on schema public to authenticated;
create index answer_logs_answer_order on public.answer_logs(user_id,answered_at,event_id);
create index unit_sessions_score_lookup on public.unit_sessions(user_id,unit_id,mode);
comment on table public.unit_sessions is 'Best score is MAX(correct) grouped by unit_id and mode. Append using ON CONFLICT DO NOTHING.';
comment on table public.saved_words is 'Updates require newer updated_at. Keep tombstones for incremental synchronization.';
commit;
