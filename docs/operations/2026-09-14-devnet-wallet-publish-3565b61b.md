# Published private Telegram devnet wallets

Publication verified 2026-09-14 at approximately 03:47 UTC in the original BRUH Lovable project `e287f314-27c2-40bf-94f4-4685a95781fe`.
Exact published source: `3565b61b67be82db8e699b485adc18c2655db384`.

## Change and evidence

Private `/start` now creates or reuses one encrypted devnet wallet per verified Telegram account. `/wallet make` confirms creation; `/wallet show` authenticates the stored wallet and reads its finalized devnet balance. The address is shared across groups; call records, statistics and attribution remain group-isolated. No external wallet is required for this account-wallet path.

Implementation and reviewed follow-ups: [PR49](https://github.com/systemreset-ca/bruhlegends/pull/49), [PR50](https://github.com/systemreset-ca/bruhlegends/pull/50), [PR51](https://github.com/systemreset-ca/bruhlegends/pull/51), [PR52](https://github.com/systemreset-ca/bruhlegends/pull/52). All merged through normal merge commits; published history was preserved.

- Exact publication-commit [main CI34803603442](https://github.com/systemreset-ca/bruhlegends/actions/runs/34803603442): passed.
- Lovable checked the exact source with the enabled Cloud flag: 126/126 tests across 22 files, types and production build passed; no source edits or new commits in that final verification.
- Codex clicked Publish changes; Lovable reported **Your website was updated** for `bruh.tips`.
- Independent HTTPS checks after publication: `/` returned 200 with active Solana devnet beta and `/wallet show` text; `/app` returned 200; unauthenticated POST `{}` to `/api/public/telegram/webhook` returned 401.

Cloud migration, actual effective role grants, stored-key round-trip/tamper checks and devnet genesis verification are recorded in [activation evidence](2026-09-14-devnet-account-wallet-activation.md). Configuration is `SOLANA_NETWORK=devnet`, `BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED=true`, persistent key version `devnet-v1`. The existing encryption key was retained; its value was never printed or committed. Approval review rejected deletion of the feature flag; the successful change used the supported in-place secure form, without deleting it.

## Limits and next live check

This is **creation and balance display only**. Bot-wallet spending, key export and retirement are unavailable; tips are blocked in this mode. No mainnet, reward purchase/distribution, BRUH mint or liquidity operation was activated. The original worker and its administrators remain trusted; `sandbox_exec` has effective SELECT/INSERT with BYPASSRLS on the new tables. This is not a mainnet custody security certification.

The earlier finalized two-disposable-wallet 0.001 SOL transfer is [separate proof](2026-09-14-devnet-two-wallet-transfer.md), not proof that these persistent Telegram wallets have tipped each other.

Owner check, still pending: from each of the two Telegram accounts, privately send `/start`, then `/wallet show`, then repeat `/start`. Each account should retain its address and the two accounts should have different addresses. Do not send real SOL. Confirm those actual replies before implementing the next controlled devnet funded-wallet spending slice. Protected export and balance-safe retirement remain separate unfinished work.
