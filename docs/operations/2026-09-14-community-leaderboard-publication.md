# Community leaderboard publication

Published from the original Crypto Companion Bot project to `bruh.tips` on 2026-09-14. Reviewed connected main revision: `7fdbb0712e677ffc0212b8e654f3ba50aac200d2`. Lovable's Publish changes action completed with **Your website was updated**; connected main remained unchanged afterward. This records the observed publication workflow, not an independent runtime commit attestation.

Implementation: [PR #61](https://github.com/systemreset-ca/bruhlegends/pull/61), merge `6ea951c79a5a3e4e56c55f18afe02bc513ee862a`. [Decision 0011](../decisions/0011-community-and-group-rankings.md) establishes Telegram-wide community rankings alongside per-group boards. Canonical Telegram accounts combine eligible activity across memberships. Group source attribution, administration and local rankings remain intact. Codex edited no website presentation files.

Cloud migration 0017 exactly matches the reviewed proposed aggregate SQL, excluding its outer transaction delimiters. Function owner is postgres, SECURITY DEFINER is true, search_path is pg_catalog; EXECUTE permits service_role and denies PUBLIC, anon and authenticated. No new tables, source-table grants, RLS relaxation or seed data. [Managed migration evidence](2026-09-14-community-leaderboard-migration.md) records the platform SQL-role restriction and successful service-reader invocation.

Validation: 148 managed tests in 28 files, TypeScript and production build passed. Public CI [34835248393](https://github.com/systemreset-ca/bruhlegends/actions/runs/34835248393) passed at the reviewed Cloud revision. The isolated PostgreSQL test proves one canonical account aggregates across two groups, with verified signature deduplication, privacy/exclusion rules, network/window separation and service-only access.

Actual service-side devnet results, limit 10: caller all/7d/30d counts are 1/1/1; tipper counts are 0/0/0. No qualifying verified public tip exists in that dataset. Independent post-publication requests returned site 200, app 200 and unauthenticated webhook POST 401.

Available bot selectors: `/community`, `/community tippers`, `/community callers 7d`, `/leaderboard global`; ordinary group `/leaderboard` remains local. An authenticated server loader supports future owner/Lovable presentation. Actual Telegram reply acceptance remains to be checked; HTTP status alone does not prove command delivery.

Remaining milestones in [issue #60](https://github.com/systemreset-ca/bruhlegends/issues/60): community group/token boards, own overall rank/pagination, explicit cross-post and anti-farming rules, account-wide privacy controls and scaling indexes/caching. This deployment does not activate wallet spending, swaps, rewards or mainnet. Proposed account-tip storage remains unapplied, and no live signing/broadcast caller exists.
