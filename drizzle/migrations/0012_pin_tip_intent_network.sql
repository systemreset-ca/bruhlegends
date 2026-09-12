ALTER TABLE public.tip_intents
  ADD COLUMN IF NOT EXISTS network text;

-- Every intent created before this migration came from the devnet-only release.
UPDATE public.tip_intents
SET network = 'devnet'
WHERE network IS NULL;

ALTER TABLE public.tip_intents
  ALTER COLUMN network SET DEFAULT 'devnet',
  ALTER COLUMN network SET NOT NULL;

ALTER TABLE public.tip_intents
  DROP CONSTRAINT IF EXISTS tip_intents_network_check;

ALTER TABLE public.tip_intents
  ADD CONSTRAINT tip_intents_network_check
  CHECK (network IN ('devnet', 'mainnet-beta'));

COMMENT ON COLUMN public.tip_intents.network IS
  'Solana cluster fixed when the payment request is created; verification must use the same cluster.';