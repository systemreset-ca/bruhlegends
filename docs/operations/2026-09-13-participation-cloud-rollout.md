# Participation Cloud rollout and public evidence

Date: 2026-09-13. Application publication is pending; this records schema/configuration and source checks, not live authenticated earning.

## Managed Cloud report and source review

Lovable reported the bounded migration applied and verified effective access for all four participation tables: RLS enabled with restrictive deny-client policies, no PUBLIC/anon/authenticated privileges, service_role SELECT only. Controlled RPCs allow service_role execution and deny client execution; trigger functions deny execution to all client roles and service_role. These are managed metadata checks, not independently executed fixture/concurrency exercises.

Reported counts: zero seasons, reviews, events, jobs, opt-outs and participation audit entries. No earning configuration or approval record was created. Fixture and multi-session tests were NOT RUN because the available owner-capable tool cannot guarantee rollback. PR #32 was not applied.

`BRUH_PARTICIPATION_STORAGE_ENABLED` was configured server-side. No network/mainnet flag changed. Only the existing `bruh-verify-tips` predicate was widened to include due pending participation jobs; pending-tip condition, endpoint, scheduler credential and two-minute cadence were preserved. Job count remains six. Managed five-minute idle observation: three predicate evaluations, zero failures and zero outbound HTTP requests. Database checks still consume existing scheduler work; this is not a claim of zero hosting cost.

GitHub resulting managed source is `b17d54c550a8fb4ef513953612bd9b1d61dac787` (managed commits `7d401f5` and `b17d54c`). Lovable reported a different platform-local revision; it is not the authoritative GitHub deployment SHA. Source review confirms only migration/journal/snapshot/generated types changed. `0014_participation_ledger.sql` became the managed tool's no-op placeholder after its filename collision. The applied SQL is in `0014_participation_ledger_managed.sql`, identical to the authoritative Supabase migration except final newline. Preserve both journal records; do not rewrite applied history.

Managed build/typecheck passed. Its test run initially passed 104/105: the inactive credits test depended on an unset environment flag. The follow-up PR explicitly isolates that fixture from production configuration. Do not publish a failing candidate or disable production storage merely to pass that test.

## Public repository and CI

The repository is PUBLIC. Independent anonymous HTTP requests to its GitHub page and raw main `AGENTS.md` returned 200. PR #39 preserved full history and added pinned, read-only source validation. [The actual first run](https://github.com/systemreset-ca/bruhlegends/actions/runs/34769901547) passed locked install, application tests/types/build, participation SQL tests and full-history secret scanning. It merged as `4f89f6d`; visibility itself is not proof of financial/security readiness.

## Tip-notification boundary

The follow-up moves points processing after confirmed-tip announcements and catches points-RPC outages. Financial sweep/announcement failures still propagate. Points outages return `participationAvailable: false` with null counts rather than fabricated zero work or sensitive diagnostics. Durable pending jobs remain available for a later existing conditional run; no extra scheduler/provider traffic is introduced. Two adversarial route tests verify notification-before-points ordering, sanitized outage results and successful counts.

Local validation: 107 tests across 17 files and production build passed for the boundary slice; strict TypeScript passed after managed types integration. Credits tests are also exercised with the external storage flag enabled. Exact submitted SHA, final CI and publication belong in the PR/release record. Existing framework deprecation/path-plugin/bundle advisories remain.
