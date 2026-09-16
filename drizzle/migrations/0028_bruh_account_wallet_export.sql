create table public.bruh_account_wallet_export_intents (
 id uuid primary key default gen_random_uuid(),
 telegram_user_id bigint not null check(telegram_user_id between 1 and 4503599627370495),
 wallet_id uuid not null references public.bruh_account_wallets(id),
 network text not null check(network='devnet'),
 status text not null default 'pending' check(status in ('pending','revealed','expired')),
 expires_at timestamptz not null,
 revealed_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index bruh_account_wallet_export_one_pending
 on public.bruh_account_wallet_export_intents(telegram_user_id)
 where status='pending';

create table public.bruh_account_wallet_export_authorizations (
 token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
 export_intent_id uuid not null references public.bruh_account_wallet_export_intents(id),
 telegram_user_id bigint not null references public.bruh_secure_action_credentials(telegram_user_id),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);

alter table public.bruh_account_wallet_export_intents enable row level security;
alter table public.bruh_account_wallet_export_intents force row level security;
alter table public.bruh_account_wallet_export_authorizations enable row level security;
alter table public.bruh_account_wallet_export_authorizations force row level security;
revoke all on public.bruh_account_wallet_export_intents,public.bruh_account_wallet_export_authorizations from public,anon,authenticated,service_role;

alter table public.bruh_secure_action_audit drop constraint bruh_secure_action_audit_event_type_check;
alter table public.bruh_secure_action_audit add constraint bruh_secure_action_audit_event_type_check
 check(event_type in ('enrolled','attempt','authorized','signed','export_requested','export_attempt','export_authorized','export_revealed'));

create function public.bruh_account_wallet_export_read(p_id uuid,p_user_id bigint) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('id',e.id,'telegram_user_id',e.telegram_user_id,'wallet_id',e.wallet_id,
  'network',e.network,'address',w.address,'status',e.status,'expires_at',e.expires_at)
 from public.bruh_account_wallet_export_intents e join public.bruh_account_wallets w on w.id=e.wallet_id
 where e.id=p_id and e.telegram_user_id=p_user_id and e.network='devnet' and w.telegram_user_id=p_user_id
  and w.network='devnet' and w.status='active';
$$;

create function public.bruh_account_wallet_export_request(p_user_id bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_wallet public.bruh_account_wallets; v_id uuid; v_record jsonb;
begin
 perform pg_advisory_xact_lock(p_user_id);
 if not exists(select 1 from public.bruh_secure_action_credentials where telegram_user_id=p_user_id) then
  raise exception 'Secure Action Password required';
 end if;
 select * into v_wallet from public.bruh_account_wallets
  where telegram_user_id=p_user_id and network='devnet' and status='active' for update;
 if v_wallet.id is null then raise exception 'Wallet unavailable'; end if;
 update public.bruh_account_wallet_export_intents set status='expired'
  where telegram_user_id=p_user_id and status='pending' and expires_at<=now();
 select id into v_id from public.bruh_account_wallet_export_intents
  where telegram_user_id=p_user_id and status='pending' and expires_at>now() for update;
 if v_id is null then
  insert into public.bruh_account_wallet_export_intents(telegram_user_id,wallet_id,network,expires_at)
   values(p_user_id,v_wallet.id,'devnet',now()+interval '10 minutes') returning id into v_id;
  insert into public.bruh_secure_action_audit(telegram_user_id,intent_id,event_type)
   values(p_user_id,v_id,'export_requested');
 end if;
 select public.bruh_account_wallet_export_read(v_id,p_user_id) into v_record;
 return v_record;
end; $$;

create function public.bruh_account_wallet_export_begin(p_user_id bigint,p_export_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare c public.bruh_secure_action_credentials; v_nonce uuid;
begin
 perform pg_advisory_xact_lock(p_user_id);
 if not exists(select 1 from public.bruh_account_wallet_export_intents e
  join public.bruh_account_wallets w on w.id=e.wallet_id
  where e.id=p_export_id and e.telegram_user_id=p_user_id and e.status='pending' and e.expires_at>now()
   and w.telegram_user_id=p_user_id and w.network='devnet' and w.status='active') then
  return jsonb_build_object('allowed',false);
 end if;
 select * into c from public.bruh_secure_action_credentials where telegram_user_id=p_user_id for update;
 if c.telegram_user_id is null or c.locked_until>now() or c.next_attempt_at>now() or c.attempt_expires_at>now() then
  return jsonb_build_object('allowed',false);
 end if;
 v_nonce:=gen_random_uuid();
 update public.bruh_secure_action_credentials set failures=least(case when locked_until<=now() then 0 else failures end+1,5),
  locked_until=case when (case when locked_until<=now() then 0 else failures end)>=4 then now()+interval '15 minutes' else null end,
  next_attempt_at=now()+interval '1 second',attempt_nonce=v_nonce,attempt_intent_id=p_export_id,
  attempt_expires_at=now()+interval '2 minutes' where telegram_user_id=p_user_id;
 insert into public.bruh_secure_action_audit(telegram_user_id,intent_id,event_type)
  values(p_user_id,p_export_id,'export_attempt');
 return jsonb_build_object('allowed',true,'nonce',v_nonce,'saltHex',c.salt_hex,'hashHex',c.hash_hex,'iterations',c.iterations);
end; $$;

create function public.bruh_account_wallet_export_finish(p_user_id bigint,p_export_id uuid,p_nonce uuid,p_ok boolean,p_token_hash text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare c public.bruh_secure_action_credentials;
begin
 perform pg_advisory_xact_lock(p_user_id);
 select * into c from public.bruh_secure_action_credentials where telegram_user_id=p_user_id for update;
 if c.telegram_user_id is null or p_nonce is null or c.attempt_nonce is null
  or c.attempt_intent_id is distinct from p_export_id or c.attempt_nonce is distinct from p_nonce
  or c.attempt_expires_at is null or c.attempt_expires_at<=now() then return false; end if;
 update public.bruh_secure_action_credentials set attempt_nonce=null,attempt_intent_id=null,attempt_expires_at=null
  where telegram_user_id=p_user_id;
 if p_ok is distinct from true then return false; end if;
 if not exists(select 1 from public.bruh_account_wallet_export_intents e
  join public.bruh_account_wallets w on w.id=e.wallet_id
  where e.id=p_export_id and e.telegram_user_id=p_user_id and e.status='pending' and e.expires_at>now()
   and w.telegram_user_id=p_user_id and w.network='devnet' and w.status='active') then return false; end if;
 update public.bruh_secure_action_credentials set failures=0,locked_until=null where telegram_user_id=p_user_id;
 insert into public.bruh_account_wallet_export_authorizations(token_hash,export_intent_id,telegram_user_id,expires_at)
  values(p_token_hash,p_export_id,p_user_id,now()+interval '60 seconds');
 insert into public.bruh_secure_action_audit(telegram_user_id,intent_id,event_type)
  values(p_user_id,p_export_id,'export_authorized');
 return true;
end; $$;

create function public.bruh_account_wallet_export_consume(p_id uuid,p_user_id bigint,p_token_hash text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_auth text; v_record jsonb;
begin
 perform pg_advisory_xact_lock(p_user_id);
 perform 1 from public.bruh_account_wallet_export_intents where id=p_id and telegram_user_id=p_user_id for update;
 if not exists(select 1 from public.bruh_account_wallet_export_intents e
  join public.bruh_account_wallets w on w.id=e.wallet_id
  where e.id=p_id and e.telegram_user_id=p_user_id and e.status='pending' and e.expires_at>now()
   and w.telegram_user_id=p_user_id and w.network='devnet' and w.status='active') then
  raise exception 'Export unavailable';
 end if;
 update public.bruh_account_wallet_export_authorizations set consumed_at=now()
  where token_hash=p_token_hash and export_intent_id=p_id and telegram_user_id=p_user_id
   and consumed_at is null and expires_at>now() returning token_hash into v_auth;
 if v_auth is null then raise exception 'Authorization unavailable'; end if;
 update public.bruh_account_wallet_export_intents set status='revealed',revealed_at=now()
  where id=p_id and telegram_user_id=p_user_id and status='pending';
 select jsonb_build_object('wallet_id',e.wallet_id,'address',w.address) into v_record
  from public.bruh_account_wallet_export_intents e join public.bruh_account_wallets w on w.id=e.wallet_id
  where e.id=p_id and e.telegram_user_id=p_user_id;
 insert into public.bruh_secure_action_audit(telegram_user_id,intent_id,event_type)
  values(p_user_id,p_id,'export_revealed');
 return v_record;
end; $$;

revoke all on function public.bruh_account_wallet_export_read(uuid,bigint),
 public.bruh_account_wallet_export_request(bigint),public.bruh_account_wallet_export_begin(bigint,uuid),
 public.bruh_account_wallet_export_finish(bigint,uuid,uuid,boolean,text),
 public.bruh_account_wallet_export_consume(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.bruh_account_wallet_export_read(uuid,bigint),
 public.bruh_account_wallet_export_request(bigint),public.bruh_account_wallet_export_begin(bigint,uuid),
 public.bruh_account_wallet_export_finish(bigint,uuid,uuid,boolean,text),
 public.bruh_account_wallet_export_consume(uuid,bigint,text) to service_role;
