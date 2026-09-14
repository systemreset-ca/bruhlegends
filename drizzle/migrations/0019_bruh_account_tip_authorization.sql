-- Apply after proposed-account-wallet-schema.sql and proposed-account-tip-schema.sql.
create table public.bruh_secure_action_credentials (
 telegram_user_id bigint primary key check(telegram_user_id between 1 and 4503599627370495),
 salt_hex text not null check(salt_hex ~ '^[0-9a-f]{32}$'),
 hash_hex text not null check(hash_hex ~ '^[0-9a-f]{64}$'),
 iterations integer not null check(iterations=600000),
 failures integer not null default 0 check(failures between 0 and 5),
 locked_until timestamptz, next_attempt_at timestamptz,
 attempt_nonce uuid, attempt_intent_id uuid, attempt_expires_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.bruh_account_tip_authorizations (
 token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
 intent_id uuid not null references public.bruh_account_tip_intents(id),
 telegram_user_id bigint not null references public.bruh_secure_action_credentials(telegram_user_id),
 expires_at timestamptz not null, consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.bruh_secure_action_setup_leases (
 telegram_user_id bigint primary key, nonce uuid, expires_at timestamptz, next_attempt_at timestamptz not null
);
create table public.bruh_secure_action_audit (
 id bigint generated always as identity primary key, telegram_user_id bigint not null,
 intent_id uuid, event_type text not null check(event_type in ('enrolled','attempt','authorized','signed')),
 created_at timestamptz not null default now()
);
alter table public.bruh_secure_action_credentials enable row level security;
alter table public.bruh_secure_action_credentials force row level security;
alter table public.bruh_account_tip_authorizations enable row level security;
alter table public.bruh_account_tip_authorizations force row level security;
alter table public.bruh_secure_action_audit enable row level security;
alter table public.bruh_secure_action_audit force row level security;
alter table public.bruh_secure_action_setup_leases enable row level security;
alter table public.bruh_secure_action_setup_leases force row level security;
revoke all on public.bruh_secure_action_setup_leases from public,anon,authenticated,service_role;
revoke all on public.bruh_secure_action_credentials,public.bruh_account_tip_authorizations,public.bruh_secure_action_audit from public,anon,authenticated,service_role;
revoke all on sequence public.bruh_secure_action_audit_id_seq from public,anon,authenticated,service_role;
create trigger bruh_secure_action_audit_immutable before update or delete on public.bruh_secure_action_audit
for each row execute function public.bruh_account_wallet_immutable();

create function public.bruh_secure_action_setup_begin(p_user_id bigint) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare v_nonce uuid;
begin
 perform pg_advisory_xact_lock(p_user_id);
 if not exists(select 1 from public.bruh_account_wallets where telegram_user_id=p_user_id and network='devnet' and status='active')
  or exists(select 1 from public.bruh_secure_action_credentials where telegram_user_id=p_user_id)
  or exists(select 1 from public.bruh_secure_action_setup_leases where telegram_user_id=p_user_id and next_attempt_at>now()) then return null; end if;
 v_nonce:=gen_random_uuid();
 insert into public.bruh_secure_action_setup_leases values(p_user_id,v_nonce,now()+interval '30 seconds',now()+interval '60 seconds')
 on conflict(telegram_user_id) do update set nonce=excluded.nonce,expires_at=excluded.expires_at,next_attempt_at=excluded.next_attempt_at;
 return v_nonce;
end; $$;
create function public.bruh_secure_action_enroll(p_user_id bigint,p_nonce uuid,p_salt text,p_hash text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform pg_advisory_xact_lock(p_user_id);
 if not exists(select 1 from public.bruh_account_wallets where telegram_user_id=p_user_id and network='devnet' and status='active') then raise exception 'Wallet unavailable'; end if;
 if exists(select 1 from public.bruh_secure_action_credentials where telegram_user_id=p_user_id) then return false; end if;
 if p_nonce is null or not exists(select 1 from public.bruh_secure_action_setup_leases where telegram_user_id=p_user_id and nonce=p_nonce and expires_at>now()) then return false; end if;
 insert into public.bruh_secure_action_credentials(telegram_user_id,salt_hex,hash_hex,iterations) values(p_user_id,p_salt,p_hash,600000);
 insert into public.bruh_secure_action_audit(telegram_user_id,event_type) values(p_user_id,'enrolled');
 update public.bruh_secure_action_setup_leases set nonce=null,expires_at=null where telegram_user_id=p_user_id;
 return true;
end; $$;

create function public.bruh_secure_action_begin(p_user_id bigint,p_intent_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare c public.bruh_secure_action_credentials; v_nonce uuid;
begin
 perform pg_advisory_xact_lock(p_user_id);
 if not exists(select 1 from public.bruh_account_tip_intents i join public.bruh_account_tip_execution e on e.intent_id=i.id
  where i.id=p_intent_id and i.sender_user_id=p_user_id and (e.state='signed' or(e.state='reserved' and i.expires_at>now()))) then return jsonb_build_object('allowed',false); end if;
 select * into c from public.bruh_secure_action_credentials where telegram_user_id=p_user_id for update;
 if c.telegram_user_id is null or c.locked_until>now() or c.next_attempt_at>now() or c.attempt_expires_at>now() then return jsonb_build_object('allowed',false); end if;
 v_nonce:=gen_random_uuid();
 update public.bruh_secure_action_credentials set failures=least(case when locked_until<=now() then 0 else failures end+1,5),
  locked_until=case when (case when locked_until<=now() then 0 else failures end)>=4 then now()+interval '15 minutes' else null end,
  next_attempt_at=now()+interval '1 second',attempt_nonce=v_nonce,attempt_intent_id=p_intent_id,attempt_expires_at=now()+interval '30 seconds'
  where telegram_user_id=p_user_id;
 insert into public.bruh_secure_action_audit(telegram_user_id,intent_id,event_type) values(p_user_id,p_intent_id,'attempt');
 return jsonb_build_object('allowed',true,'nonce',v_nonce,'saltHex',c.salt_hex,'hashHex',c.hash_hex,'iterations',c.iterations);
end; $$;

create function public.bruh_secure_action_finish(p_user_id bigint,p_intent_id uuid,p_nonce uuid,p_ok boolean,p_token_hash text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare c public.bruh_secure_action_credentials;
begin
 perform pg_advisory_xact_lock(p_user_id);
 select * into c from public.bruh_secure_action_credentials where telegram_user_id=p_user_id for update;
 if c.telegram_user_id is null or p_nonce is null or c.attempt_nonce is null or c.attempt_intent_id is distinct from p_intent_id or c.attempt_nonce is distinct from p_nonce or c.attempt_expires_at is null or c.attempt_expires_at<=now() then return false; end if;
 update public.bruh_secure_action_credentials set attempt_nonce=null,attempt_intent_id=null,attempt_expires_at=null where telegram_user_id=p_user_id;
 if p_ok is distinct from true then return false; end if;
 if not exists(select 1 from public.bruh_account_tip_intents i join public.bruh_account_tip_execution e on e.intent_id=i.id
  where i.id=p_intent_id and i.sender_user_id=p_user_id and(e.state='signed' or(e.state='reserved' and i.expires_at>now()))) then return false; end if;
 update public.bruh_secure_action_credentials set failures=0,locked_until=null where telegram_user_id=p_user_id;
 insert into public.bruh_account_tip_authorizations(token_hash,intent_id,telegram_user_id,expires_at) values(p_token_hash,p_intent_id,p_user_id,now()+interval '60 seconds');
 insert into public.bruh_secure_action_audit(telegram_user_id,intent_id,event_type) values(p_user_id,p_intent_id,'authorized');
 return true;
end; $$;

create function public.bruh_account_tip_authorized_read(p_id uuid,p_user_id bigint,p_token_hash text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select public.bruh_account_tip_read(p_id,p_user_id) where exists(select 1 from public.bruh_account_tip_authorizations a
  join public.bruh_account_tip_intents i on i.id=a.intent_id join public.bruh_account_tip_execution e on e.intent_id=i.id
  where a.token_hash=p_token_hash and a.intent_id=p_id and a.telegram_user_id=p_user_id and i.sender_user_id=p_user_id
   and a.consumed_at is null and a.expires_at>now() and(e.state='signed' or(e.state='reserved' and i.expires_at>now())));
$$;

create function public.bruh_account_tip_authorized_signed(p_id uuid,p_user_id bigint,p_token_hash text,p_signature text,p_transaction text,p_last_height bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_hash text; v_record jsonb;
begin
 perform pg_advisory_xact_lock(p_user_id);
 if public.bruh_account_tip_authorized_read(p_id,p_user_id,p_token_hash) is null then raise exception 'Authorization unavailable'; end if;
 if not exists(select 1 from public.bruh_account_tip_intents i join public.groups g on g.telegram_chat_id=i.telegram_chat_id
  join public.group_members s on s.group_id=g.id and s.telegram_user_id=i.sender_user_id
  join public.group_members r on r.group_id=g.id and r.telegram_user_id=i.recipient_user_id
  where i.id=p_id and not g.is_paused and g.removed_at is null and not s.is_banned and not r.is_banned and s.pseudonym is null and r.pseudonym is null) then raise exception 'Group unavailable'; end if;
 perform 1 from public.bruh_account_wallets where id in(select sender_wallet_id from public.bruh_account_tip_intents where id=p_id union select recipient_wallet_id from public.bruh_account_tip_intents where id=p_id) order by id for update;
 if not exists(select 1 from public.bruh_account_tip_intents i join public.bruh_account_wallets s on s.id=i.sender_wallet_id join public.bruh_account_wallets r on r.id=i.recipient_wallet_id
  where i.id=p_id and s.status='active' and r.status='active' and s.address=i.sender_address and r.address=i.recipient_address) then raise exception 'Wallet unavailable'; end if;
 update public.bruh_account_tip_authorizations set consumed_at=now() where token_hash=p_token_hash and consumed_at is null returning token_hash into v_hash;
 if v_hash is null then raise exception 'Authorization consumed'; end if;
 v_record:=public.bruh_account_tip_signed(p_id,p_user_id,p_signature,p_transaction,p_last_height);
 insert into public.bruh_secure_action_audit(telegram_user_id,intent_id,event_type) values(p_user_id,p_id,'signed');
 return v_record;
end; $$;
-- The original foundation signer RPC is private behind the authorization wrapper.
revoke execute on function public.bruh_account_tip_signed(uuid,bigint,text,text,bigint) from service_role;
revoke all on function public.bruh_secure_action_setup_begin(bigint),public.bruh_secure_action_enroll(bigint,uuid,text,text),public.bruh_secure_action_begin(bigint,uuid),
 public.bruh_secure_action_finish(bigint,uuid,uuid,boolean,text),public.bruh_account_tip_authorized_read(uuid,bigint,text),
 public.bruh_account_tip_authorized_signed(uuid,bigint,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.bruh_secure_action_setup_begin(bigint),public.bruh_secure_action_enroll(bigint,uuid,text,text),public.bruh_secure_action_begin(bigint,uuid),
 public.bruh_secure_action_finish(bigint,uuid,uuid,boolean,text),public.bruh_account_tip_authorized_read(uuid,bigint,text),
 public.bruh_account_tip_authorized_signed(uuid,bigint,text,text,text,bigint) to service_role;