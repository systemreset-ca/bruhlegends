begin;
-- No application route calls these functions until independent spending authorization exists.
create table public.bruh_account_tip_intents (
  id uuid primary key,
  request_key text not null unique check (length(request_key) between 1 and 128),
  telegram_chat_id bigint not null check (telegram_chat_id <> 0),
  sender_wallet_id uuid not null references public.bruh_account_wallets(id),
  recipient_wallet_id uuid not null references public.bruh_account_wallets(id),
  sender_user_id bigint not null,
  recipient_user_id bigint not null,
  sender_address text not null,
  recipient_address text not null,
  network text not null check (network = 'devnet'),
  reference text not null unique check (reference ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  lamports bigint not null check (lamports between 1 and 9007199254740991),
  fee_lamports bigint not null check (fee_lamports between 0 and 9007199254740991),
  observed_balance bigint not null check (observed_balance between 0 and 9007199254740991),
  observed_slot bigint not null check (observed_slot >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (sender_user_id <> recipient_user_id),
  check (sender_wallet_id <> recipient_wallet_id),
  check (sender_address <> recipient_address),
  check (reference not in (sender_address, recipient_address, '11111111111111111111111111111111')),
  check (lamports::numeric + fee_lamports <= observed_balance)
);
create table public.bruh_account_tip_execution (
  intent_id uuid primary key references public.bruh_account_tip_intents(id),
  sender_wallet_id uuid not null references public.bruh_account_wallets(id),
  state text not null check (state in ('reserved','signed','finalized','cancelled')),
  signed_transaction text,
  signature text unique check (signature ~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$'),
  last_valid_block_height bigint,
  finalized_slot bigint,
  actual_fee_lamports bigint,
  check ((state in ('reserved','cancelled') and signed_transaction is null and signature is null
    and last_valid_block_height is null and finalized_slot is null and actual_fee_lamports is null)
    or (state = 'signed' and signed_transaction is not null and signature is not null
      and last_valid_block_height > 0 and finalized_slot is null and actual_fee_lamports is null)
    or (state = 'finalized' and signed_transaction is not null and signature is not null
      and last_valid_block_height > 0 and finalized_slot >= 0 and actual_fee_lamports >= 0))
);
create unique index bruh_account_tip_one_pending on public.bruh_account_tip_execution(sender_wallet_id)
where state in ('reserved','signed');
create table public.bruh_account_tip_audit (
  intent_id uuid not null references public.bruh_account_tip_intents(id),
  event_type text not null check (event_type in ('reserved','signed','finalized','cancelled')),
  created_at timestamptz not null default now(),
  primary key (intent_id,event_type)
);
alter table public.bruh_account_tip_intents enable row level security;
alter table public.bruh_account_tip_intents force row level security;
alter table public.bruh_account_tip_execution enable row level security;
alter table public.bruh_account_tip_execution force row level security;
alter table public.bruh_account_tip_audit enable row level security;
alter table public.bruh_account_tip_audit force row level security;
revoke all on public.bruh_account_tip_intents,public.bruh_account_tip_execution,public.bruh_account_tip_audit
from public,anon,authenticated,service_role;
create trigger bruh_account_tip_intent_immutable before update or delete on public.bruh_account_tip_intents
for each row execute function public.bruh_account_wallet_immutable();
create trigger bruh_account_tip_audit_immutable before update or delete on public.bruh_account_tip_audit
for each row execute function public.bruh_account_wallet_immutable();

create function public.bruh_account_tip_read(p_id uuid,p_user_id bigint) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select to_jsonb(i) || to_jsonb(e) from public.bruh_account_tip_intents i
  join public.bruh_account_tip_execution e on e.intent_id=i.id
  where i.id=p_id and i.sender_user_id=p_user_id;
$$;
create function public.bruh_account_tip_reserve(p_record jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare s public.bruh_account_wallets; r public.bruh_account_wallets;
  old public.bruh_account_tip_intents; v_id uuid; v_user bigint; v_slot bigint; v_exp timestamptz;
begin
  if p_record is null or jsonb_typeof(p_record)<>'object' then raise exception 'Invalid tip'; end if;
  if (select count(*) from jsonb_object_keys(p_record))<>12
    or not (p_record ?& array['id','requestKey','chatId','senderUserId','recipientUserId','network','reference',
      'lamports','feeLamports','observedBalance','observedSlot','expiresAt'])
    or exists(select 1 from jsonb_each(p_record) where value='null'::jsonb)
    or p_record->>'network'<>'devnet' then raise exception 'Invalid tip'; end if;
  v_user:=(p_record->>'senderUserId')::bigint;
  perform pg_advisory_xact_lock(v_user);
  select * into s from public.bruh_account_wallets where telegram_user_id=v_user and network='devnet' and status='active';
  select * into r from public.bruh_account_wallets where telegram_user_id=(p_record->>'recipientUserId')::bigint and network='devnet' and status='active';
  if s.id is null or r.id is null or s.id=r.id then raise exception 'Wallet unavailable'; end if;
  select * into old from public.bruh_account_tip_intents where request_key=p_record->>'requestKey';
  if found then
    if old.sender_wallet_id<>s.id or old.recipient_wallet_id<>r.id
      or old.telegram_chat_id<>(p_record->>'chatId')::bigint or old.lamports<>(p_record->>'lamports')::bigint
      or old.fee_lamports<>(p_record->>'feeLamports')::bigint or old.reference<>p_record->>'reference'
      then raise exception 'Request conflict'; end if;
    return public.bruh_account_tip_read(old.id,v_user);
  end if;
  v_exp:=(p_record->>'expiresAt')::timestamptz;
  if v_exp is null or v_exp<=now() or v_exp>now()+interval '5 minutes' then raise exception 'Invalid expiry'; end if;
  v_slot:=(p_record->>'observedSlot')::bigint;
  if exists(select 1 from public.bruh_account_tip_execution where sender_wallet_id=s.id and state in ('reserved','signed'))
    then raise exception 'Wallet has a pending tip'; end if;
  if v_slot <= coalesce((select max(finalized_slot) from public.bruh_account_tip_execution where sender_wallet_id=s.id),-1)
    then raise exception 'Balance snapshot is stale'; end if;
  v_id:=(p_record->>'id')::uuid;
  insert into public.bruh_account_tip_intents values(v_id,p_record->>'requestKey',(p_record->>'chatId')::bigint,
    s.id,r.id,s.telegram_user_id,r.telegram_user_id,s.address,r.address,'devnet',p_record->>'reference',
    (p_record->>'lamports')::bigint,(p_record->>'feeLamports')::bigint,(p_record->>'observedBalance')::bigint,
    v_slot,v_exp,now());
  insert into public.bruh_account_tip_execution(intent_id,sender_wallet_id,state) values(v_id,s.id,'reserved');
  insert into public.bruh_account_tip_audit(intent_id,event_type) values(v_id,'reserved');
  return public.bruh_account_tip_read(v_id,v_user);
end;
$$;
create function public.bruh_account_tip_signed(p_id uuid,p_user_id bigint,p_signature text,p_transaction text,p_last_height bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare i public.bruh_account_tip_intents; e public.bruh_account_tip_execution;
begin
  perform pg_advisory_xact_lock(p_user_id);
  select * into i from public.bruh_account_tip_intents where id=p_id and sender_user_id=p_user_id;
  if i.id is null then raise exception 'Tip unavailable'; end if;
  select * into e from public.bruh_account_tip_execution where intent_id=p_id for update;
  if e.state in ('signed','finalized') and e.signature=p_signature and e.signed_transaction=p_transaction
    and e.last_valid_block_height=p_last_height then return public.bruh_account_tip_read(p_id,p_user_id); end if;
  if e.state<>'reserved' or i.expires_at<=now() or p_transaction is null
    or length(p_transaction) not between 1 and 1644 or p_transaction !~ '^[A-Za-z0-9+/]+={0,2}$'
    or p_signature is null or p_last_height is null or p_last_height<=0 then raise exception 'Invalid signing transition'; end if;
  update public.bruh_account_tip_execution set state='signed',signature=p_signature,signed_transaction=p_transaction,
    last_valid_block_height=p_last_height where intent_id=p_id;
  insert into public.bruh_account_tip_audit(intent_id,event_type) values(p_id,'signed');
  return public.bruh_account_tip_read(p_id,p_user_id);
end;
$$;
create function public.bruh_account_tip_cancel(p_id uuid,p_user_id bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare e public.bruh_account_tip_execution;
begin
  perform pg_advisory_xact_lock(p_user_id);
  if not exists(select 1 from public.bruh_account_tip_intents where id=p_id and sender_user_id=p_user_id)
    then raise exception 'Tip unavailable'; end if;
  select * into e from public.bruh_account_tip_execution where intent_id=p_id for update;
  if e.state='cancelled' then return public.bruh_account_tip_read(p_id,p_user_id); end if;
  if e.state<>'reserved' then raise exception 'Signed tips remain reserved until reconciled'; end if;
  update public.bruh_account_tip_execution set state='cancelled' where intent_id=p_id;
  insert into public.bruh_account_tip_audit(intent_id,event_type) values(p_id,'cancelled');
  return public.bruh_account_tip_read(p_id,p_user_id);
end;
$$;
-- Trusted server must verify finalized transaction against frozen intent before calling.
create function public.bruh_account_tip_finalize(p_id uuid,p_user_id bigint,p_signature text,p_slot bigint,p_fee bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare i public.bruh_account_tip_intents; e public.bruh_account_tip_execution;
begin
  perform pg_advisory_xact_lock(p_user_id);
  select * into i from public.bruh_account_tip_intents where id=p_id and sender_user_id=p_user_id;
  if i.id is null then raise exception 'Tip unavailable'; end if;
  select * into e from public.bruh_account_tip_execution where intent_id=p_id for update;
  if e.state='finalized' and e.signature=p_signature and e.finalized_slot=p_slot and e.actual_fee_lamports=p_fee
    then return public.bruh_account_tip_read(p_id,p_user_id); end if;
  if e.state<>'signed' or e.signature is distinct from p_signature or p_slot is null or p_slot<i.observed_slot
    or p_fee is null or p_fee<>i.fee_lamports then raise exception 'Invalid settlement'; end if;
  update public.bruh_account_tip_execution set state='finalized',finalized_slot=p_slot,actual_fee_lamports=p_fee where intent_id=p_id;
  insert into public.bruh_account_tip_audit(intent_id,event_type) values(p_id,'finalized');
  return public.bruh_account_tip_read(p_id,p_user_id);
end;
$$;
revoke all on function public.bruh_account_tip_read(uuid,bigint),public.bruh_account_tip_reserve(jsonb),
 public.bruh_account_tip_signed(uuid,bigint,text,text,bigint),public.bruh_account_tip_cancel(uuid,bigint),
 public.bruh_account_tip_finalize(uuid,bigint,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.bruh_account_tip_read(uuid,bigint),public.bruh_account_tip_reserve(jsonb),
 public.bruh_account_tip_signed(uuid,bigint,text,text,bigint),public.bruh_account_tip_cancel(uuid,bigint),
 public.bruh_account_tip_finalize(uuid,bigint,text,bigint,bigint) to service_role;
commit;
