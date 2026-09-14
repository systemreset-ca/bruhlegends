# Finalized account-tip history and community credit

Status: applied as managed migration `drizzle/migrations/0020_bruh_account_tip_credit.sql`; see `docs/operations/2026-09-14-account-tip-credit-migration.md`.

The service-only `bruh_account_tip_finalize_credit` atomically finalizes a server-verified account SOL tip and inserts one exact native-SOL fact into existing `tip_intents` and `verified_transfers`. Attribution resolves the original Telegram chat and both canonical memberships without using external wallet candidates. Lamports remain exact SQL integers/numerics; display division introduces no JavaScript rounding or fabricated USD price. Reference, recipient, signature, slot and fee come from the frozen intent and finalized receipt. An append-only credit audit links source and legacy IDs.

Unsigned, wrong-owner, wrong-slot/fee and colliding legacy records are rejected. Repeated credit returns the same result without another receipt. Failed history/audit insertion rolls back finalization and retains the signed reservation. After this migration service-role access to the foundation finalizer is revoked; the receipt verifier calls only the credit wrapper. Original source-table protections remain unchanged.

The new audit has forced RLS, denied public/anon/authenticated/service-role direct privileges and an immutable trigger. Controlled service-only RPC uses SECURITY DEFINER and pg_catalog search_path. Shared postgres/platform BYPASSRLS trust remains a limitation.

Actual disposable PostgreSQL validates the credit function and actual community SQL: one confirmed tip produces exactly one sender tipper row and recipient contribution; retry cannot double count. Forgotten membership filtering removes its public projection while history remains immutable. Forced audit failure rolls back both legacy rows and finalization. Application tests verify exact receipt matching before credit.

Apply `docs/proposed-account-tip-credit.sql` after managed authorization migration 0019 as the next new migration. Network/signing gates remain false until private Telegram approval and a funded pilot are verified. No mainnet, CHAD reward, BRUH swap, export/withdrawal/retirement or website marketing changes.
