import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { before, after, beforeEach, afterEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// A new in-memory PostgreSQL instance, never a network or production database.
const db = new PGlite();
const root = new URL("../../", import.meta.url);
const migration = (path) => readFile(new URL(path, root), "utf8");
const group = "00000000-0000-4000-8000-000000000001";
const sender = "00000000-0000-4000-8000-000000000002";
const recipient = "00000000-0000-4000-8000-000000000003";
const intent = "00000000-0000-4000-8000-000000000004";
const otherIntent = "00000000-0000-4000-8000-000000000005";

before(
  async () => {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    );
    for (const file of [
      "supabase/migrations/20260809033130_768fc15d-33c4-4d3f-9d1b-79f705430b94.sql",
      "supabase/migrations/20260912064500_enforce_group_relationships.sql",
      "supabase/migrations/20260912190000_pin_tip_intent_network.sql",
      "supabase/migrations/20260912210000_atomic_tip_settlement.sql",
    ])
      await db.exec(await migration(file));
  },
  { timeout: 30_000 },
);
after(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("BEGIN");
  await db.query("INSERT INTO public.telegram_users(telegram_user_id) VALUES (1),(2)");
  await db.query("INSERT INTO public.groups(id,telegram_chat_id) VALUES ($1,-1)", [group]);
  await db.query(
    "INSERT INTO public.group_members(id,group_id,telegram_user_id) VALUES ($1,$3,1),($2,$3,2)",
    [sender, recipient, group],
  );
  await newIntent(intent, "ref");
});
afterEach(async () => {
  await db.exec("ROLLBACK");
  const result = await db.query(
    "SELECT (SELECT count(*) FROM tip_intents)::int AS intents, (SELECT count(*) FROM verified_transfers)::int AS receipts, (SELECT count(*) FROM audit_events)::int AS audits",
  );
  assert.deepEqual(result.rows[0], { intents: 0, receipts: 0, audits: 0 });
});

async function newIntent(id, reference) {
  await db.query(
    `INSERT INTO public.tip_intents
    (id,group_id,sender_membership_id,recipient_membership_id,recipient_address,
     asset_symbol,amount_base_units,amount_display,reference_key,expires_at)
    VALUES ($1,$2,$3,$4,'recipient','SOL',100,0.0000001,$5,clock_timestamp()+interval '1 hour')`,
    [id, group, sender, recipient, reference],
  );
}
async function settle(overrides = {}) {
  const values = {
    id: intent,
    network: "devnet",
    reference: "ref",
    recipient: "recipient",
    mint: null,
    amount: "100",
    signature: "signature",
    slot: 1,
    raw: null,
    ...overrides,
  };
  const result = await db.query(
    "SELECT * FROM public.settle_tip_intent($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    Object.values(values),
  );
  return result.rows[0];
}
async function state() {
  return (
    await db.query(
      `SELECT status::text,
    (SELECT count(*)::int FROM verified_transfers) AS receipts,
    (SELECT count(*)::int FROM audit_events) AS audits FROM tip_intents WHERE id=$1`,
      [intent],
    )
  ).rows[0];
}

test("settlement commits one receipt/status/audit and retries return the stored signature", async () => {
  assert.deepEqual(await settle(), { status: "confirmed", signature: "signature", reason: null });
  assert.deepEqual(await settle({ signature: "different" }), {
    status: "confirmed",
    signature: "signature",
    reason: null,
  });
  assert.deepEqual(await state(), { status: "confirmed", receipts: 1, audits: 1 });
});

test("one signature cannot credit a second intent", async () => {
  await settle();
  await newIntent(otherIntent, "other-ref");
  assert.equal(
    (await settle({ id: otherIntent, reference: "other-ref" })).reason,
    "receipt_conflict",
  );
  assert.equal(
    (await db.query("SELECT status::text FROM tip_intents WHERE id=$1", [otherIntent])).rows[0]
      .status,
    "created",
  );
  assert.deepEqual(await state(), { status: "confirmed", receipts: 1, audits: 1 });
});

for (const overrides of [
  { network: "mainnet-beta" },
  { reference: "other" },
  { recipient: "other" },
  { mint: "other" },
  { amount: "101" },
]) {
  test(`rejects changed ${Object.keys(overrides)[0]} snapshot`, async () => {
    assert.equal((await settle(overrides)).reason, "intent_snapshot_mismatch");
    assert.deepEqual(await state(), { status: "created", receipts: 0, audits: 0 });
  });
}

test("expiry records once and never creates a receipt", async () => {
  await db.query(
    "UPDATE tip_intents SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [intent],
  );
  assert.equal((await settle()).status, "expired");
  assert.equal((await settle({ signature: null })).status, "expired");
  assert.deepEqual(await state(), { status: "expired", receipts: 0, audits: 1 });
});

test("audit insert failure rolls back receipt and confirmation", async () => {
  await db.exec(
    "ALTER TABLE audit_events ADD CONSTRAINT test_audit_failure CHECK (event_type <> 'tip_confirmed'); SAVEPOINT attempt;",
  );
  await assert.rejects(settle(), /test_audit_failure/);
  await db.exec("ROLLBACK TO SAVEPOINT attempt");
  assert.deepEqual(await state(), { status: "created", receipts: 0, audits: 0 });
});

test("status write failure rolls back the receipt", async () => {
  await db.exec(
    "ALTER TABLE tip_intents ADD CONSTRAINT test_status_failure CHECK (status <> 'confirmed'); SAVEPOINT attempt;",
  );
  await assert.rejects(settle(), /test_status_failure/);
  await db.exec("ROLLBACK TO SAVEPOINT attempt");
  assert.deepEqual(await state(), { status: "created", receipts: 0, audits: 0 });
});

test("function grants deny clients and allow the controlled server role", async () => {
  const name = "public.settle_tip_intent(uuid,text,text,text,text,bigint,text,bigint,jsonb)";
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(
      (await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, name]))
        .rows[0].allowed,
      role === "service_role",
    );
  }
  await db.exec("SET LOCAL ROLE service_role");
  assert.equal((await settle()).status, "confirmed");
  await db.exec("RESET ROLE");
});

test("cancelled intents and unverified payments remain uncredited", async () => {
  assert.equal((await settle({ signature: null })).reason, "payment_not_verified");
  await db.query("UPDATE tip_intents SET status='cancelled' WHERE id=$1", [intent]);
  assert.equal((await settle()).reason, "intent_unavailable");
  assert.deepEqual(await state(), { status: "cancelled", receipts: 0, audits: 0 });
});
