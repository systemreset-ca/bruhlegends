CREATE TABLE public.announcement_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  kind text NOT NULL,
  body text NOT NULL,
  dedupe_key text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.announcement_queue TO service_role;

ALTER TABLE public.announcement_queue ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX announcement_queue_dedupe_idx
  ON public.announcement_queue (group_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX announcement_queue_pending_idx
  ON public.announcement_queue (group_id, created_at)
  WHERE sent_at IS NULL;