# Production publish — 2026-09-12

- Published commit: `870cef379e8cf7136f969ccbef546291e855f3b5`
- Lovable project: `e287f314-27c2-40bf-94f4-4685a95781fe`
- Production domain: `https://bruh.tips`
- Authorization: explicit owner confirmation in the Codex task

Lovable showed the synchronized GitHub PR #11 merge as the latest project revision before publishing. Its publish flow completed with `Your website was updated`, then reported the project as published and up to date. A fresh browser load of `https://bruh.tips/` succeeded and rendered the BRUH Legends homepage with internal routes and the `@BRUHLegendsBot` link.

This check verifies public homepage availability after the release. It does not prove production database binding or complete Telegram, market-provider, Mini App and Solana flows.

## Post-publish security scan

Lovable's basic scan reported seven warnings for sensitive identity, session, wallet, tip and swap tables having no explicit access policies. The committed migrations enable RLS on these tables and explicitly grant access to `service_role`; a table with RLS enabled and no applicable policy denies ordinary client access by default. The bulk auto-fix was not run because it could add inappropriate client-facing policies to deliberately server-only tables.

Next security step: query the connected database's effective privileges and RLS state for every flagged table, verify that `anon` and `authenticated` have no usable access, then either document intentional server-only deny-by-default treatment or add narrowly scoped policies where a real user-reachable path requires them.
