# One BRUH-generated wallet per Telegram user

Date: 2026-09-14.
Status: owner-accepted architecture revision. **Documented only — not implemented.** No schema, source or command changes were made alongside this record.
Owner: Codex engineering owns implementation; this document records the accepted direction.

## Revision

Previously, wallet linkage was scoped per membership (per user per group). The revised direction is:

- **One active BRUH-generated wallet per `telegram_user_id`**, shared across every group where that user is present and the bot is installed.
- **Group-scoped isolation is unchanged**: calls, statistics, leaderboards, seasons and tip attribution remain isolated per group. Only the wallet identity is shared.
- A user therefore has a single receiving address, while each group continues to see only its own activity and its own attribution of tips.

## Commands

Wallet lifecycle is private-chat only; never in a group.

- `/start` in private chat: offers wallet creation for the user.
- `/wallet` in private chat with subactions:
  - `make` — create the user's active wallet if none exists.
  - `show` — display the public address and live on-chain balance only.
  - `keys` — does **not** send key material in Telegram. It issues a link into an authenticated private export flow in the Mini App / web app; the export happens there, over an authenticated session, once.
  - `destroy` — requires explicit confirmation and must not strand balances or history.

## Non-negotiable constraints

- No private key or seed phrase is ever sent through Telegram in plaintext, nor logged, nor included in any message, digest, export or audit row.
- Key export is only reachable through an authenticated, single-use, short-lived private flow tied to the verified Telegram identity.
- `destroy` must be blocked, or must require an explicit prior withdrawal, when the wallet holds a nonzero balance; historical records (tips, calls, attribution, audit) are retained and never deleted by wallet destruction. Destroying a wallet retires the address, it does not erase the past.
- Balances and holdings are always read live from the chain; the database remains history and audit only. A failed chain read fails loud.
- Custody and key-isolation design remain open and are tracked separately; nothing in this revision authorizes storing key material in the bot runtime.

## Sequencing

Priority order accepted by the owner: (1) the basic devnet two-wallet transfer exercise — completed and recorded in `docs/operations/2026-09-14-devnet-two-wallet-transfer.md`; (2) custody/isolation resolution; (3) this per-user wallet schema and command surface. Item 3 is deliberately not started.
