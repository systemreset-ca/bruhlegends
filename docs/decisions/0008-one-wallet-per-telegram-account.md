# One active wallet per Telegram account

Accepted owner revision, 2026-09-13. Supersedes decision 0006's unresolved wallet identity question and the group-scoped custody prototypes. This is an implementation requirement, not a claim of deployment.

## Identity and commands

BRUH generates one active Solana wallet per verified `telegram_user_id` per network. The same account uses that wallet in every group where the bot is installed and the account is a member. Group calls, statistics, leaderboard records, tips and attribution remain keyed by chat and user. Wallet ownership is deliberately user-level; it is no longer a group-specific wallet or an implicit fallback.

In private chat, `/start` creates the first wallet idempotently. `/wallet make` creates a wallet only when no active wallet exists, with explicit confirmation. Concurrent starts must return the same wallet. `/wallet show` displays the current public address, network and confirmed/reserved balance. In a group, wallet management redirects to private chat; no private key is ever sent to a group.

`/wallet keys` begins an authenticated private export flow with explicit confirmation and step-up protection; the bot does not print a key into Telegram messages, logs or public documentation. `/wallet destroy` begins a confirmed retirement flow. Stop new spends, reconcile pending transactions and ensure remaining SOL/SPL assets are withdrawn or otherwise explicitly resolved before destroying signing access. Retain retired public addresses, receipts and audit events. Key destruction is irreversible and must not strand funds. A replacement wallet is a new audited lifecycle, with at most one active wallet.

## Implementation boundaries

Use the original BRUH Lovable project and repository as the managed product. The owner reports its Helius and Telegram secrets supplied. No new project is requested. Guardian work is historical/prototype work, not an enabled production dependency. Do not merge the old per-group custody migrations unchanged.

Private encrypted server-side custody requires clear disclosures, authenticated command intent, replay/idempotency controls and concurrent-spend reservations. Telegram two-step verification cannot be claimed as proved by Bot API. Chain confirmation, exact recipient/amount/reference verification, audit events and network allowlists remain required. Mainnet and real-funds activation remain gated.

## First acceptance evidence

First run a small trusted devnet experiment in the original project: two disposable memory-only wallets, Helius devnet genesis verification, legitimate faucet funding, a preflighted 0.001 SOL transfer, finalized exact on-chain verification and a public explorer link. Commit the script and actual result. This experiment does not establish Telegram onboarding, production encrypted custody or recovery/export readiness. Record faucet failure honestly if no funding is available.
