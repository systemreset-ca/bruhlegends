INSERT INTO public.supported_assets (symbol, mint, decimals, is_native, is_tip_asset, is_input_asset, enabled, network)
VALUES
  ('SOL', NULL, 9, true, true, true, true, 'mainnet-beta'),
  ('USDC', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6, false, true, true, true, 'mainnet-beta'),
  ('BRUH', NULL, 9, false, true, true, false, 'mainnet-beta')
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS supported_assets_symbol_network_key
  ON public.supported_assets (symbol, network);

CREATE INDEX IF NOT EXISTS tip_intents_status_expires_idx
  ON public.tip_intents (status, expires_at);

CREATE INDEX IF NOT EXISTS calls_group_season_idx
  ON public.calls (group_id, season_id);

CREATE INDEX IF NOT EXISTS disputes_group_status_idx
  ON public.disputes (group_id, status);

CREATE INDEX IF NOT EXISTS market_observations_observed_at_idx
  ON public.market_observations (observed_at);

CREATE INDEX IF NOT EXISTS audit_events_created_at_idx
  ON public.audit_events (created_at);