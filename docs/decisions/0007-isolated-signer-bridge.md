# Isolated signer connection — engineering decision

Date: 2026-09-13. Implements the isolated-backend requirement in decision 0006 under the owner's standing implementation authorization. Source-only; no caller key or live wallet integration is configured by this record.

BRUH's application backend and the dedicated signer have separate secret scopes. Authenticate their controlled provisioning/membership requests with Ed25519 service signatures and exchange only the public verification keys. Each backend generates and keeps its own persistent random caller secret through its secret manager. This avoids copying a shared authentication secret or an elevated Supabase service key between projects. These service-authentication keys are not users' Solana wallet keys.

The reviewed initial protocol binds devnet protocol version, expected caller key ID, POST method, one of two fixed provisioning/membership paths, timestamp, random nonce and exact raw-body SHA-256 digest. Verification requires explicit pinned public configuration and an atomic durable nonce claim with 300-second retention. The timestamp must remain fresh after the claim completes. Missing configuration/storage, malformed inputs and signature/replay failures deny without exposing diagnostics.

A valid service signature proves only which backend sent a request. It does not grant membership, provisioning or spending permission. Production handlers must still verify Telegram identity and authoritative group/member mapping; signed client-selected group claims are insufficient. Keep production policy callbacks denied until the trusted membership contract is implemented and tested. The initial route allowlist contains no withdrawal, key-export or arbitrary transaction-signing endpoint.

User wallet envelopes and wrapping authority stay in the isolated signer. BRUH receives public wallet metadata and immutable transaction receipts, not wallet seeds, wrapping secrets or encrypted-envelope replicas. The original unapplied custody SQL prototype includes envelope storage; reconcile it with this boundary before applying any custody schema. Cross-backend registration must be idempotent, initially frozen and recoverable after interruption.

No mainnet, deposits, fund transfers, live user wallet provisioning, recovery/export or token functionality is enabled. Actual cross-project identity, membership and runtime verification remain required before activation.
