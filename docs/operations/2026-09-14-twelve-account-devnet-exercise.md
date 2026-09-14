# Twelve-account isolated devnet exercise

Later fresh owner-funded execution succeeded; see [funded proof](2026-09-14-twelve-account-devnet-funded-proof.md) and [current live results](twelve-account-devnet-results.json). Earlier failed-run evidence below is historical and preserved in [unfunded results](twelve-account-devnet-unfunded-results.json).

Owner authorized this exercise on 2026-09-14. It runs in the existing repository, without a new Lovable project, Cloud data writes or website changes.

## Executed local checks

`tools/db-validation/twelve-account-devnet.mjs` uses the production encrypted account-wallet generator and envelope verification. Twelve synthetic Telegram IDs each receive one internal wallet and one unverified external public candidate. All private material and encrypted envelopes stay in process memory; reports contain public addresses only. A mismatched account/envelope is rejected.

The disposable PostgreSQL database reuses the existing community validation schema and applies the actual proposed community RPC. Forty-eight synthetic calls span three groups: 24/12/12 calls locally, four calls and three contributing groups per account overall. A separate local-only fixture adds 24 explicitly synthetic transfer proofs. All 12 overall tipper rows have two sent and two received tips. These synthetic proofs are not on-chain transactions.

[Local public results](twelve-account-devnet-local-results.json) record passing wallet/account binding and call/tip aggregation. Fourteen existing wallet-envelope, bot-community-routing and group-scoring tests passed. The group counts in the standalone report are source attribution counts; actual local leaderboard behavior is covered separately by existing scoring tests.

## Live chain path and limitations

Run with Node supporting type stripping:

```sh
node --experimental-strip-types tools/db-validation/twelve-account-devnet.mjs
node --experimental-strip-types tools/db-validation/twelve-account-devnet.mjs --live
```

Install the repository dependencies and `tools/db-validation` dependencies first. RPC selection uses existing environment `BRUH_DEVNET_API_KEY`, then `SOLANA_RPC_URL`, otherwise public Solana devnet. Secrets stored in Lovable are not automatically local environment variables. The endpoint's genesis must match devnet before requesting funding or signing. Never use the mainnet key for this harness.

The live harness makes one faucet request, then waits at most 15 minutes for 0.05 devnet SOL. It plans 11 funding transfers of 0.003 SOL and 24 tip transfers of 0.0001 SOL, each signed from the generated encrypted test wallet, simulated with signature verification, submitted with preflight and queried at finalized commitment. Each tip has a unique reference. The actual production receipt matcher checks sender, recipient, amount, reference and exact observed network fee, and rejects an incorrect amount. Only matched finalized tips enter the disposable aggregate database. Signatures are recorded immediately after submission; partial/incomplete runs stay explicit.

[Earlier unfunded results](twelve-account-devnet-unfunded-results.json) are separate from the synthetic-proof fixture and later successful run. Initial public faucet attempt returned RPC error -32603; zero live transfers had occurred at that point. The in-memory root address was `63fHxpd6cAoHGDqdCK3EZLfjv9Lgut9NHyuqv3CeSxa3`. A single bounded Helius funding request in the original Lovable project verified devnet genesis, then was refused as rate_limited, without a signature or application/config changes. QuickNode's independent web form rejected the unfunded address for lack of mainnet balance despite conflicting FAQ wording; no mainnet funds were sent. The official Solana faucet was opened and prefilled for an owner-operated request/verification.

This harness is a test-only signer, not a new application signing/export path. It does not verify real Telegram authentication, invoke actual Telegram `/start` or `/tip`, implement SAP, reserve spends in Cloud, test production retries/withdrawals or enable live wallet spending. External candidate addresses are generated public references, not registered withdrawal permissions. No service fees, CHAD/BRUH rewards, mainnet activity, real Telegram messages or production leaderboard seed data are introduced.

Final outcome: funding did not arrive. Codex stopped only the unfunded harness process after the unsuccessful funding attempts and recorded `live_incomplete`, zero transactions and discarded keys in the live results. **Do not fund the recorded address now.** A fresh run is required for the chain portion. The next-run funding loop uses a wall-clock deadline, rather than letting slow RPC calls multiply a fixed retry count; an in-flight request has its separate 20-second timeout.

The fixture wallets are disposable. Once the bounded process exits their keys are lost; do not fund their addresses afterward. Re-running generates a fresh public report and fresh wallets.
