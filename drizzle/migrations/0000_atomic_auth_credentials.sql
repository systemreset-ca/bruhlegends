-- Consume one-time credentials and apply their side effects in one transaction.
-- These functions are intentionally callable only by the service role.

CREATE OR REPLACE FUNCTION public.exchange_miniapp_login_token(
  p_token_hash text,
  p_session_hash text
)
RETURNS TABLE (telegram_user_id bigint, group_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH consumed AS (
    UPDATE public.miniapp_login_tokens AS login_token
    SET consumed_at = now()
    WHERE login_token.token_hash = p_token_hash
      AND login_token.consumed_at IS NULL
      AND login_token.expires_at > now()
    RETURNING login_token.telegram_user_id, login_token.group_id
  ), inserted AS (
    INSERT INTO public.miniapp_sessions (
      session_hash,
      telegram_user_id,
      group_id,
      expires_at
    )
    SELECT
      p_session_hash,
      consumed.telegram_user_id,
      consumed.group_id,
      now() + interval '12 hours'
    FROM consumed
    RETURNING miniapp_sessions.telegram_user_id, miniapp_sessions.group_id
  )
  SELECT inserted.telegram_user_id, inserted.group_id
  FROM inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.exchange_miniapp_login_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exchange_miniapp_login_token(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.exchange_miniapp_login_token(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exchange_miniapp_login_token(text, text) TO service_role;

COMMENT ON FUNCTION public.exchange_miniapp_login_token(text, text) IS
  'Atomically consumes a fresh Mini App login token and creates its 12-hour session.';

CREATE OR REPLACE FUNCTION public.complete_wallet_challenge(
  p_challenge_id uuid,
  p_membership_id uuid,
  p_signature_hash text,
  p_verification_method text,
  p_replacement_delay_minutes integer
)
RETURNS TABLE (wallet_address text, replaced_existing boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_address text;
  v_nonce text;
  v_group_id uuid;
  v_current_wallet_id uuid;
  v_now timestamptz := now();
  v_active_from timestamptz;
  v_delay_minutes integer := greatest(0, least(coalesce(p_replacement_delay_minutes, 30), 1440));
BEGIN
  -- The membership lock serializes all wallet changes for one group member.
  SELECT member.group_id
  INTO v_group_id
  FROM public.group_members AS member
  WHERE member.id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT challenge.address, challenge.nonce
  INTO v_address, v_nonce
  FROM public.wallet_challenges AS challenge
  WHERE challenge.id = p_challenge_id
    AND challenge.membership_id = p_membership_id
    AND challenge.consumed_at IS NULL
    AND challenge.expires_at > v_now
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT wallet.id
  INTO v_current_wallet_id
  FROM public.wallets AS wallet
  WHERE wallet.membership_id = p_membership_id
    AND wallet.replaced_at IS NULL
    AND wallet.status IN ('verified', 'pending_replacement')
  ORDER BY wallet.created_at DESC
  LIMIT 1
  FOR UPDATE;

  v_active_from := CASE
    WHEN v_current_wallet_id IS NULL THEN v_now
    ELSE v_now + make_interval(mins => v_delay_minutes)
  END;

  IF v_current_wallet_id IS NOT NULL THEN
    UPDATE public.wallets
    SET
      status = 'pending_replacement',
      replaced_at = v_active_from
    WHERE id = v_current_wallet_id;
  END IF;

  INSERT INTO public.wallets (
    membership_id,
    address,
    status,
    verification_method,
    signature_hash,
    nonce,
    verified_at,
    active_from
  )
  VALUES (
    p_membership_id,
    v_address,
    'verified',
    p_verification_method,
    p_signature_hash,
    v_nonce,
    v_now,
    v_active_from
  );

  UPDATE public.wallet_challenges
  SET consumed_at = v_now
  WHERE id = p_challenge_id;

  INSERT INTO public.audit_events (
    group_id,
    actor_type,
    actor_id,
    event_type,
    entity_type,
    entity_id
  )
  VALUES (
    v_group_id,
    'member',
    p_membership_id::text,
    'wallet_verified',
    'wallet',
    v_address
  );

  RETURN QUERY SELECT v_address, v_current_wallet_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_wallet_challenge(uuid, uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_wallet_challenge(uuid, uuid, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.complete_wallet_challenge(uuid, uuid, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_wallet_challenge(uuid, uuid, text, text, integer) TO service_role;

COMMENT ON FUNCTION public.complete_wallet_challenge(uuid, uuid, text, text, integer) IS
  'Atomically consumes a verified ownership challenge, rotates the wallet, and records the audit event.';