# BRUH 1% Service Fee (Buy + Sell)

## What you're asking for

A 1% service fee that lands in your wallet twice in a tip's life:

1. **Buy leg** — someone spends $10 to acquire BRUH (to tip with). You take 1% = $0.10.
2. **Sell leg** — the recipient cashes their BRUH back to SOL/USDC. You take 1% = $0.10.

Round trip = ~2% of the tip's face value.

## The money, at a glance

Per single $10 tip:

| Leg | Volume | Fee rate | Your cut | User receives |
|---|---|---|---|---|
| Buy $10 BRUH | $10.00 | 1% | $0.10 | $9.90 of BRUH |
| Tip transfer | $9.90 | 0% | $0.00 | $9.90 of BRUH |
| Sell back to SOL | $9.90 | 1% | $0.099 | $9.80 |
| **Round trip** | | | **$0.199** | **$9.80** |

Scaling it out (fee charged on the amount actually moving at each leg):

| Tips (@$10) | Buy volume | Buy fees | Sell volume | Sell fees | **Total to you** |
|---|---|---|---|---|---|
| 100 | $1,000 | $10.00 | $990 | $9.90 | **$19.90** |
| 1,000 | $10,000 | $100.00 | $9,900 | $99.00 | **$199.00** |
| 5,000 | $50,000 | $500.00 | $49,500 | $495.00 | **$995.00** |
| 10,000 | $100,000 | $1,000.00 | $99,000 | $990.00 | **$1,990.00** |

Rule of thumb: **~$2 for every $100 of tip volume** (~1.99% effective).

If you meant "$1,000 of total transaction volume": that's $10 on the buy side and ~$9.90 on the sell side = **~$19.90**.

Not every tip gets sold immediately. Realistic sell-through sensitivity on 1,000 tips ($10,000 bought):

| % of BRUH cashed out | Buy fees | Sell fees | Total |
|---|---|---|---|
| 100% | $100 | $99.00 | $199.00 |
| 60% | $100 | $59.40 | $159.40 |
| 30% | $100 | $29.70 | $129.70 |
| 0% (all held) | $100 | $0 | $100.00 |

## How it would actually work

Two ways to collect, and they are not equivalent:

**Option A — App-level fee (recommended, works today).** The fee is a leg inside BRUH's own buy/sell flow. When a user taps "Acquire BRUH" or "Cash out", the app builds a transaction that routes 1% to your treasury wallet and the remainder through the swap. Enforced only for swaps done through BRUH; someone using Jupiter directly pays nothing. Requires no token change and can ship before the mint exists.

**Option B — Token-2022 transfer fee.** The 1% is baked into the mint itself, so *every* transfer anywhere on Solana withholds the fee, and you harvest it to your treasury. Unavoidable, but: it must be decided at mint creation (cannot be added later), it also taxes plain tip transfers wallet-to-wallet, and some DEXes/wallets handle Token-2022 poorly.

Since the mint isn't created yet, this is a fork in the road worth choosing deliberately.

## Build scope (Option A)

- Config: `FEE_BPS` (default 100 = 1%) and `FEE_TREASURY_ADDRESS`, server-only, with the fee disabled if no treasury is set.
- Swap/acquire flow: build the buy transaction as `1% → treasury` + `99% → swap`, quote-locked with expiry.
- Cash-out flow: same split on the sell side.
- Ledger: a `fee_events` table recording leg (buy/sell), gross amount, fee amount, USD reference at execution, signature — so fees are auditable and never inferred.
- Verification: fees confirmed on-chain like tips are today; nothing recorded unless the chain confirms it.
- Disclosure: fee shown in the confirmation screen and in the terms page before the user signs.
- Tests: fee math at the base-unit level (no rounding leakage), fee-disabled path, and treasury-missing path.

## Note

The buy/sell (swap) path itself doesn't exist yet — it's the gated "BRUH token path" waiting on the mint. So this fee work naturally ships as part of building that path rather than as a separate patch.

## Decision — locked

**Option A (app-level fee).** The mint stays a standard SPL token; the 1% is collected by BRUH's own buy and cash-out flows into your treasury wallet. Two things still needed from you before the fee can go live: the **treasury wallet address** and the **BRUH mint** (the swap path is gated on it). The fee code can be built and tested ahead of both.

