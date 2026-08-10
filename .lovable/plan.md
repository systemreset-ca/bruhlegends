# BRUH Mint Notes — feedback + where to store them

## My read on the advice

It is sound, and it agrees with the decision we already locked in.

- **Plain SPL, no Token-2022 transfer tax.** This is the same conclusion we reached when you approved Option A: the 1% service fee lives in BRUH's own buy/cash-out flow, not baked into the mint. Nothing in the app needs to change — the fee code already built (`FEE_BPS`, treasury, `fee_events` ledger) assumes a standard SPL mint.
- **6 decimals.** Matches how the fee math and tip amounts are already written (base-unit integers, floored fee). No code change needed either way, but 6 keeps the numbers legible.
- **Fixed supply, mint + freeze authority revoked.** Right call. Freeze authority in particular would undermine "non-custodial tipping" — a frozen recipient account turns a confirmed tip into a stuck tip.
- **One canonical BRUH/SOL CPMM, 0.25% fee tier.** Correct for tipping. A CLMM position drifting out of range would make the app's future "Acquire BRUH" step fail intermittently, which is worse than slightly less capital efficiency.
- **Liquidity depth over cosmetics.** The $2-pool example is the real warning. Before the token path goes live the app should be able to buy $100 without absurd impact, otherwise tipping is theatre.

### Two places I'd push back or add

1. **Split liquidity + Burn & Earn Fee Key.** Worth being explicit publicly: the Fee Key NFT is a revenue stream separate from the 1% service fee. Two income sources means two disclosures — the terms page currently discloses only the service fee.
2. **Spoof-mint defence is an app requirement, not a launch checklist item.** The app already gates on a single `BRUH_TOKEN_MINT` env value and a `supported_assets` row, so it structurally cannot accept a look-alike mint. Keep it that way; never let the mint be user-supplied.

### What the app still needs from the launch, in order

1. Official mint address → `BRUH_TOKEN_MINT`.
2. Canonical pool address (for quoting/routing sanity checks).
3. Flip the `supported_assets` BRUH row on.
4. Then the gated buy/cash-out swap path — the last unbuilt piece — can ship with the 1% fee already wired.

Legal point at the end of the notes stands: none of this technical structure substitutes for jurisdiction review.

## Where to save the text

1. **`docs/bruh-mint-launch-notes.md`** — the pasted notes stored verbatim in the repo, with a short header marking them as an external draft reference (not app spec, not instructions).
2. **A project memory** recording the locked decisions so future work never re-proposes a transfer tax or Token-2022 extension: plain SPL, 6 decimals, fixed supply, authorities revoked, no transfer tax/hook/permanent delegate, one BRUH/SOL CPMM at 0.25%, fee collected app-level only.

No application code, schema, or config changes in this step.
