-- Fixed devnet verification budget; no provider calls on denied claims.
alter table public.bruh_account_tip_execution add column next_reconcile_at timestamptz;
create table public.bruh_account_tip_rpc_budget (
  day date primary key,
  checks integer not null check(checks between 1 and 500)
);
alter table public.bruh_account_tip_rpc_budget enable row level security;
alter table public.bruh_account_tip_rpc_budget force row level security;
revoke all on public.bruh_account_tip_rpc_budget from public,anon,authenticated,service_role;
create function public.bruh_account_tip_reconcile_claim(p_id uuid,p_user_id bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare e public.bruh_account_tip_execution; d date; n integer;
begin
  perform pg_advisory_xact_lock(p_user_id);
  if not exists(select 1 from public.bruh_account_tip_intents where id=p_id and sender_user_id=p_user_id and network='devnet')
    then return jsonb_build_object('allowed',false); end if;
  select * into e from public.bruh_account_tip_execution where intent_id=p_id for update;
  if e.state='finalized' and exists(select 1 from public.bruh_account_tip_credit_audit where intent_id=p_id and signature=e.signature)
    then return jsonb_build_object('allowed',false,'credited',true,'signature',e.signature,'slot',e.finalized_slot); end if;
  if e.intent_id is null or e.state not in ('signed','finalized') or e.next_reconcile_at>now()
    then return jsonb_build_object('allowed',false); end if;
  -- One global lock serializes the small beta budget across workers/accounts.
  perform pg_advisory_xact_lock(927417);
  d:=(now() at time zone 'UTC')::date;
  select checks into n from public.bruh_account_tip_rpc_budget where day=d;
  if coalesce(n,0)>=500 then return jsonb_build_object('allowed',false); end if;
  insert into public.bruh_account_tip_rpc_budget(day,checks) values(d,1)
    on conflict(day) do update set checks=public.bruh_account_tip_rpc_budget.checks+1;
  update public.bruh_account_tip_execution set next_reconcile_at=now()+interval '15 seconds' where intent_id=p_id;
  return jsonb_build_object('allowed',true);
end;
$$;
revoke all on function public.bruh_account_tip_reconcile_claim(uuid,bigint) from public,anon,authenticated;
grant execute on function public.bruh_account_tip_reconcile_claim(uuid,bigint) to service_role;