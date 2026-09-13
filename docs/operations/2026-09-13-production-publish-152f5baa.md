# Participation infrastructure publication

Date: 2026-09-13 (America/Toronto). Target: `https://bruh.tips`. Published application source: `152f5baa16f269871ebbebd521ff2fdf7760b1db`, merge of [PR #40](https://github.com/systemreset-ca/bruhlegends/pull/40). Previous application: `1d458ffcfdb8aff1b3b21aa8083bcb8253f85416`. Ledger implementation: PR #38; public validation: PR #39; managed schema source: `b17d54c550a8fb4ef513953612bd9b1d61dac787`.

## Evidence

- [Exact main CI](https://github.com/systemreset-ca/bruhlegends/actions/runs/34770302117) and [candidate CI](https://github.com/systemreset-ca/bruhlegends/actions/runs/34770237972) passed locked install, application tests/types/build, 20 participation SQL tests and redacted history scan.
- Local application suite passed 107 tests across 17 files, including with an externally enabled storage flag. Strict types, changed-file lint, production build and the isolated SQL suite passed. Managed-generated types were integrated without application conflicts.
- Lovable confirmed exact GitHub source, clean working tree, strict types/build and 107/107 tests with storage enabled. Codex inspected the preview's no-presale notice, inactive earning status, points disclosure and GitHub link. Unauthenticated Mini App remains gated to Telegram login.
- Under standing owner authorization, Codex clicked Publish and Publish changes for `bruh.tips`. Lovable displayed `Your website was updated`.
- Independent public homepage, `/token` and `/app` returned 200; `/token` retained no-presale and earning-off disclosures. Unauthenticated webhook POST returned 401. Remote main was the exact publication SHA after completion.

## Effective state and limits

[Cloud rollout report](2026-09-13-participation-cloud-rollout.md) records migration/journal, effective metadata access, server storage gate and existing predicate checks. Four participation tables exist, service writes require controlled RPCs, and zero seasons/awards were reported. Preserve the journaled no-op and managed migration; no applied history was rewritten.

The personal ledger read, export/opt-out integration and bounded database worker are deployed source. Their authenticated mobile/Telegram journeys are not yet live-verified. Points processing no longer blocks confirmed-tip announcements on an RPC outage. No earning weights, approval season, CHAD distribution, BRUH mint, airdrop, fees or mainnet activation is introduced. PR #32 remains separate and unapplied; multi-session settlement/ledger contention is NOT RUN. The controlled two-account wallet-signed devnet test remains necessary.

GitHub is public with anonymous access verified. Complete history, issues, PRs and passing workflows are visible; this does not certify financial readiness or guarantee token value. Public token-page copy still cautiously says public access is being prepared; update that wording in a separate presentation change rather than silently altering this verified release. Draft social/news posts remain unpublished.

Remaining activation gates are tracked in [issue #41](https://github.com/systemreset-ca/bruhlegends/issues/41). Use the [controlled devnet checklist](devnet-pilot-checklist.md) for owner-signed testing. No new secret, email, Helius account, paid commitment or scheduler cadence was needed.

## Rollback

Set the server storage gate false to disable participation reads/workers if necessary; keep earning seasons inactive. For application rollback, create reviewed revert commit(s) and publish their verified build. Do not drop the new tables, erase audit records, rewrite applied journals or revert generated types independently of their application compatibility.
