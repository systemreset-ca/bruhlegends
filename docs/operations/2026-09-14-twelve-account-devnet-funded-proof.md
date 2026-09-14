# Funded twelve-account devnet proof

The owner supplied devnet funding for a fresh run on 2026-09-14. The existing repository harness completed successfully with exit code 0 and status `devnet_transfers_and_isolated_rankings_verified`. No new project or website changes.

## Observed results

- Twelve synthetic Telegram identities, each paired with a distinct encrypted internal wallet generated and authenticated by the production wallet-envelope functions; external addresses are public candidates only.
- Forty-eight synthetic calls across three isolated test groups: 24/12/12 records. Community aggregation combines four calls and three contributing groups per account.
- Eleven actual devnet funding transfers, each 0.003 SOL, followed by 24 actual tips, each 0.0001 SOL. All 35 transfers finalized and matched the production receipt checker, including exact sender, recipient, amount, unique reference and observed network fee. Incorrect amounts were rejected.
- Final community caller and tipper projections each contain 12 accounts. Every account has two verified sent tips and two verified received tips. All 35 transaction signatures and references are distinct.
- Total tip volume: 0.0024 devnet SOL; funding distribution: 0.033 devnet SOL. Total network fees: 175,000 lamports (0.000175 devnet SOL).

[Public wallet addresses, all transaction links and final leaderboard results](twelve-account-devnet-results.json) are the complete generated artifact. The owner reported supplying 5 devnet SOL; an independent balance read after two funding transfers observed 4.99399 SOL in the root address, consistent with that funding and the recorded debits/fees.

[First finalized tip](https://explorer.solana.com/tx/5poXNEsQP8NiLcSc7k63FwfVPQ3tNw5Ui3iDhT7P28iuEAK9zqwSEqrGtz25NpCckmSHUSGUBgV8jbeK2JZr1tmT?cluster=devnet) was also checked by a separate RPC request: slot 498223630, no transaction error, four accounts, 100,000 lamports transferred and 5,000 lamports network fee. Sender `3hwWdq42GCvBubMNbLV9ysBozGTjQMG76Dnic2EBJQHn`, recipient `7NZjzAE4ZgCYqhqs7nt6SxnMKk9mGTYQhkqnrQXdFXCC`.

## Reproducibility and scope

[Harness and instructions](2026-09-14-twelve-account-devnet-exercise.md), introduced in [PR #63](https://github.com/systemreset-ca/bruhlegends/pull/63), are included in public CI for offline wallet/call/synthetic-tip aggregation. This funded execution used the public Solana devnet RPC, not the Helius key stored in Lovable. Genesis was verified before chain actions; each signed transfer was simulated and submitted with preflight, then queried at finalized commitment before counting it.

All identity/call/tip database fixtures remained in disposable local PostgreSQL. These are real devnet transactions but simulated Telegram accounts and call inputs. This proves encrypted test-wallet generation, test signing/transfers, exact receipt verification and community aggregation together. It does not prove real Telegram authentication/command delivery, production spend authorization, Cloud reservation/broadcast recovery, withdrawal/export, mainnet or reward swaps. Existing local group ranking behavior has separate scoring tests; the standalone report records group call attribution counts, not a live Telegram group reply.

The process has exited and test keys are discarded; do not fund these disposable addresses again. No private material was printed or committed. Original Cloud data, public production leaderboard and spending gates remain unchanged.

Earlier unsuccessful funding run is preserved in [unfunded results](twelve-account-devnet-unfunded-results.json) and Git history. Its blocker is superseded for this fresh funded execution; its accounts and addresses differ from this run. The local-only [synthetic-proof results](twelve-account-devnet-local-results.json) remain separately labeled.
