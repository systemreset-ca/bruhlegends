-- PBKDF2-SHA256 at 600,000 iterations can exceed the original 30-second
-- attempt nonce lifetime in the deployed Worker. Keep all existing action,
-- account, lockout and replay checks, but allow two minutes for proof work.
create or replace function public.bruh_secure_action_begin(p_user_id bigint,p_intent_id uuid) returns jsonb
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
  next_attempt_at=now()+interval '1 second',attempt_nonce=v_nonce,attempt_intent_id=p_intent_id,attempt_expires_at=now()+interval '2 minutes'
  where telegram_user_id=p_user_id;
 insert into public.bruh_secure_action_audit(telegram_user_id,intent_id,event_type) values(p_user_id,p_intent_id,'attempt');
 return jsonb_build_object('allowed',true,'nonce',v_nonce,'saltHex',c.salt_hex,'hashHex',c.hash_hex,'iterations',c.iterations);
end; $$;

revoke all on function public.bruh_secure_action_begin(bigint,uuid) from public,anon,authenticated;
grant execute on function public.bruh_secure_action_begin(bigint,uuid) to service_role;
