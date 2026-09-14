# Devnet account-tip backend publication

Reviewed and published source: `5d5f171e34beca103ba852e7d234cc7a27ec98f6` in the original BRUH Lovable project `e287f314-27c2-40bf-94f4-4685a95781fe` to `https://bruh.tips`. Verified by 2026-09-14 14:26:36 UTC.

## Evidence

- Public candidate CI [34855324635](https://github.com/systemreset-ca/bruhlegends/actions/runs/34855324635) completed successfully for the exact candidate.
- Managed migrations 0018–0021 match their reviewed proposal SQL except outer transaction statements supplied by the runner. Existing migrations/history preserved.
- Cloud checks: 173 tests in 32 files, types, production build and actual disposable PostgreSQL authorization/credit/community/budget checks passed. Effective role facts are recorded in the separate managed migration records.
- Production Helius transport enforced devnet genesis before one finalized balance read; successful configured transport, 4966935000 lamports at the public disposable test address. Keys/endpoints were not exposed. This read used the original configured credentials.
- Flags `BRUH_ACCOUNT_TIPS_DEVNET_ENABLED=true`, `BRUH_ACCOUNT_SIGNING_DEVNET_ENABLED=true`; network devnet and account-wallet devnet gate true. Mainnet/rewards/swaps/export/withdrawal/retirement remain unavailable.
- Codex clicked original Lovable Publish → Publish changes and observed completed “Your website was updated”. Independent public checks: `/` HTTP 200, `/wallet-action` HTTP 200, unauthenticated POST `/api/public/telegram/webhook` HTTP 401.
- Remote main remained the reviewed candidate after publication. The UI does not expose an independent runtime commit fingerprint, so the SHA identifies the reviewed source candidate; HTTP status alone does not attest an artifact SHA or live Telegram spend.

## What is available for pilot acceptance

A group `/tip <exact amount> SOL` reply prepares a native SOL transfer between the two stored BRUH account wallets. Only its sender can obtain the private Mini App review button. `/security` privately sets a separate Secure Action Password. Fresh server-verified Telegram initData and the password authorize only that exact intent; immutable signed bytes are persisted before any broadcast. Confirmed exact receipts atomically populate tip history and group/community contributions.

Receipt checks use a 15-second intent cooldown and global 500-check UTC daily devnet budget. Already credited facts use stored proof. These cap receipt requests, not every provider operation or all Cloud billing. No new scheduler/message loop was added.

## Remaining acceptance

The real owner Telegram password setup, funded account-wallet tip, finalized receipt/history/leaderboard and retry acceptance are pending. The earlier [twelve-account funded chain proof](2026-09-14-twelve-account-devnet-funded-proof.md) remains a separate synthetic-identity test with 35 real finalized devnet transfers; it is not substituted for this real-user workflow. Disposable test keys were discarded; do not fund old test addresses again.

Codex changed bot/backend and GitHub records; landing-page marketing/design was not edited. Shared worker/platform administrator custody limitations remain recorded. This publication is not mainnet certification or a completed wallet export/withdrawal lifecycle.
