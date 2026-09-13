# Public-history preparation and automation

Date: 2026-09-13. Scope: owner-requested auditable GitHub history. Repository visibility verification/publication is recorded separately; this preparation record alone does not prove public access.

## Review evidence

- Fetched all available remote refs; repository is not shallow.
- Checksum-verified official Gitleaks 8.30.1 scanned 229 commits and approximately 1.31 MB of Git patch content, with 100% redaction and inline allow comments ignored.
- Four generic-api-key candidates were reviewed at their exact historical commits without printing values: two occurrences of the synthetic scheduler test constant and two intentionally browser-usable `sb_publishable_` Supabase keys under `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Exact fingerprints are retained in `.gitleaksignore`. No broad filename/rule exclusion is added; new credentials at another commit/line remain detectable. This acknowledges the findings rather than rewriting history.
- No privileged credential was identified by this scan. Inspected current README/coordination records and historical locations of CSV exports, key/certificate files and ZIP archives; no such historical files were found. Source describes schemas, configuration names and sanitized evidence, not copied user database exports. Public project identifiers and owner-authored strategy remain part of the requested record.

This is automated credential detection plus targeted content review, not a guarantee that every possible secret/PII pattern is detected, not a security certification, and not a substitute for mainnet review. Binary assets are not meaningfully audited by Git patch scanning. Never publish database dumps, personal Telegram records, secret-bearing RPC URLs or actual private keys.

## Public CI

The source-validation workflow uses read-only permissions, no retained checkout credentials, SHA-pinned official actions, Node 24.19.0, Bun 1.4.2, locked application dependencies and isolated pinned PostgreSQL tooling. It runs application tests/types/build, actual participation SQL tests and a checksum-verified redacted history scan. No bot messages, Solana transfers, deployment credentials or provider calls are required. A test run is not live-user or multi-session evidence.

Private-repository jobs are skipped; only public-repository events run validation. Concurrency cancellation and a 15-minute limit bound duplicate/stalled runs. No schedule or automatic deployment is configured. CI status is pending until an actual GitHub run passes; do not infer it from this file.

Preserve the private/local history and all published commits. If later findings require rotation, rotate credentials and document the correction; do not erase audit history or claim that a scan proves legitimacy.
