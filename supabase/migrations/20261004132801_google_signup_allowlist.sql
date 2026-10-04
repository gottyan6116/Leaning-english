begin;
create table private.allowed_emails (
 email text primary key check(email=lower(btrim(email)) and position('@' in email)>1),
 enabled boolean not null default true,
 server_updated_at timestamptz not null default now()
);
alter table private.allowed_emails enable row level security;
revoke all on private.allowed_emails from public,anon,authenticated;
grant usage on schema private to supabase_auth_admin;
grant select on private.allowed_emails to supabase_auth_admin;
create policy hook_read_allowed_emails on private.allowed_emails
 for select to supabase_auth_admin using (true);
create trigger stamp_received_at before insert or update on private.allowed_emails
 for each row execute function private.stamp_server_received_at();

-- Configure this public function as Before User Created Hook BEFORE enabling Google.
create function public.before_user_created_allowlist(event jsonb) returns jsonb
 language plpgsql security invoker set search_path=pg_catalog as $$
declare
 email_value text := lower(btrim(event->'user'->>'email'));
 provider_value text := event->'user'->'app_metadata'->>'provider';
begin
 if provider_value is distinct from 'google' or email_value is null or
  not exists(select 1 from private.allowed_emails where email=email_value and enabled) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration is not permitted.'));
 end if;
 return '{}'::jsonb;
end $$;
revoke all on function public.before_user_created_allowlist(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created_allowlist(jsonb) to supabase_auth_admin;
comment on table private.allowed_emails is 'Multiple allowed emails, registration gate only. No user_id binding. Do not expose this schema through the Data API.';
-- No real emails are seeded. Add your allowed email(s) yourself after configuring the Hook.
commit;
