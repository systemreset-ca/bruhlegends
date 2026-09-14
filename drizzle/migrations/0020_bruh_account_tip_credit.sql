-- Apply after account-tip authorization and the existing legacy tip tables.
create table public.bruh_account_tip_credit_audit (
  intent_id uuid primary key references public.bruh_account_tip_intents(id),
  legacy_tip_id uuid not null unique references public.tip_intents(id),
  signature text not null unique,
  created_at timestamptz not null default now()
);
alter table public.bruh_account_tip_credit_audit enable row level security;
alter table public.bruh_account_tip_credit_audit force row level security;
revoke all on public.bruh_account_tip_credit_audit from public,anon,authenticated,service_role;
create trigger bruh_account_tip_credit_immutable before update or delete on public.bruh_account_tip_credit_audit
for each row execute function public.bruh_account_wallet_immutable();

-- Only the verified server receipt caller may finalize and project this fact.
create function public.bruh_account_tip_finalize_credit(p_id uuid,p_user_id bigint,p_signature text,p_slot bigint,p_fee bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i public.bruh_account_tip_intents; e public.bruh_account_tip_execution;
  g uuid; s uuid; r uuid; result jsonb;
begin
  perform pg_advisory_xact_lock(p_user_id);
  result:=public.bruh_account_tip_finalize(p_id,p_user_id,p_signature,p_slot,p_fee);
  select * into i from public.bruh_account_tip_intents where id=p_id and sender_user_id=p_user_id;
  select * into e from public.bruh_account_tip_execution where intent_id=p_id;
  if i.id is null or e.state<>'finalized' or i.network<>'devnet'
    or e.signature is distinct from p_signature or e.finalized_slot is distinct from p_slot
    or e.actual_fee_lamports is distinct from p_fee then raise exception 'Unverified tip credit'; end if;
  if exists(select 1 from public.bruh_account_tip_credit_audit where intent_id=p_id and signature=p_signature and legacy_tip_id=p_id)
    then return result || jsonb_build_object('credited',true); end if;
  select id into g from public.groups where telegram_chat_id=i.telegram_chat_id;
  select id into s from public.group_members where group_id=g and telegram_user_id=i.sender_user_id;
  select id into r from public.group_members where group_id=g and telegram_user_id=i.recipient_user_id;
  if g is null or s is null or r is null or s=r then raise exception 'Tip attribution unavailable'; end if;
  if exists(select 1 from public.tip_intents where id=p_id)
    or exists(select 1 from public.verified_transfers where signature=p_signature)
    then raise exception 'Tip credit collision'; end if;
  insert into public.tip_intents(id,group_id,network,sender_membership_id,recipient_membership_id,
    recipient_address,asset_symbol,asset_mint,amount_base_units,amount_display,reference_key,privacy,status,expires_at,created_at)
  values(p_id,g,'devnet',s,r,i.recipient_address,'SOL',null,i.lamports,i.lamports::numeric/1000000000,
    i.reference,'public','confirmed',i.expires_at,i.created_at);
  insert into public.verified_transfers(tip_intent_id,signature,slot,recipient_address,asset_mint,amount_base_units,confirmed_at,raw)
  values(p_id,p_signature,p_slot,i.recipient_address,null,i.lamports,now(),
    jsonb_build_object('source','bruh_account_tip','network','devnet','sender',i.sender_address,'reference',i.reference,'fee_lamports',p_fee));
  insert into public.bruh_account_tip_credit_audit(intent_id,legacy_tip_id,signature) values(p_id,p_id,p_signature);
  return result || jsonb_build_object('credited',true);
end;
$$;
revoke all on function public.bruh_account_tip_finalize_credit(uuid,bigint,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.bruh_account_tip_finalize_credit(uuid,bigint,text,bigint,bigint) to service_role;
revoke execute on function public.bruh_account_tip_finalize(uuid,bigint,text,bigint,bigint) from service_role;