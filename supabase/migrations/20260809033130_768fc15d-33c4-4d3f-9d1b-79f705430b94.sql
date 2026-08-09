-- ============ enums ============
CREATE TYPE public.call_status AS ENUM ('pending_confirmation','active','quarantined','rugged_or_illiquid','invalidated','archived','imported');
CREATE TYPE public.detection_mode AS ENUM ('command_only','full_detection');
CREATE TYPE public.member_role AS ENUM ('member','moderator','admin');
CREATE TYPE public.tip_privacy AS ENUM ('public','pseudonymous','anonymous','private');
CREATE TYPE public.intent_status AS ENUM ('created','awaiting_payment','confirmed','expired','failed','cancelled');
CREATE TYPE public.wallet_status AS ENUM ('unverified','verified','pending_replacement','revoked');

-- ============ core identity ============
CREATE TABLE public.telegram_users (
  telegram_user_id bigint PRIMARY KEY,
  username text,
  first_name text,
  last_name text,
  language_code text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id bigint NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Unknown group',
  chat_type text NOT NULL DEFAULT 'supergroup',
  detection_mode public.detection_mode NOT NULL DEFAULT 'command_only',
  is_paused boolean NOT NULL DEFAULT false,
  min_liquidity_usd numeric NOT NULL DEFAULT 5000,
  min_token_age_minutes integer NOT NULL DEFAULT 0,
  allow_repeat_calls boolean NOT NULL DEFAULT false,
  announce_tips boolean NOT NULL DEFAULT true,
  announcement_mode text NOT NULL DEFAULT 'immediate',
  quiet_hours_start integer,
  quiet_hours_end integer,
  raw_message_retention_days integer NOT NULL DEFAULT 30,
  installed_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX seasons_one_active_per_group ON public.seasons (group_id) WHERE is_active;

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL REFERENCES public.telegram_users(telegram_user_id) ON DELETE CASCADE,
  display_name text,
  pseudonym text,
  role public.member_role NOT NULL DEFAULT 'member',
  detection_opt_out boolean NOT NULL DEFAULT false,
  default_tip_privacy public.tip_privacy NOT NULL DEFAULT 'public',
  is_banned boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, telegram_user_id)
);

-- ============ wallets ============
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  address text NOT NULL,
  status public.wallet_status NOT NULL DEFAULT 'unverified',
  verification_method text,
  signature_hash text,
  nonce text,
  verified_at timestamptz,
  active_from timestamptz NOT NULL DEFAULT now(),
  replaced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wallets_one_current_per_membership ON public.wallets (membership_id) WHERE replaced_at IS NULL;

CREATE TABLE public.wallet_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  address text NOT NULL,
  nonce text NOT NULL UNIQUE,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ calls ============
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  caller_membership_id uuid NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  mint text NOT NULL,
  symbol text,
  name text,
  pool_address text,
  status public.call_status NOT NULL DEFAULT 'pending_confirmation',
  source text NOT NULL DEFAULT 'explicit',
  source_message_id bigint,
  source_seen_at timestamptz NOT NULL DEFAULT now(),
  note text,
  baseline_price_usd numeric,
  baseline_market_cap_usd numeric,
  baseline_liquidity_usd numeric,
  baseline_provider text,
  baseline_raw jsonb,
  ath_price_usd numeric,
  ath_multiple numeric,
  ath_at timestamptz,
  last_price_usd numeric,
  last_observed_at timestamptz,
  invalidated_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX calls_first_caller_per_group_season ON public.calls (group_id, season_id, mint)
  WHERE status IN ('active','pending_confirmation','quarantined');
CREATE INDEX calls_group_created_idx ON public.calls (group_id, created_at DESC);

CREATE TABLE public.market_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL DEFAULT now(),
  price_usd numeric,
  market_cap_usd numeric,
  liquidity_usd numeric,
  provider text,
  quarantined boolean NOT NULL DEFAULT false,
  quarantine_reason text,
  raw jsonb,
  UNIQUE (call_id, observed_at)
);

CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  milestone numeric NOT NULL,
  reached_at timestamptz NOT NULL DEFAULT now(),
  price_usd numeric,
  announced_at timestamptz,
  UNIQUE (call_id, milestone)
);

CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  call_id uuid REFERENCES public.calls(id) ON DELETE CASCADE,
  raised_by_membership_id uuid REFERENCES public.group_members(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolved_by_membership_id uuid REFERENCES public.group_members(id) ON DELETE SET NULL,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- ============ assets, quotes, tips, swaps ============
CREATE TABLE public.supported_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  mint text,
  decimals integer NOT NULL,
  is_native boolean NOT NULL DEFAULT false,
  is_tip_asset boolean NOT NULL DEFAULT false,
  is_input_asset boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT false,
  network text NOT NULL DEFAULT 'mainnet-beta',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bruh_price_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_symbol text NOT NULL,
  price_usd numeric NOT NULL,
  price_sol numeric,
  provider text NOT NULL,
  quoted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  raw jsonb
);

CREATE TABLE public.tip_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  sender_membership_id uuid NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  recipient_membership_id uuid NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  recipient_address text NOT NULL,
  asset_symbol text NOT NULL,
  asset_mint text,
  amount_base_units bigint NOT NULL,
  amount_display numeric NOT NULL,
  usd_reference numeric,
  quote_id uuid REFERENCES public.bruh_price_quotes(id) ON DELETE SET NULL,
  reference_key text NOT NULL UNIQUE,
  privacy public.tip_privacy NOT NULL DEFAULT 'public',
  status public.intent_status NOT NULL DEFAULT 'created',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.verified_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_intent_id uuid NOT NULL UNIQUE REFERENCES public.tip_intents(id) ON DELETE CASCADE,
  signature text NOT NULL UNIQUE,
  slot bigint,
  recipient_address text NOT NULL,
  asset_mint text,
  amount_base_units bigint NOT NULL,
  usd_reference_at_execution numeric,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);

CREATE TABLE public.swap_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  input_symbol text NOT NULL,
  output_symbol text NOT NULL,
  input_amount_base_units bigint NOT NULL,
  min_output_base_units bigint NOT NULL,
  slippage_bps integer NOT NULL DEFAULT 100,
  route jsonb,
  status public.intent_status NOT NULL DEFAULT 'created',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.verified_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swap_intent_id uuid NOT NULL UNIQUE REFERENCES public.swap_intents(id) ON DELETE CASCADE,
  signature text NOT NULL UNIQUE,
  output_amount_base_units bigint,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);

-- ============ infrastructure ============
CREATE TABLE public.webhook_updates (
  telegram_update_id bigint PRIMARY KEY,
  update_type text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text
);

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id text,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ updated_at ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER groups_touch BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER group_members_touch BEFORE UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER calls_touch BEFORE UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tip_intents_touch BEFORE UPDATE ON public.tip_intents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ grants + RLS (server-only access) ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'telegram_users','groups','seasons','group_members','wallets','wallet_challenges',
    'calls','market_observations','milestones','disputes','supported_assets',
    'bruh_price_quotes','tip_intents','verified_transfers','swap_intents','verified_swaps',
    'webhook_updates','audit_events'
  ] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;