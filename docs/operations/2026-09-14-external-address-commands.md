# Account wallet commands and external address registration

Original project only: `systemreset-ca/bruhlegends`, Lovable `e287f314-27c2-40bf-94f4-4685a95781fe`. This implements the owner's two-wallet-role clarification alongside decision 0010. Source implementation is complete; Cloud schema application and publication are pending.

Update: PR #56 merged at `73a12d3283127c919c238bdcad5ca2b289957764`. Cloud migration 0016 was subsequently applied, with generated types and [privilege/build evidence](2026-09-14-external-wallet-migration.md) committed at `e84c185c88b1ce8ff381d9de5be70965fbf54d09`. Codex reviewed the exact diff and main CI passed. Publication remains pending because browser control/reconnection/reload timed out. Earlier unapplied-schema statements below describe the initial source review. No new publication or live owner command verification is claimed.

## Behavior

- Private `/generate` creates or reuses the same internal account wallet as `/start`. Extra arguments are rejected.
- Private `/wallet add <public-address>` registers one external address candidate per Telegram account on devnet. `/wallet external` displays it. It neither creates an internal wallet nor imports external keys.
- Registration is explicitly **unverified**. It does not prove ownership, authorize withdrawals or override group-specific statistics. Repeating the same address is idempotent; replacement is unavailable until a separate ownership and secure-action flow exists.
- Existing `/wallet make/show` behavior remains. Spending, export, retirement, mainnet and rewards remain disabled.

## Storage and boundaries

`docs/proposed-external-wallet-schema.sql` is the reviewed schema proposal, not evidence of an applied Cloud migration. Candidate and registration-audit tables enforce RLS and FORCE RLS, with no direct table grants to anon/authenticated/service_role. Service-only functions read/register by server-verified Telegram identity; registration uses a transaction advisory lock and unique account/network constraint. Audit insertion is atomic. Mutation triggers prevent updates/deletions, including audit deletion. No verified-destination or withdrawal authority is stored.

Server validation requires a 32-byte base58 public address, rejects malformed input and 64-byte private-key-shaped values, and checks returned identity/network/status/address. Invalid input and database errors are not echoed. Format validation cannot establish ownership. These controls do not remove the previously documented Cloud platform BYPASSRLS or shared-worker trust exposure.

## Validation

Local command/service/link tests: **14 passed across 3 files**. TypeScript passed. Isolated PostgreSQL test passed: account isolation, repeat registration, replacement rejection, role grants, immutable candidate/audit history. This is a single-instance SQL test, not independent-session concurrency proof. Changed-file lint has zero errors and 29 pre-existing bot `any` warnings; whitespace check passed.

CI now runs the external-address SQL test with the existing database checks. Real owner Telegram command checks, Cloud privileges and exact published commit must be recorded after deployment. SAP, ownership challenges and funded tip settlement remain next work under issue #45; this change does not claim Trojan backend security parity.
