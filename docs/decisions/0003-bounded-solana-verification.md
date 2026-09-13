# Bounded Solana verification

Date: 2026-09-12.
Status: source implemented; live provider and deployment checks pending.
Owner: Codex engineering.
Requirement: the original BRUH plan Phase 4 requires a confirmed transaction matching recipient, mint, amount and unique reference.

## Behavior

The server now checks the reference in the fetched transaction's account keys as well as looking up signatures by that reference. Both RPC requests explicitly use confirmed commitment. Solana's [getSignaturesForAddress documentation](https://solana.com/docs/rpc/http/getsignaturesforaddress) describes signatures for transactions containing the queried address in their account-key list; the explicit second check protects against inconsistent responses.

SPL verification sums every balance record for the recipient and expected mint, so multiple token accounts cannot hide an additional credit or loss. SOL verification rejects missing balances and values outside JavaScript's safe integer range instead of substituting zero or accepting rounded amounts. This conservative rule may leave a valid transfer involving unusually large balances pending; it must not falsely confirm one.

Each request times out after eight seconds. Reference verification has a shared fifteen-second deadline and processes at most ten candidate signatures, enforcing the cap locally. Thus one verification uses at most eleven RPC calls (one signature lookup plus ten transaction lookups), usually two for the normal single-payment path. HTTP 429, HTTP failure, provider error and network failure cause no automatic retries. Existing conditional scheduler predicates remain unchanged. This is a per-verification bound, not a global account quota or a guarantee of a provider bill; aggregate sweep/user traffic still requires measured load validation.

Provider response bodies, JSON-RPC messages, raw fetch exceptions and configured endpoint URLs are not logged or propagated. Error responses expose a generic failure classification or HTTP status. No credential, schema, scheduler cadence, network selection, signing path, asset allowlist or tokenomics changes.

## Validation and release

Adversarial tests cover missing reference, a later valid candidate, an oversized signature list, nonpositive amounts, no retry on 429/503, timeout cancellation, safe error messages, malformed envelopes, multiple SPL accounts and missing/unsafe SOL balances. Strict TypeScript, focused lint and production build pass.

The independent atomic-settlement change remains in PR #32; this verifier change does not establish atomic database behavior. Before real funds, complete the owner-signed devnet test and security review. Production is unchanged until a separately recorded publish. No live-provider performance, end-to-end transfer, total-cost or mainnet-readiness claim is made here.
