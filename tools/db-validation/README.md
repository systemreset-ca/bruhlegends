# Disposable PostgreSQL settlement tests

From the repository root:

```sh
pnpm --dir tools/db-validation install --frozen-lockfile
node --test tools/db-validation/settlement.test.mjs
```

The root `test:db` script runs the same tests. The dependency is isolated here so the product's Bun lockfile and client bundle do not acquire a PostgreSQL test runtime. The nested lockfile pins the test dependency.

Each run creates an in-memory PGlite PostgreSQL instance without credentials or network connections. Tests load the committed initial schema, group-relationship constraints, network-pinning migration, and proposed settlement function. Every test rolls back synthetic fixtures and checks zero intent/receipt/audit residue. This is targeted PostgreSQL function validation, not a full migration-chain, Cloud configuration, RLS audit, or live transfer test.

PGlite has one exclusive connection, so these tests cannot validate competing database sessions or lock waits. Run the concurrency cases in the settlement decision record against a disposable full PostgreSQL database before real-funds readiness is considered.
