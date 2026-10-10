-- Stage 15: study time segments. Additive only. Apply to Supabase yourself; no credentials are embedded.
-- Automatic segments (method = 'auto') are append-only. Manual segments (method = 'manual') can be edited
-- when the update is newer, and are deleted by stamping deleted_at.
begin;

create table public.study_segments (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 kind text not null check (kind in ('vocab','colloc','article','listening','manual')),
 target_id text check (target_id is null or char_length(target_id) <= 200),
 method text not null check (method in ('auto','manual')),
 started_at timestamptz,
 ended_at timestamptz,
 study_date date,
 counted_ms integer not null,
 device_id text not null check (char_length(device_id) between 1 and 64),
 note text check (note is null or char_length(note) <= 100),
 updated_at timestamptz not null,
 deleted_at timestamptz,
 server_updated_at timestamptz not null default now(),
 primary key (user_id, id),
 constraint study_segments_auto_shape check (
  method <> 'auto' or (
   kind <> 'manual' and started_at is not null and ended_at is not null and ended_at > started_at
   and counted_ms between 5000 and 3600000 and study_date is null and note is null and deleted_at is null)),
 constraint study_segments_manual_shape check (
  method <> 'manual' or (
   kind = 'manual' and study_date is not null and started_at is null and ended_at is null
   and counted_ms between 60000 and 21600000
   and target_id in ('conversation','reading','media','other')))
);

-- Invoker trigger (no privileged lookup), same style as the other learning tables.
create function private.study_segments_write() returns trigger
 language plpgsql security invoker set search_path = pg_catalog as $$
begin
 if tg_op = 'UPDATE' then
  if old.method = 'auto' then return null; end if;            -- automatic segments never change
  if new.method <> 'manual' then return null; end if;          -- the method cannot be changed
  if new.updated_at <= old.updated_at then return null; end if; -- only a newer client update is accepted
 end if;
 new.server_updated_at := now();
 return new;
end $$;
revoke all on function private.study_segments_write() from public, anon, authenticated;

alter table public.study_segments enable row level security;
revoke all on public.study_segments from public, anon, authenticated;
grant select, insert, update, delete on public.study_segments to authenticated;
create policy owner_select on public.study_segments for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.study_segments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.study_segments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_delete on public.study_segments for delete to authenticated using ((select auth.uid()) = user_id);

create trigger study_segments_write before insert or update on public.study_segments
 for each row execute function private.study_segments_write();

create index study_segments_started_at on public.study_segments (user_id, started_at);
create index study_segments_sync_cursor on public.study_segments (user_id, server_updated_at);

comment on table public.study_segments is 'Study time. Totals are computed on the client: segments of all devices are overlaid per day so that overlapping time is counted once.';
commit;
