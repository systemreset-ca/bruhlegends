-- Claim one freshly received Telegram update and its actions without competing
-- with the recovery worker. The same leases and retry bounds apply to both paths.

CREATE OR REPLACE FUNCTION public.claim_telegram_update_by_id(
  p_telegram_update_id bigint,
  p_lease_seconds integer DEFAULT 300
)
RETURNS TABLE (
  telegram_update_id bigint,
  payload jsonb,
  attempt_count integer,
  lock_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 300), 3600));
BEGIN
  RETURN QUERY
  UPDATE public.webhook_updates AS claimed
  SET
    status = 'processing',
    attempt_count = claimed.attempt_count + 1,
    locked_at = now(),
    lock_token = gen_random_uuid(),
    last_error = NULL
  WHERE claimed.telegram_update_id = p_telegram_update_id
    AND claimed.payload IS NOT NULL
    AND claimed.processed_at IS NULL
    AND claimed.attempt_count < 10
    AND (
      (
        claimed.status IN ('received', 'failed')
        AND claimed.next_attempt_at <= now()
      )
      OR (
        claimed.status = 'processing'
        AND claimed.locked_at < now() - make_interval(secs => v_lease_seconds)
      )
    )
  RETURNING
    claimed.telegram_update_id,
    claimed.payload,
    claimed.attempt_count,
    claimed.lock_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_telegram_update_by_id(bigint, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_telegram_update_by_id(bigint, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_telegram_update_by_id(bigint, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_update_by_id(bigint, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_telegram_outbox_by_update_id(
  p_telegram_update_id bigint,
  p_limit integer DEFAULT 20,
  p_lease_seconds integer DEFAULT 300
)
RETURNS TABLE (
  id uuid,
  method text,
  payload jsonb,
  attempt_count integer,
  lock_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  v_lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 300), 3600));
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT queued.id
    FROM public.telegram_outbox AS queued
    JOIN public.webhook_updates AS parent
      ON parent.telegram_update_id = queued.telegram_update_id
    WHERE queued.telegram_update_id = p_telegram_update_id
      AND parent.processed_at IS NOT NULL
      AND queued.sent_at IS NULL
      AND queued.attempt_count < 10
      AND (
        (
          queued.status IN ('pending', 'failed')
          AND queued.next_attempt_at <= now()
        )
        OR (
          queued.status = 'processing'
          AND queued.locked_at < now() - make_interval(secs => v_lease_seconds)
        )
      )
    ORDER BY queued.created_at, queued.id
    LIMIT v_limit
    FOR UPDATE OF queued SKIP LOCKED
  )
  UPDATE public.telegram_outbox AS claimed
  SET
    status = 'processing',
    attempt_count = claimed.attempt_count + 1,
    locked_at = now(),
    lock_token = gen_random_uuid(),
    last_error = NULL
  FROM candidates
  WHERE claimed.id = candidates.id
  RETURNING
    claimed.id,
    claimed.method,
    claimed.payload,
    claimed.attempt_count,
    claimed.lock_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_telegram_outbox_by_update_id(bigint, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_telegram_outbox_by_update_id(bigint, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_telegram_outbox_by_update_id(bigint, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_outbox_by_update_id(bigint, integer, integer) TO service_role;

COMMENT ON FUNCTION public.claim_telegram_update_by_id(bigint, integer) IS
  'Claims one specified ready Telegram update for immediate processing using the recovery-worker lease rules.';
COMMENT ON FUNCTION public.claim_telegram_outbox_by_update_id(bigint, integer, integer) IS
  'Claims deliverable Telegram actions for one processed update using the recovery-worker lease rules.';
