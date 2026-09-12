-- Persist Telegram payloads before acknowledgement and lease them to workers.

ALTER TABLE public.webhook_updates
  ADD COLUMN payload jsonb,
  ADD COLUMN telegram_chat_id bigint,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN lock_token uuid;

CREATE INDEX webhook_updates_ready_idx
  ON public.webhook_updates (next_attempt_at, telegram_update_id)
  WHERE processed_at IS NULL AND status IN ('received', 'failed');

CREATE INDEX webhook_updates_retention_idx
  ON public.webhook_updates (telegram_chat_id, received_at)
  WHERE payload IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_telegram_updates(
  p_limit integer DEFAULT 10,
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
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 300), 3600));
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT update_row.telegram_update_id
    FROM public.webhook_updates AS update_row
    WHERE update_row.payload IS NOT NULL
      AND update_row.processed_at IS NULL
      AND update_row.attempt_count < 10
      AND (
        (
          update_row.status IN ('received', 'failed')
          AND update_row.next_attempt_at <= now()
        )
        OR (
          update_row.status = 'processing'
          AND update_row.locked_at < now() - make_interval(secs => v_lease_seconds)
        )
      )
    ORDER BY update_row.telegram_update_id
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.webhook_updates AS claimed
  SET
    status = 'processing',
    attempt_count = claimed.attempt_count + 1,
    locked_at = now(),
    lock_token = gen_random_uuid(),
    last_error = NULL
  FROM candidates
  WHERE claimed.telegram_update_id = candidates.telegram_update_id
  RETURNING
    claimed.telegram_update_id,
    claimed.payload,
    claimed.attempt_count,
    claimed.lock_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_telegram_updates(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_telegram_updates(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_telegram_updates(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_updates(integer, integer) TO service_role;

COMMENT ON FUNCTION public.claim_telegram_updates(integer, integer) IS
  'Claims ready Telegram updates with renewable leases; only the claim token may finalize an attempt.';
