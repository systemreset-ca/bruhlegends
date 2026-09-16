-- Production Worker WebCrypto rejects PBKDF2 counts above 100,000. No Secure
-- Action Password credential existed when this migration was introduced.
alter table public.bruh_secure_action_credentials
 drop constraint bruh_secure_action_credentials_iterations_check;

alter table public.bruh_secure_action_credentials
 add constraint bruh_secure_action_credentials_iterations_check
 check (iterations = 100000);

create or replace function public.bruh_secure_action_enroll(
 p_user_id bigint,
 p_nonce uuid,
 p_salt text,
 p_hash text
) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform pg_advisory_xact_lock(p_user_id);
 if not exists(select 1 from public.bruh_account_wallets where telegram_user_id=p_user_id and network='devnet' and status='active') then raise exception 'Wallet unavailable'; end if;
 if exists(select 1 from public.bruh_secure_action_credentials where telegram_user_id=p_user_id) then return false; end if;
 if p_nonce is null or not exists(select 1 from public.bruh_secure_action_setup_leases where telegram_user_id=p_user_id and nonce=p_nonce and expires_at>now()) then return false; end if;
 insert into public.bruh_secure_action_credentials(telegram_user_id,salt_hex,hash_hex,iterations) values(p_user_id,p_salt,p_hash,100000);
 insert into public.bruh_secure_action_audit(telegram_user_id,event_type) values(p_user_id,'enrolled');
 update public.bruh_secure_action_setup_leases set nonce=null,expires_at=null where telegram_user_id=p_user_id;
 return true;
end; $$;

alter function public.bruh_secure_action_enroll(bigint,uuid,text,text) owner to postgres;
revoke all on function public.bruh_secure_action_enroll(bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function public.bruh_secure_action_enroll(bigint,uuid,text,text) to service_role;