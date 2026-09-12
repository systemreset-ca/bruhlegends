-- Keep sensitive BRUH records reachable only through controlled server-side flows.
-- RLS stays enabled, but table grants are also removed so protection does not
-- depend on every future policy remaining correct.

REVOKE ALL PRIVILEGES ON TABLE
  public.group_members,
  public.miniapp_sessions,
  public.miniapp_login_tokens,
  public.swap_intents,
  public.verified_swaps,
  public.telegram_users,
  public.tip_intents,
  public.verified_transfers,
  public.wallet_challenges,
  public.wallets
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.group_members,
  public.miniapp_sessions,
  public.miniapp_login_tokens,
  public.swap_intents,
  public.verified_swaps,
  public.telegram_users,
  public.tip_intents,
  public.verified_transfers,
  public.wallet_challenges,
  public.wallets
TO service_role;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miniapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miniapp_login_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tip_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Restrictive false policies are a second boundary for the client roles. Even
-- if a table grant or permissive policy is added later, access remains denied
-- until this explicit server-only posture is deliberately changed.
DROP POLICY IF EXISTS "group_members deny client access" ON public.group_members;
CREATE POLICY "group_members deny client access"
  ON public.group_members AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "miniapp_sessions deny client access" ON public.miniapp_sessions;
CREATE POLICY "miniapp_sessions deny client access"
  ON public.miniapp_sessions AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "miniapp_login_tokens deny client access" ON public.miniapp_login_tokens;
CREATE POLICY "miniapp_login_tokens deny client access"
  ON public.miniapp_login_tokens AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "swap_intents deny client access" ON public.swap_intents;
CREATE POLICY "swap_intents deny client access"
  ON public.swap_intents AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "verified_swaps deny client access" ON public.verified_swaps;
CREATE POLICY "verified_swaps deny client access"
  ON public.verified_swaps AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "telegram_users deny client access" ON public.telegram_users;
CREATE POLICY "telegram_users deny client access"
  ON public.telegram_users AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "tip_intents deny client access" ON public.tip_intents;
CREATE POLICY "tip_intents deny client access"
  ON public.tip_intents AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "verified_transfers deny client access" ON public.verified_transfers;
CREATE POLICY "verified_transfers deny client access"
  ON public.verified_transfers AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "wallet_challenges deny client access" ON public.wallet_challenges;
CREATE POLICY "wallet_challenges deny client access"
  ON public.wallet_challenges AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "wallets deny client access" ON public.wallets;
CREATE POLICY "wallets deny client access"
  ON public.wallets AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

