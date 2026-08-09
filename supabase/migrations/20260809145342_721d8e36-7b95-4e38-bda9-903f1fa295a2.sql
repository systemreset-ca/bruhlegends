CREATE TYPE public.fee_leg AS ENUM ('buy', 'sell');

CREATE TABLE public.fee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id),
  membership_id uuid REFERENCES public.group_members(id),
  tip_intent_id uuid REFERENCES public.tip_intents(id),
  leg public.fee_leg NOT NULL,
  asset_symbol text NOT NULL,
  asset_mint text,
  gross_base_units bigint NOT NULL,
  fee_base_units bigint NOT NULL,
  fee_bps integer NOT NULL,
  treasury_address text NOT NULL,
  usd_reference_at_execution numeric,
  signature text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.fee_events TO service_role;

ALTER TABLE public.fee_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_events service role only"
ON public.fee_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE UNIQUE INDEX fee_events_signature_leg_idx
ON public.fee_events (signature, leg)
WHERE signature IS NOT NULL;

CREATE INDEX fee_events_status_idx ON public.fee_events (status, created_at);
CREATE INDEX fee_events_group_idx ON public.fee_events (group_id, created_at DESC);

CREATE TRIGGER fee_events_touch
BEFORE UPDATE ON public.fee_events
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();