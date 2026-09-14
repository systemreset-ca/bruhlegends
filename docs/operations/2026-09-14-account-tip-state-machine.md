# Account-wallet SOL tip execution state

Original BRUH project only. Owner's current assignment: bot/backend, Helius/Solana and public GitHub revision evidence; website presentation belongs to the owner and Lovable. This source slice advances issue #45 without website edits, new projects, provider requests or on-chain broadcasts.

## Implemented

The proposed SQL creates separate account-tip intents, execution records and append-only audit events. Reservation freezes account-owned internal sender/recipient wallets, Telegram group attribution, exact lamports, quoted network fee, unique reference, request key and expiry. Wallet addresses are resolved from active stored account wallets, never from an external candidate or global fallback. Idempotent requests return the existing intent; changed recipient/group/amount/fee/reference conflict.

Transaction advisory locks and a unique pending-spend index permit one reserved/signed spend per wallet. The complete amount plus network fee must fit the observed balance. New reservations require a balance slot strictly newer than previous finalized debits. Observations and fee quotes are trusted server RPC inputs; this SQL alone cannot authenticate RPC data or guarantee freshness of an observation before the first spend.

State advances `reserved → signed → finalized` or `reserved → cancelled`. Signed bytes/signature/block-height are preserved before a future broadcast. Repeat persistence must match exactly; a new signature or different bytes cannot overwrite the old spend. Signed tips cannot be cancelled, including after UI expiry. Unmatched/ambiguous receipts never release their reservation. Finalized signatures are unique and repeated settlement preserves one audit event.

`reconcileAccountTip` reads frozen fields for a server-authenticated sender, verifies the finalized transaction through the existing bounded Helius devnet transport, then invokes atomic finalization. The receipt matcher now optionally enforces the exact reserved fee as well as sender, recipient, mint-free native SOL amount and reference. Failed proof cannot change state. No browser-provided recipient, fee or reference is accepted by reconciliation.

## Security and rollout limits

All three proposed tables enforce RLS/FORCE RLS and deny direct anon/authenticated/service_role table access. Controlled functions are service-only; intents and audits reject mutation. Execution mutation is restricted by application ACLs, not against administrators. Previously documented platform BYPASSRLS/shared-worker trust remains. SQL stores signed bytes but does not validate their transaction semantics; the future reviewed builder/signing service must bind them to the intent.

**Schema is proposed and unapplied. No route, bot command or scheduler calls this new service yet.** `BRUH_ACCOUNT_TIPS_DEVNET_ENABLED` defaults disabled unless explicitly true; this change neither sets it nor enables spending. Independent spending authorization/SAP, group-membership verification at initiation, fresh RPC balance/fee quote, simulation, signing, signed-before-broadcast orchestration, bounded worker recovery, failed/expired-chain reconciliation and integration with existing tip/leaderboard records remain required. A finalized account execution record alone does not award leaderboard credit. Mainnet, swaps/rewards, exports and retirement remain disabled.

## Validation

Nine targeted receipt/reconciliation tests passed across two files. Isolated SQL test passed with actual wrong-owner rejection, duplicate reservation/settlement, full fee-inclusive balance, stale snapshot rejection, pending-spend serialization, immutable fields/audit, role access denial and cancellation rejection after the signed intent's fixture expiry was advanced. Fixture SQL uses disposable synthetic identities/bytes, not claimed chain execution. Single PGlite session validates SQL behavior; independent-session concurrency remains unproven. Changed backend files lint clean. Exact typecheck/build/full CI results belong in the PR.
