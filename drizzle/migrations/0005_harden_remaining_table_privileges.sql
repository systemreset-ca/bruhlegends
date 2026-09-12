-- Keep the remaining BRUH domain records reachable only through controlled
-- server-side flows. These tables currently have no browser data path.

REVOKE ALL PRIVILEGES ON TABLE
  public.announcement_queue,
  public.audit_events,
  public.calls,
  public.disputes,
  public.groups,
  public.market_observations,
  public.milestones,
  public.seasons,
  public.supported_assets,
  public.bruh_price_quotes,
  public.webhook_updates
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.announcement_queue,
  public.audit_events,
  public.calls,
  public.disputes,
  public.groups,
  public.market_observations,
  public.milestones,
  public.seasons,
  public.supported_assets,
  public.bruh_price_quotes,
  public.webhook_updates
TO service_role;

ALTER TABLE public.announcement_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supported_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bruh_price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_updates ENABLE ROW LEVEL SECURITY;

-- Exact-name drops make this migration safe under Lovable's repeated migration
-- validation pass while leaving one restrictive policy on each table.
DROP POLICY IF EXISTS "announcement_queue deny client access" ON public.announcement_queue;
CREATE POLICY "announcement_queue deny client access"
  ON public.announcement_queue AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "audit_events deny client access" ON public.audit_events;
CREATE POLICY "audit_events deny client access"
  ON public.audit_events AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "calls deny client access" ON public.calls;
CREATE POLICY "calls deny client access"
  ON public.calls AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "disputes deny client access" ON public.disputes;
CREATE POLICY "disputes deny client access"
  ON public.disputes AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "groups deny client access" ON public.groups;
CREATE POLICY "groups deny client access"
  ON public.groups AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "market_observations deny client access" ON public.market_observations;
CREATE POLICY "market_observations deny client access"
  ON public.market_observations AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "milestones deny client access" ON public.milestones;
CREATE POLICY "milestones deny client access"
  ON public.milestones AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "seasons deny client access" ON public.seasons;
CREATE POLICY "seasons deny client access"
  ON public.seasons AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "supported_assets deny client access" ON public.supported_assets;
CREATE POLICY "supported_assets deny client access"
  ON public.supported_assets AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "bruh_price_quotes deny client access" ON public.bruh_price_quotes;
CREATE POLICY "bruh_price_quotes deny client access"
  ON public.bruh_price_quotes AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "webhook_updates deny client access" ON public.webhook_updates;
CREATE POLICY "webhook_updates deny client access"
  ON public.webhook_updates AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
