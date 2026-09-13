-- Callable only by the server after confirmed RPC verification. No signing.
CREATE OR REPLACE FUNCTION public.settle_tip_intent(
  p_intent_id uuid, p_network text, p_reference text, p_recipient text,
  p_mint text, p_amount bigint, p_signature text, p_slot bigint, p_raw jsonb
)
RETURNS TABLE(status text, signature text, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.tip_intents%ROWTYPE;
  v_signature text;
BEGIN
  SELECT * INTO v_intent FROM public.tip_intents
  WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF v_intent.status = 'confirmed' THEN
    SELECT t.signature INTO v_signature FROM public.verified_transfers t
    WHERE t.tip_intent_id = p_intent_id;
    IF v_signature IS NULL THEN
      RAISE EXCEPTION 'Confirmed tip has no stored receipt';
    END IF;
    RETURN QUERY SELECT 'confirmed'::text, v_signature, NULL::text;
    RETURN;
  END IF;

  IF v_intent.status = 'expired' THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, 'intent_expired'::text;
    RETURN;
  END IF;

  IF v_intent.status NOT IN ('created', 'awaiting_payment') THEN
    RETURN QUERY SELECT 'pending'::text, NULL::text, 'intent_unavailable'::text;
    RETURN;
  END IF;

  -- Use wall-clock time after acquiring the lock, including any lock wait.
  IF v_intent.expires_at <= clock_timestamp() THEN
    UPDATE public.tip_intents SET status = 'expired' WHERE id = p_intent_id;
    INSERT INTO public.audit_events
      (group_id, actor_type, event_type, entity_type, entity_id, before_state, after_state)
    VALUES (v_intent.group_id, 'system', 'tip_expired', 'tip_intent', p_intent_id::text,
      jsonb_build_object('status', v_intent.status), jsonb_build_object('status', 'expired'));
    RETURN QUERY SELECT 'expired'::text, NULL::text, 'intent_expired'::text;
    RETURN;
  END IF;

  IF v_intent.network IS DISTINCT FROM p_network
    OR v_intent.reference_key IS DISTINCT FROM p_reference
    OR v_intent.recipient_address IS DISTINCT FROM p_recipient
    OR v_intent.asset_mint IS DISTINCT FROM p_mint
    OR v_intent.amount_base_units IS DISTINCT FROM p_amount THEN
    RETURN QUERY SELECT 'pending'::text, NULL::text, 'intent_snapshot_mismatch'::text;
    RETURN;
  END IF;

  IF p_signature IS NULL THEN
    RETURN QUERY SELECT 'pending'::text, NULL::text, 'payment_not_verified'::text;
    RETURN;
  END IF;
  IF length(btrim(p_signature)) = 0 OR p_amount <= 0 OR p_slot IS NULL OR p_slot < 0 THEN
    RAISE EXCEPTION 'Invalid verified transfer';
  END IF;

  BEGIN
    INSERT INTO public.verified_transfers
      (tip_intent_id, signature, slot, recipient_address, asset_mint,
       amount_base_units, usd_reference_at_execution, raw)
    VALUES (p_intent_id, p_signature, p_slot, v_intent.recipient_address,
      v_intent.asset_mint, v_intent.amount_base_units, v_intent.usd_reference, p_raw);
  EXCEPTION WHEN unique_violation THEN
    -- A signature can credit only one intent. Never acknowledge a failed insert.
    RETURN QUERY SELECT 'pending'::text, NULL::text, 'receipt_conflict'::text;
    RETURN;
  END;

  UPDATE public.tip_intents SET status = 'confirmed' WHERE id = p_intent_id;
  INSERT INTO public.audit_events
    (group_id, actor_type, actor_id, event_type, entity_type, entity_id, after_state)
  VALUES (v_intent.group_id, 'member', v_intent.sender_membership_id::text,
    'tip_confirmed', 'tip_intent', p_intent_id::text,
    jsonb_build_object('signature', p_signature));
  RETURN QUERY SELECT 'confirmed'::text, p_signature, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_tip_intent(uuid,text,text,text,text,bigint,text,bigint,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_tip_intent(uuid,text,text,text,text,bigint,text,bigint,jsonb) TO service_role;
COMMENT ON FUNCTION public.settle_tip_intent(uuid,text,text,text,text,bigint,text,bigint,jsonb)
IS 'Server-verified tip settlement: locked intent, unique receipt, status and audit in one transaction. Does not verify the chain or sign transactions.';
