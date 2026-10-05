-- 登録方法をメール＋パスワード（将来に備えてGoogleも）に拡張する
create or replace function public.before_user_created_allowlist(event jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare
  email_value text := lower(btrim(event->'user'->>'email'));
  provider_value text := event->'user'->'app_metadata'->>'provider';
begin
  if provider_value is null or provider_value not in ('email','google') or email_value is null or
     not exists(select 1 from private.allowed_emails where email=email_value and enabled) then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration is not permitted.'));
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public.before_user_created_allowlist(jsonb) from public,anon,authenticated;
grant execute on function public.before_user_created_allowlist(jsonb) to supabase_auth_admin;
