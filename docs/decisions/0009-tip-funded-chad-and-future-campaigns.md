# Tip-funded CHAD and future reward campaigns

Owner direction, 2026-09-13. This revises the earlier illustrative extra-fee and treasury allocation models. It does not activate fees, swaps, tokens or funded campaigns.

Tracked delivery: [issue #47](https://github.com/systemreset-ca/bruhlegends/issues/47). Source validation: four monetary conservation/range/rounding tests passed; TypeScript and changed-file lint passed. The calculators have no chain calls, credential access or live command integration.

Public CI initially passed tests/types/build/database checks but flagged one unrelated historical false positive: `fdabfb2acae4c586f503744a0afd7feac66b76fa:services/custody-signer/devnet-smoke.ts:generic-api-key:20`. Review shows a runtime-generated non-extractable AES key passed to the vault with the literal version label `ephemeral-smoke-v1`, not a stored credential. Only that exact fingerprint is exempted; full-history scanning remains enabled.

## Accepted tip allocation

Before BRUH exists, deduct 1% from the SOL tip to purchase CHAD. The recipient receives 99% of the SOL; sender and recipient each receive half of the actual CHAD purchased. For 1 SOL: 0.99 SOL recipient proceeds, 0.01 SOL CHAD purchase budget. Network fees, swap fees, account rent and slippage must be quoted separately; they cannot silently reduce a promised output.

After BRUH is minted and routing is validated, convert the SOL tip to BRUH, give the recipient 99% of actual BRUH proceeds, and use the remaining 1% to buy CHAD. Split actual CHAD proceeds equally. Do not charge another 1% on the CHAD purchase or recipient's later exit as an implied part of this rule. This is an application allocation, not an immutable mint transfer tax.

Integer accounting floors the purchase budget; recipient proceeds retain rounding remainder. Split CHAD equally in base units. An odd final CHAD unit remains explicit undistributed campaign inventory, reconciled rather than silently assigned to either party. Tiny amounts may produce zero reward budget/output; do not promise a nonzero reward. No fee portion is reserved for operations under this particular split; operations/rent/gas funding needs a separate disclosed policy.

The source calculator `src/lib/tip-reward-allocation.ts` implements conservation and range checking only. It is not connected to live tipping. Actual execution requires canonical mints, approved routing, capped slippage and quote age, transaction simulation, balance reservations and confirmed receipts for the recipient and both rewards. No reward is counted merely because a quote says it will arrive. Separate transactions require an audited pending/retry/reconciliation workflow; never present a partially executed bundle as complete.

## Future proposals, inactive

| Campaign | Proposed trigger | Unresolved activation inputs |
| --- | --- | --- |
| JEETER | A participating sender or recipient sells BRUH | Canonical mint, funding, reward quantity/caps, eligible venues and evidence, qualifying period, privacy/notification policy |
| Additional CHAD | User voluntarily locks BRUH tip proceeds | Lock mechanism, duration, custody/withdrawal rights, bonus rule, funding/caps |
| HAKTUAH | User converts CHAD into BRUH | Canonical mint, funding, verified swap eligibility, reward rule/caps |

Owner revision, 2026-09-14: JEETER uses **9 decimals**, replacing the earlier 16-decimal proposal. Solana's mint supply is an unsigned 64-bit base-unit integer: maximum supply at this precision is `18446744073.709551615` tokens. See [Solana mint state](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/tokens/basics/create-mint.mdx). This is a precision constraint, not a chosen supply or deployed mint. Canonical mint, supply, funding and campaign rules remain unresolved; no token is created or activated by this decision.

Keep campaigns generic and configured by verified canonical mint, not symbol matching. A transfer alone is not evidence of a sale; a routed swap must match supported on-chain instructions and relevant balances. Private/exchange activity may be unobservable and must remain unknown. The same signature/event cannot earn repeatedly across the wallet's groups. A surprise campaign must not imply hidden spend authority, guaranteed token value or a publicly assigned label based on incomplete evidence.

BRUH/SOL, CHAD/SOL and BRUH/CHAD liquidity pools are explanatory future context, not deployment instructions. No provider credentials, mints, launch dates or lock yields are invented.

## Delivery order

1. Complete private Telegram account-wallet onboarding and management under decision 0008; encrypted persistent keys and one-active-wallet concurrency proof.
2. Complete devnet SOL tip receipts and fee-inclusive spend reservations; link public transaction evidence.
3. Validate this allocation with devnet test assets, actual swap proceeds, caps, transaction recovery and reconciled CHAD distribution.
4. Activate a controlled funded campaign only after mint, funding and execution policy are supplied and reviewed.
5. Add BRUH routing and optional proposal campaigns after their own configuration and validation. Mainnet remains separately gated.
