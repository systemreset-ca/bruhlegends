-- Expose only the enrollment boolean required by the authenticated Mini App.
-- Credential salts and hashes remain inaccessible to every application role.
create function public.bruh_secure_action_password_set(p_user_id bigint) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select p_user_id between 1 and 4503599627370495
    and exists(
      select 1
      from public.bruh_secure_action_credentials
      where telegram_user_id=p_user_id
    );
$$;
revoke all on function public.bruh_secure_action_password_set(bigint)
  from public,anon,authenticated;
grant execute on function public.bruh_secure_action_password_set(bigint)
  to service_role;
