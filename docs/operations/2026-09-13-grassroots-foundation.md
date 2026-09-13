# Grassroots foundation — source validation, not deployment

Date: 2026-09-13. Base: `275a60e9d892581b0476ada2d6d8739dfa1f6b28`. Branch: `codex/grassroots-participation`. Tracking: [issue #34](https://github.com/systemreset-ca/bruhlegends/issues/34). Exact submitted and merge SHAs are available from the linked PR/Git history; this file does not claim publication.

## Result

Accepted the owner-approved no-presale direction into the operating plan, decision record, Work brief and A–E milestones. Added a changelog, implementation issue/PR templates, release-evidence template and prepared community/news drafts. Added inactive bot `/credits` and Mini App Credits tab. Replaced outdated token-page locked-parameter and fee claims with readiness stages and disclosures.

No ledger, points, token, CHAD payout, treasury signing, fee or mainnet feature is enabled. No new schema, Cloud migration, account or credential is required. The atomic settlement proposal remains separate in PR #32 and is not included in this branch.

## Validation

- Application tests: 95 passed across 14 files, including three new bot command tests.
- Strict TypeScript: passed.
- Changed-file ESLint: zero errors. Existing `any` warnings remain in bot/app modules.
- Production build: passed. Existing TanStack `inputValidator` deprecation, path-plugin and large-bundle warnings remain.
- Diff whitespace check: passed.
- Cloud changes, deployed bot command and authenticated mobile Credits walkthrough: not run.
- Public repository history/credential audit: not complete. GitHub CLI reports PRIVATE; `.env` is tracked. Inspect/scan history before changing visibility; do not expose values in reports.

## Rollback and next slice

Revert the PR through a new commit if needed; do not rewrite published history. No database rollback is needed. The source rollback removes inactive surfaces and restores prior copy; it does not delete user data.

Next: implement the append-only ledger, atomic source uniqueness/caps and group-scoped reads, including export/anonymization. Obtain approved earning rules before activation. Complete two-account devnet transaction and outstanding settlement validation before mainnet. Public GitHub publication requires a separate completed content/history review.
