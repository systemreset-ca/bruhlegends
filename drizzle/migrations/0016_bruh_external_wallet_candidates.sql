create table public.bruh_external_wallet_candidates (
  id uuid primary key,
  telegram_user_id bigint not null check (telegram_user_id between 1 and 4503599627370495),
  network text not null check (network = 'devnet'),
  address text not null check (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  status text not null check (status = 'unverified'),
  created_at timestamptz not null default now(),
  unique (telegram_user_id, network)
);
create table public.bruh_external_wallet_audit (
  candidate_id uuid primary key references public.bruh_external_wallet_candidates(id),
  event_type text not null check (event_type = 'registered_unverified'),
  created_at timestamptz not null default now()
);
alter table public.bruh_external_wallet_candidates enable row level security;
alter table public.bruh_external_wallet_candidates force row level security;
alter table public.bruh_external_wallet_audit enable row level security;
alter table public.bruh_external_wallet_audit force row level security;
revoke all on public.bruh_external_wallet_candidates, public.bruh_external_wallet_audit from public, anon, authenticated, service_role;
create function public.bruh_external_wallet_immutable() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin raise exception 'External address history is immutable'; end;
$$;
revoke all on function public.bruh_external_wallet_immutable() from public, anon, authenticated, service_role;
create trigger bruh_external_candidate_no_mutation before update or delete on public.bruh_external_wallet_candidates
for each row execute function public.bruh_external_wallet_immutable();
create trigger bruh_external_audit_no_mutation before update or delete on public.bruh_external_wallet_audit
for each row execute function public.bruh_external_wallet_immutable();
create function public.bruh_external_wallet_read(p_user_id text) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object('telegramUserId',telegram_user_id::text,'address',address,'network',network,'status',status)
  from public.bruh_external_wallet_candidates where telegram_user_id=p_user_id::bigint and network='devnet';
$$;
create function public.bruh_external_wallet_register(p_user_id text, p_address text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare v_user bigint; v_address text;
begin
  if p_user_id is null or p_user_id !~ '^[1-9][0-9]{0,15}$' then raise exception 'Invalid identity'; end if;
  v_user := p_user_id::bigint;
  if v_user not between 1 and 4503599627370495 then raise exception 'Invalid identity'; end if;
  if p_address is null or p_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'Invalid public address'; end if;
  perform pg_advisory_xact_lock(v_user);
  select address into v_address from public.bruh_external_wallet_candidates where telegram_user_id=v_user and network='devnet';
  if found then
    if v_address <> p_address then raise exception 'Replacement requires future ownership and action verification'; end if;
    return public.bruh_external_wallet_read(p_user_id);
  end if;
  insert into public.bruh_external_wallet_candidates(id,telegram_user_id,network,address,status)
  values(p_id,v_user,'devnet',p_address,'unverified');
  insert into public.bruh_external_wallet_audit(candidate_id,event_type) values(p_id,'registered_unverified');
  return public.bruh_external_wallet_read(p_user_id);
end;
$$;
revoke all on function public.bruh_external_wallet_read(text), public.bruh_external_wallet_register(text,text,uuid) from public, anon, authenticated;
grant execute on function public.bruh_external_wallet_read(text), public.bruh_external_wallet_register(text,text,uuid) to service_role;