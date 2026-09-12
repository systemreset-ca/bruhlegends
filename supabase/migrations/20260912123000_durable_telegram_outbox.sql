-- Separate Telegram webhook effects from outbound API delivery. Handler retries can
-- update one pending action per deterministic key without sending duplicate replies.

CREATE TABLE IF NOT EXISTS public.telegram_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_update_id bigint NOT NULL REFERENCES public.webhook_updates(telegram_update_id) ON DELETE CASCADE,
  action_key text NOT NULL,
  method text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'failed', 'sent', 'dead_letter')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  lock_token uuid,
  sent_at timestamptz,
  response_message_id bigint,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (telegram_update_id, action_key)
);

CREATE INDEX IF NOT EXISTS telegram_outbox_ready_idx
  ON public.telegram_outbox (next_attempt_at, created_at)
  WHERE sent_at IS NULL AND status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS telegram_outbox_retention_idx
  ON public.telegram_outbox (sent_at)
  WHERE sent_at IS NOT NULL;

ALTER TABLE public.telegram_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.telegram_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.telegram_outbox TO service_role;

DROP POLICY IF EXISTS "telegram_outbox deny client access" ON public.telegram_outbox;
CREATE POLICY "telegram_outbox deny client access"
  ON public.telegram_outbox AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.enqueue_telegram_action(
  p_telegram_update_id bigint,
  p_action_key text,
  p_method text,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_action_key IS NULL OR length(p_action_key) = 0
     OR p_method NOT IN ('sendMessage', 'answerCallbackQuery', 'editMessageText') THEN
    RAISE EXCEPTION 'Invalid Telegram outbox action';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.webhook_updates AS parent
    WHERE parent.telegram_update_id = p_telegram_update_id
      AND parent.processed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Telegram update is not pending';
  END IF;

  INSERT INTO public.telegram_outbox (
    telegram_update_id,
    action_key,
    method,
    payload
  )
  VALUES (
    p_telegram_update_id,
    p_action_key,
    p_method,
    p_payload
  )
  ON CONFLICT (telegram_update_id, action_key) DO UPDATE
  SET
    method = EXCLUDED.method,
    payload = EXCLUDED.payload
  WHERE telegram_outbox.sent_at IS NULL
    AND telegram_outbox.status IN ('pending', 'failed');
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_telegram_action(bigint, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_telegram_action(bigint, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_telegram_action(bigint, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_telegram_action(bigint, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_telegram_outbox(
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
    WHERE parent.processed_at IS NOT NULL
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

REVOKE ALL ON FUNCTION public.claim_telegram_outbox(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_telegram_outbox(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_telegram_outbox(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_outbox(integer, integer) TO service_role;

COMMENT ON TABLE public.telegram_outbox IS
  'Durable Telegram API actions emitted by successfully processed webhook updates.';
COMMENT ON FUNCTION public.enqueue_telegram_action(bigint, text, text, jsonb) IS
  'Upserts one unsent action per deterministic webhook-update action key.';
COMMENT ON FUNCTION public.claim_telegram_outbox(integer, integer) IS
  'Claims deliverable Telegram actions only after their parent update is processed.';

