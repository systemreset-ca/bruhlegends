# BRUH Legends

Telegram-wide and group leaderboards, crypto calls and encrypted account-wallet Solana tipping. Product first; BRUH later. No presale. Participation earning and token launch remain gated.

## Inspect the evidence

- [Current devnet bot backend publication and acceptance status](docs/operations/2026-09-14-account-tip-backend-publication.md)
- [Twelve-account proof: 35 finalized devnet transactions and all explorer links](docs/operations/2026-09-14-twelve-account-devnet-funded-proof.md)
- [Private authorization, constrained signing and recovery](docs/operations/2026-09-14-account-tip-authorization.md)
- [Atomic tip history and community leaderboard credit](docs/operations/2026-09-14-account-tip-credit.md)
- [Global community and local group architecture](docs/decisions/0011-community-and-group-rankings.md)

- [Finalized two-wallet devnet transfer and transaction link](docs/operations/2026-09-14-devnet-two-wallet-transfer.md)
- [Current one-wallet-per-Telegram-account design](docs/decisions/0008-one-wallet-per-telegram-account.md)
- [99% recipient / 1% CHAD allocation and future campaigns](docs/decisions/0009-tip-funded-chad-and-future-campaigns.md)

- [Accepted grassroots strategy and A–E milestones](docs/decisions/0004-grassroots-participation.md)
- [Changelog and release references](CHANGELOG.md)
- [Dated runtime/deployment evidence](docs/operations/)
- [Participation ledger, controls and remaining gates](docs/decisions/0005-participation-ledger.md)
- [History review and public validation workflow](docs/operations/2026-09-13-public-history-review.md)

Follow issues → pull requests → exact commits → tests → deployment records → verified on-chain receipts when available. Planned, implemented, tested and live are different states. A public repository or green build is not a guarantee of security or token value.

The published devnet backend generates one encrypted wallet per Telegram account and supports private Secure Action Password approval for constrained SOL tipping. Real-user funded Telegram acceptance remains pending; mainnet, swaps, token rewards and protected export/withdrawal/retirement are not active. Never send private keys or seed phrases to bot chat. Synthetic chain proofs and managed checks are labeled separately from real-user acceptance. Do not infer a mint, allocation, liquidity lock or deployed feature from an old draft or an unreleased branch.

## Project coordination

BRUH Legends is a Telegram bot and Mini App for group-attributed call tracking, community-wide reputation and gated account-wallet Solana tipping. The public domain is https://bruh.tips.

- [Current handoff and inspection findings](docs/AI_HANDOFF.md)
- [Delivery plan and revision workflow](docs/PROJECT_PLAN.md)
- [Work chat kickoff message](docs/WORK_CHAT_BRIEF.md)

These documents distinguish intended behavior, code found in the repository, and verified deployment. Historical Lovable phase plans remain preserved as source material.

New Project "BRUH" - you have 2 .md files I created with ChatGPT, enable cloud etc etc, we are making a @connector:telegram:"Telegram" Bot that will act as a Utility tool for the Crypto COmmunity - read the 2 attached files and begin building a Plan for us!!

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bruh.tips

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e287f314-27c2-40bf-94f4-4685a95781fe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
