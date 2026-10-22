# Service-role Data API compatibility migration

## Scope
Create and apply one new migration with a short explanatory comment and exactly the 22 additive GRANT statements supplied in your request. This records explicit server-only access for fresh database recreation ahead of the October 30 Data API default change.

No old migrations, application code, tables, policies, anon/authenticated grants, secrets, wallet data or deployment will change.

## Technical details
- Use the existing managed migration tool, which timestamps the journal entry and assigns the next sequential filename. Include `20261022` in the descriptive name so the file is date-identifiable without changing this project's migration convention.
- Submit your SQL verbatim, preceded only by a short explanatory SQL comment.
- Verify the generated SQL matches the requested statements and confirm the live service_role privileges for all 22 tables through a read-only catalog query.
- Report the exact migration path and whether it applied successfully. Do not publish.

## Approval
Await your explicit **Plan Approved** before creating or applying the migration.