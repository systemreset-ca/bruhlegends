# Production publish: network-pinned devnet tips

Operation date: 2026-09-12 at approximately 15:22 America/Toronto.

GitHub and production application baseline: `59fa4b0882948de1b73c827461656d283b58e580`.

Lovable published the current GitHub `main` revision to the connected `bruh.tips` and `www.bruh.tips` domains. The release pins every new tip intent to its Solana network and prevents confirmation after the configured network changes. Devnet payment requests and user-facing instructions now state that they are tests and require a wallet set to Solana Devnet.

## Database state

- The managed Cloud Supabase migration added `public.tip_intents.network` as `text`, `NOT NULL`, with default `devnet`.
- The validated check constraint allows only `devnet` and `mainnet-beta`.
- The table contained zero tip intents when the migration was applied, so no historical records required backfilling.
- RLS and effective privileges remained unchanged: `PUBLIC`, `anon`, and `authenticated` cannot access the table; `service_role` retains the controlled server-side access used by the application.
- Rolled-back probes confirmed the default, rejected an invalid network, accepted `mainnet-beta`, and left no synthetic records.

Lovable journaled the managed migration as `drizzle/migrations/0012_pin_tip_intent_network.sql`, a semantic duplicate of the application migration at `drizzle/migrations/0011_pin_tip_intent_network.sql` and `supabase/migrations/20260912190000_pin_tip_intent_network.sql`.

## Pre-publish evidence

- Strict TypeScript checking passed on exact commit `59fa4b0882948de1b73c827461656d283b58e580`.
- All 80 tests across twelve files passed.
- The Lovable preview loaded the current managed revision and showed unpublished changes ready for `bruh.tips`.
- The application remains configured for devnet; mainnet and BRUH-token functionality remain gated.

## Post-publish smoke checks

- `GET https://bruh.tips/` returned HTTP 200 and contained the BRUH Legends brand.
- `GET https://bruh.tips/token` returned HTTP 200 and contained the devnet copy.
- An unauthenticated `POST https://bruh.tips/api/public/telegram/webhook` returned HTTP 401, confirming the production route remained live and rejected a request without the webhook secret.

No secret value, wallet key, seed phrase, transaction signature, wallet address, Telegram identifier, or private payload was read, displayed, or committed. This release remains a devnet validation build and is not approved for mainnet funds.
