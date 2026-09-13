# Isolated participation database validation

From this directory, install the pinned dependency with `pnpm install --frozen-lockfile`, then run `pnpm test`. Or from the repository root: `node --test tools/db-validation/participation.pg.mjs`.

The tool is isolated from the application dependency graph. PGlite 0.3.14 runs the real baseline/group/network/participation SQL in a fresh in-memory PostgreSQL instance. Each test uses BEGIN/ROLLBACK and confirms the event table is empty afterward. No production connection, wallet, private key or RPC provider is used.

The `.pg.mjs` suffix keeps Node's database tests separate from Vitest discovery. PGlite has one connection, so this is transaction/constraint/permission validation, not competing-session concurrency evidence. Future full PostgreSQL/Cloud checks must be recorded independently.
