# Devnet custody core source validation

Branch: `codex/devnet-custody-core`. Baseline: `cf6aa6fbd822bef4e50d85ddf504e5d0159d0c09`. Scope: first inactive implementation of owner-authorized self-managed funded wallets, issue #45. Accepted direction is decision 0006; user rejected the managed-wallet-provider proposal. Telegram two-step verification is a recommendation only.

## Implemented and tested

- AES-256-GCM envelope encryption with separate random per-wallet data keys and authenticated wallet/group/member/network/version binding. Wrapping keys must be 256-bit, non-extractable and explicitly supplied; there is no generated/default production master key. Generated seeds are never returned or logged. Wrong keys, swapped scopes and tampered ciphertext/IVs fail closed. Rotation preserves the public wallet address. Ten actual cryptographic regression tests pass.
- Proposed actual SQL for frozen devnet accounts, encrypted envelopes, immutable ledger receipts, duplicate-safe confirmed deposit accounting, fee-inclusive atomic reservations and balanced settlement. Fourteen isolated PGlite SQL tests pass, including aggregate overspend rejection, conflicting replays, unavailable/banned/foreign memberships, audit failure rollback, immutable history, no key-table access, denied execution grants and no mainnet rows. Tests use owner privileges for synthetic fixtures; no synthetic Cloud/live rows were created.
- Full application suite: 121 tests across 19 files pass; production build passes. Strict TypeScript and changed-file lint pass. CI adds the custody SQL suite alongside existing participation SQL validation. Dependencies/lockfile are unchanged.

## Not implemented / not verified

This is not a usable funded wallet yet. Missing: isolated signer hosting/key management, signer/verifier roles, on-chain deposit discovery and exact instruction verification, SOL transaction construction/simulation/signing, durable signed transaction storage before broadcast, ambiguous submission/expiry reconciliation, Telegram confirmation/spending-limit policy, passkey registration/step-up/recovery, withdrawals/export, custody-specific public disclosures and authenticated mobile UX. No Cloud migration or application feature activation is requested by this slice. Multi-session contention, real devnet funding/signing and independent review are NOT RUN.

Accounting RPC proof fields are trusted server inputs, not chain verification. Expires-at cannot safely release a signed transaction's reservation; no cancellation RPC is exposed. The ordinary service role cannot read encrypted keys or execute new writes. Do not add those grants to make development easier. JavaScript memory erasure is not provable; process isolation and restricted key authority remain necessary. Future application reads must preserve exact bigint lamports, rather than rounding JSON numbers.

An existing cloud account for isolated BRUH signing/key management is requested from the owner through the pending input question. It does not require pasting Telegram, Helius or user-wallet secrets. No managed wallet provider, new paid commitment or production key was selected or created.

## Durable-first submission extension

`custody-submission.server.ts` adds an adapter-based submission/reconciliation protocol: assert devnet genesis before touching a signer, commit signed bytes before broadcast, reuse the original signature/bytes after ambiguous submission, reject persistence substitution, and keep funds held on pending/mismatched/incomplete-history results. Finalized exact transfer proof permits settlement; definitively failed transactions require actual fee reconciliation; unseen expiry requires complete history and finalized block height beyond last validity. Nine targeted protocol tests pass. This is a tested protocol with mocked adapters, not a real SDK signer, chain parser or durable SQL outbox implementation; those remain required before issuing wallets.

## Existing managed Cloud capability report

Lovable performed a read-only inspection and reported one Nitro/Cloudflare Worker deployment, no current separately deployed signing unit, and project-wide shared secret injection with no per-route secret scope. A wrapping key added to this project would be readable by its bot runtime. The tool reported owner-capable CREATEROLE, but no tested narrowly privileged signer connection or separately scoped secret deployment path. Database role ACLs and RLS are distinct: BYPASSRLS does not by itself grant SELECT on our new key table; owner-level connection authority still must be accounted for in the full threat model. No existing project isolation is inferred from another project's ability to store keys.

Owner says other Lovable projects handle private keys and trading, but their identities/hosting are not yet supplied. Request a link to one such project to inspect the actual existing deployment pattern before requiring a new external account. No external hosting account is selected and no paid resource or master key is provisioned. Current live bot remains external-wallet based.
