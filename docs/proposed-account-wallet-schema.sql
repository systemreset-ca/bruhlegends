-- Devnet-only prototype. Apply only after validation; no existing table is changed.
begin;
create table public.bruh_account_wallets (
  id uuid primary key,
  telegram_user_id bigint not null check (telegram_user_id between 1 and 4503599627370495),
  network text not null check (network = 'devnet'),
  address text not null check (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  key_version text not null check (key_version ~ '^[a-zA-Z0-9_-]{1,64}$'),
  iv_hex text not null check (iv_hex ~ '^[0-9a-f]{24}$'),
  ciphertext_hex text not null check (ciphertext_hex ~ '^[0-9a-f]{96}$'),
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now()
);
create unique index bruh_one_active_account_wallet on public.bruh_account_wallets(telegram_user_id, network) where status = 'active';
create table public.bruh_account_wallet_audit (
  id bigint generated always as identity primary key,
  wallet_id uuid not null references public.bruh_account_wallets(id),
  telegram_user_id bigint not null,
  event_type text not null check (event_type = 'created'),
  created_at timestamptz not null default now()
);
alter table public.bruh_account_wallets enable row level security;
alter table public.bruh_account_wallets force row level security;
alter table public.bruh_account_wallet_audit enable row level security;
alter table public.bruh_account_wallet_audit force row level security;
revoke all on public.bruh_account_wallets, public.bruh_account_wallet_audit from public, anon, authenticated, service_role;
revoke all on sequence public.bruh_account_wallet_audit_id_seq from public, anon, authenticated, service_role;

create function public.bruh_account_wallet_immutable() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin raise exception 'Wallet history is immutable in this creation-only slice'; end;
$$;
revoke all on function public.bruh_account_wallet_immutable() from public, anon, authenticated, service_role;
create trigger bruh_account_wallet_no_mutation before update or delete on public.bruh_account_wallets
for each row execute function public.bruh_account_wallet_immutable();
create trigger bruh_account_wallet_audit_no_mutation before update or delete on public.bruh_account_wallet_audit
for each row execute function public.bruh_account_wallet_immutable();

create function public.bruh_account_wallet_read(p_user_id text) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object('id',w.id,'telegramUserId',w.telegram_user_id::text,
    'network',w.network,'address',w.address,'keyVersion',w.key_version,
    'ivHex',w.iv_hex,'ciphertextHex',w.ciphertext_hex)
  from public.bruh_account_wallets w
  where w.telegram_user_id = p_user_id::bigint and w.status = 'active' and w.network = 'devnet';
$$;
create function public.bruh_account_wallet_provision(p_record jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_id uuid; v_user bigint;
begin
  if jsonb_typeof(p_record) <> 'object' or (select count(*) from jsonb_object_keys(p_record)) <> 7
    or p_record->>'network' <> 'devnet' then raise exception 'Invalid wallet record'; end if;
  v_user := (p_record->>'telegramUserId')::bigint;
  if v_user not between 1 and 4503599627370495 then raise exception 'Invalid identity'; end if;
  -- Transaction-scoped per-account lock serializes concurrent starts.
  perform pg_advisory_xact_lock(v_user);
  if exists (select 1 from public.bruh_account_wallets where telegram_user_id = v_user and status = 'active') then
    return public.bruh_account_wallet_read(v_user::text);
  end if;
  v_id := (p_record->>'id')::uuid;
  insert into public.bruh_account_wallets(id, telegram_user_id, network, address, key_version, iv_hex, ciphertext_hex)
  values(v_id,v_user,'devnet',p_record->>'address',p_record->>'keyVersion',p_record->>'ivHex',p_record->>'ciphertextHex');
  insert into public.bruh_account_wallet_audit(wallet_id,telegram_user_id,event_type) values(v_id,v_user,'created');
  return public.bruh_account_wallet_read(v_user::text);
end;
$$;
revoke all on function public.bruh_account_wallet_read(text), public.bruh_account_wallet_provision(jsonb) from public, anon, authenticated;
grant execute on function public.bruh_account_wallet_read(text), public.bruh_account_wallet_provision(jsonb) to service_role;
commit;
