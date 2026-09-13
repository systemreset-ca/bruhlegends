# Grassroots foundation publication

Date: 2026-09-13 (America/Toronto). Target: `https://bruh.tips`. Published application source: `1d458ffcfdb8aff1b3b21aa8083bcb8253f85416`, merge of [PR #35](https://github.com/systemreset-ca/bruhlegends/pull/35). Implementation source: `ede73a234fdf92fff44fe9a2898bb5147db5f5fc`. Previous recorded application release: `59fa4b0882948de1b73c827461656d283b58e580`.

## Evidence

- Lovable confirmed exact source checkout, clean tree, production build, strict TypeScript and 95 passing tests across 14 files. Local validation independently passed; see [foundation record](2026-09-13-grassroots-foundation.md).
- Codex inspected the preview token page: new cultural headline, no-presale notice, points-not-tokens disclosure, earning-off message, four-stage roadmap and unresolved mint/liquidity policy.
- Authorized operator clicked Publish and Publish changes in Lovable for configured `bruh.tips`. Lovable displayed `Your website was updated`.
- Independent public `/token` probe returned 200 and contained `TIP A BRUH.`, `No points are being awarded` and the no-presale notice.
- Public homepage returned 200; unauthenticated POST to `/api/public/telegram/webhook` returned 401.
- GitHub main remained the exact release SHA after publication.

## State and limitations

The new `/credits` command and Mini App tab are deployed source, but live Telegram command delivery and the authenticated mobile Credits journey are not verified. These show inactive preparation status, not a personal award balance. No ledger, points, rewards, mint, airdrop, fees or mainnet activation is included. PR #32's unapplied settlement function remains separate. No database/config/scheduler/webhook change was made by this release.

All five A–E GitHub milestones exist. [Roadmap issue #34](https://github.com/systemreset-ca/bruhlegends/issues/34) and [ledger issue #36](https://github.com/systemreset-ca/bruhlegends/issues/36) are under milestone A. Public repository visibility remains PRIVATE pending full-history/content review. Only `.env` key names were inspected; current names are Supabase project/URL/publishable configuration. This does not certify every historical value or other file as safe to publish.

Prepared community posts/news templates are committed drafts, not published social messages or scheduled automation. No new account, email, Helius key or paid commitment was needed.

## Rollback

Use a new revert commit for PR #35 and publish its verified application build. Preserve all prior commits and audit evidence. No database rollback is necessary. Token/mainnet earning gates remain off.
