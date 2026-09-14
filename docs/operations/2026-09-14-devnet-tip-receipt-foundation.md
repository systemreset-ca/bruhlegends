# Devnet account-tip receipt foundation and JEETER precision

Owner continuation, 2026-09-14. Baseline `580261971eecb1428e818f2e48cec7e555e525ef`; branch `codex/devnet-transfer-foundation`. Source-only follow-up to the [published account-wallet release](2026-09-14-devnet-wallet-publish-3565b61b.md). No Cloud settings, migration, wallet keys, mainnet or spending gate changed.

## Accepted revision

JEETER precision is **9 decimals**, replacing the earlier 16-decimal proposal in decision 0009. Maximum representable Solana supply at this precision is `18446744073.709551615`; actual supply, mint, funding and campaign rules remain undecided. No mint or airdrop was created.

## Source behavior

`src/lib/account-sol-tip-receipt.ts` matches one narrowly scoped direct native-SOL transfer against the expected signature, sender, recipient, unique reference and exact lamports. It checks sender signer/fee-payer status, account permissions, System Program transfer instruction, recipient credit, sender debit including the reported network fee, and unchanged other balances. Failed execution, unsafe JSON integers, extra instructions/authorities, SPL assets, CPI and malformed receipts are rejected. No tolerance is applied.

`verifyFinalizedAccountSolTip` in `src/lib/account-wallet-balance.server.ts` establishes Helius devnet genesis before a single `getTransaction` query with `jsonParsed` and `finalized`. It reuses the bounded HTTPS devnet transport: five-second request deadlines, 16 KiB response cap, no redirect following, retries or polling, and no provider credentials in errors. Existing balance reads retain their behavior.

Protocol references: [Solana transaction structure](https://solana.com/docs/core/transactions), [Solana Pay reference convention](https://docs.solanapay.com/spec). The pure matcher itself does not establish finality; the server wrapper supplies that check. This strict pattern is deliberately not a replacement for every possible Solana Pay transaction: compute-budget instructions, memos, swaps and SPL transfers need separate reviewed support.

## Validation and limits

Twelve targeted tests passed across the new receipt proof, existing devnet balance behavior and allocation/precision accounting. Receipt fixtures are synthetic, not fabricated chain execution evidence. Tests include wrong ownership/signature/reference/amount, failed execution, extra authority/instructions, unexplained debits, unsafe values, malformed data, wrong genesis and bounded finalized lookup. Exact final types/lint/build and public CI results belong to the PR.

This verifier has **no live caller yet**. It does not decrypt seeds, sign/broadcast transactions, reserve balances, consume references or signatures, award tips, or change leaderboards. A repeated successful match alone is not idempotent settlement; durable storage must atomically consume the intent/reference/signature and retain audit events.

## Next funded-wallet slice

1. Confirm the owner's two private accounts create different addresses and retain each address across repeated `/start`.
2. Persist account-owned, group-attributed tip intents with immutable recipient/amount/reference and owner-bound private confirmation/expiry.
3. Reserve the complete spend including quoted network fees atomically; durable request uniqueness and per-wallet serialization must prevent concurrent overspending.
4. Build only the approved devnet transfer, simulate before signing, preserve a signed transaction before broadcast, and retry the same transaction rather than create another spend after an uncertain result.
5. Reconcile finalized receipts through the strict matcher and atomically record settlement/audit/leaderboard attribution. Keep ambiguous broadcasts reserved until reconciled; do not release them merely because a UI request expired.

Mainnet, real-funds withdrawals, protected key export, balance-safe retirement and CHAD/BRUH execution remain unfinished and gated. No new account, provider key or Lovable project is needed for this source slice.
