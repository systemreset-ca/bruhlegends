-- Aggregated projection only; no new direct grants or changes to group source records.
create function public.bruh_community_leaderboard(p_window text,p_limit integer,p_network text,p_order text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_cutoff timestamptz; v_result jsonb;
begin
  if p_window is null or p_window not in ('all','7d','30d') or p_limit is null or p_limit not between 1 and 100
    or p_network is null or p_network not in ('devnet','mainnet-beta')
    or p_order is null or p_order not in ('callers','tippers') then raise exception 'Invalid community query'; end if;
  v_cutoff:=case p_window when '7d' then now()-interval '7 days' when '30d' then now()-interval '30 days' else null end;
  with members as (
    select id,group_id,telegram_user_id from public.group_members where not is_banned and pseudonym is null
  ), eligible_calls as (
    select c.id,c.group_id,c.mint,m.telegram_user_id,coalesce(c.ath_multiple,1)::double precision as multiple
    from public.calls c join members m on m.id=c.caller_membership_id and m.group_id=c.group_id
    where c.status::text in ('active','rugged_or_illiquid','archived') and c.source in ('explicit','detected')
      and c.baseline_price_usd>0 and (c.ath_multiple is null or
        (c.ath_multiple>0 and c.ath_multiple::text not in ('NaN','Infinity','-Infinity')))
      and (v_cutoff is null or c.created_at>=v_cutoff)
  ), call_totals as (
    select telegram_user_id,count(*)::int as calls,count(distinct mint)::int as tokens,
      max(multiple) as best,percentile_cont(0.5) within group(order by multiple) as median,
      count(*) filter(where multiple>=2)::double precision/count(*) as hit_rate
    from eligible_calls group by telegram_user_id
  ), milestone_totals as (
    select c.telegram_user_id,count(distinct (m.call_id,m.milestone))::int as milestones
    from eligible_calls c join public.milestones m on m.call_id=c.id group by c.telegram_user_id
  ), verified as (
    select distinct on (i.network,v.signature) i.id,i.group_id,s.telegram_user_id as sender,
      r.telegram_user_id as recipient,i.created_at,v.confirmed_at
    from public.tip_intents i join public.verified_transfers v on v.tip_intent_id=i.id
    join members s on s.id=i.sender_membership_id and s.group_id=i.group_id
    join members r on r.id=i.recipient_membership_id and r.group_id=i.group_id
    where i.status::text='confirmed' and i.privacy::text='public' and i.network=p_network
      and s.telegram_user_id<>r.telegram_user_id and v.signature is not null
      and v.amount_base_units=i.amount_base_units and v.recipient_address=i.recipient_address
      and v.asset_mint is not distinct from i.asset_mint
    order by i.network,v.signature,v.confirmed_at,i.id
  ), tips as (
    select * from verified where v_cutoff is null or confirmed_at>=v_cutoff
  ), sent as (select sender as telegram_user_id,count(*)::int as sent from tips group by sender),
  received as (select recipient as telegram_user_id,count(*)::int as received from tips group by recipient),
  activity_groups as (
    select telegram_user_id,group_id from eligible_calls
    union select sender,group_id from tips union select recipient,group_id from tips
  ), accounts as (
    select telegram_user_id,count(distinct group_id)::int as groups from activity_groups group by telegram_user_id
  ), inputs as (
    select a.telegram_user_id,coalesce(nullif(u.username,''),nullif(u.first_name,''),'BRUH member') as display_name,
      coalesce(c.calls,0) as calls,coalesce(c.tokens,0) as tokens,coalesce(c.best,0) as best,
      coalesce(c.median,0) as median,coalesce(c.hit_rate,0) as hit_rate,
      coalesce(mt.milestones,0) as milestones,coalesce(s.sent,0) as sent,coalesce(r.received,0) as received,a.groups
    from accounts a join public.telegram_users u using(telegram_user_id)
    left join call_totals c using(telegram_user_id) left join milestone_totals mt using(telegram_user_id)
    left join sent s using(telegram_user_id) left join received r using(telegram_user_id)
  ), scores as (
    select *,case when calls=0 then 0::numeric else round(((
      log(10::numeric,1+best::numeric)*40+log(10::numeric,1+median::numeric)*30+hit_rate*25
      +log(10::numeric,1+milestones::numeric)*8)*(calls::numeric/(calls+3))
      +log(10::numeric,1+received::numeric)*10)::numeric,2) end as score from inputs
  ), top_rows as (
    select * from scores where p_order='callers' or sent>0
    order by case when p_order='callers' and calls>=3 then 1 else 0 end desc,
      case when p_order='tippers' then sent else score end desc,
      calls desc,telegram_user_id asc limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object('telegramUserId',telegram_user_id::text,'displayName',display_name,
    'calls',calls,'uniqueTokens',tokens,'bestMultiple',best,'medianMultiple',median,'milestones',milestones,
    'tipsSent',sent,'tipsReceived',received,'groups',groups,'ranked',calls>=3,'score',score)
    order by case when p_order='callers' and calls>=3 then 1 else 0 end desc,
      case when p_order='tippers' then sent else score end desc,calls desc,telegram_user_id asc),'[]'::jsonb)
  into v_result from top_rows;
  return v_result;
end;
$$;
revoke all on function public.bruh_community_leaderboard(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.bruh_community_leaderboard(text,integer,text,text) to service_role;