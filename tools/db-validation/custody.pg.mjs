import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { before, after, beforeEach, afterEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const root = new URL("../../", import.meta.url);
const g = "00000000-0000-4000-8000-000000000001",
  a = "00000000-0000-4000-8000-000000000002",
  b = "00000000-0000-4000-8000-000000000003";
const wa = "00000000-0000-4000-8000-000000000004",
  wb = "00000000-0000-4000-8000-000000000005",
  r = "00000000-0000-4000-8000-000000000006";
const sig = "2".repeat(88),
  tipSig = "3".repeat(88);
before(
  async () => {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    );
    for (const path of [
      "supabase/migrations/20260809033130_768fc15d-33c4-4d3f-9d1b-79f705430b94.sql",
      "supabase/migrations/20260912064500_enforce_group_relationships.sql",
      "supabase/migrations/20260913210000_devnet_custody_core.sql",
      "supabase/migrations/20260913213000_devnet_custody_submission.sql",
    ])
      await db.exec(await readFile(new URL(path, root), "utf8"));
  },
  { timeout: 30000 },
);
after(() => db.close());
beforeEach(async () => {
  await db.exec("BEGIN; INSERT INTO telegram_users(telegram_user_id) VALUES(1),(2);");
  await db.query("INSERT INTO groups(id,telegram_chat_id) VALUES($1,-1)", [g]);
  await db.query(
    "INSERT INTO group_members(id,group_id,telegram_user_id) VALUES($1,$3,1),($2,$3,2)",
    [a, b, g],
  );
  await db.query(
    "INSERT INTO custody_accounts(id,group_id,membership_id,address,status) VALUES($1,$3,$4,$6,'active'),($2,$3,$5,$7,'active')",
    [wa, wb, g, a, b, "4".repeat(32), "5".repeat(32)],
  );
});
afterEach(async () => {
  await db.exec("ROLLBACK;");
  assert.equal((await db.query("SELECT count(*)::int n FROM custody_ledger")).rows[0].n, 0);
});
const deposit = (amount = 1000) =>
  db.query("SELECT credit_devnet_custody($1,$2,$3,1)", [wa, sig, amount]);
const reserve = (amount = 600, fee = 10, id = r) =>
  db.query("SELECT reserve_devnet_custody_tip($1,$2,$3,$4,$5,$6,$7)", [
    id,
    g,
    a,
    wa,
    wb,
    amount,
    fee,
  ]);
const settle = (fee = 5, signature = tipSig) =>
  db.query("SELECT settle_devnet_custody_tip($1,$2,$3,2)", [r, signature, fee]);
async function rejects(action, message) {
  await db.exec("SAVEPOINT expected_failure");
  try {
    await assert.rejects(action, message);
  } finally {
    await db.exec("ROLLBACK TO SAVEPOINT expected_failure; RELEASE SAVEPOINT expected_failure");
  }
}
const balances = () =>
  db.query("SELECT confirmed_lamports,reserved_lamports FROM custody_accounts WHERE id=$1", [wa]);

const prepareSubmission = (hash = "6".repeat(32)) =>
  db.query("SELECT prepare_devnet_custody_submission($1,$2,100,$3) chosen", [
    r,
    hash,
    "7".repeat(32),
  ]);
const syntheticSigned = {
  reservationId: r,
  network: "devnet",
  signature: tipSig,
  wireBase64: Buffer.alloc(100, 1).toString("base64"),
  lastValidBlockHeight: 100,
};
const persistSubmission = (record = syntheticSigned) =>
  db.query("SELECT persist_devnet_custody_signed($1,$2) chosen", [r, record]);
test("preparation preserves its first blockhash and exact reservation snapshot", async () => {
  await deposit();
  await reserve();
  const first = (await prepareSubmission()).rows[0].chosen;
  assert.equal(first.lamports, "600");
  assert.equal(first.feeCapLamports, "10");
  assert.equal(first.groupId, g);
  assert.equal(first.sender, "4".repeat(32));
  assert.deepEqual((await prepareSubmission("8".repeat(32))).rows[0].chosen, first);
  await rejects(
    () =>
      db.query("UPDATE custody_submission_snapshots SET approval='{}' WHERE reservation_id=$1", [
        r,
      ]),
    /Immutable/,
  );
});
test("signed bytes commit once; exact replay succeeds and replacement fails", async () => {
  await deposit();
  await reserve();
  await rejects(() => persistSubmission(), /Prepare/);
  await prepareSubmission();
  assert.deepEqual((await persistSubmission()).rows[0].chosen, syntheticSigned);
  assert.deepEqual((await persistSubmission()).rows[0].chosen, syntheticSigned);
  await rejects(
    () =>
      persistSubmission({
        ...syntheticSigned,
        wireBase64: Buffer.alloc(100, 2).toString("base64"),
      }),
    /conflict/,
  );
  await rejects(
    () => persistSubmission({ ...syntheticSigned, network: "mainnet-beta" }),
    /Invalid/,
  );
  await rejects(
    () => db.query("DELETE FROM custody_submission_snapshots WHERE reservation_id=$1", [r]),
    /Immutable/,
  );
  assert.equal((await balances()).rows[0].confirmed_lamports, 1000);
  assert.equal((await balances()).rows[0].reserved_lamports, 610);
});
test("signed settlement rejects unknown proof and accounts the matching receipt", async () => {
  await deposit();
  await reserve();
  await prepareSubmission();
  await rejects(
    () => db.query("SELECT settle_signed_devnet_custody($1,$2,5,2)", [r, tipSig]),
    /matching/,
  );
  await persistSubmission();
  await rejects(
    () => db.query("SELECT settle_signed_devnet_custody($1,$2,5,2)", [r, sig]),
    /matching/,
  );
  assert.equal(
    (await db.query("SELECT settle_signed_devnet_custody($1,$2,5,2) done", [r, tipSig])).rows[0]
      .done,
    true,
  );
  assert.equal((await balances()).rows[0].confirmed_lamports, 395);
});
test("outbox grants deny client writes and all existing-role RPC execution", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(
      (
        await db.query(
          "SELECT has_table_privilege($1,'custody_submission_snapshots','INSERT,UPDATE,DELETE') allowed",
          [role],
        )
      ).rows[0].allowed,
      false,
    );
    for (const rpc of [
      "prepare_devnet_custody_submission(uuid,text,bigint,text)",
      "persist_devnet_custody_signed(uuid,jsonb)",
      "settle_signed_devnet_custody(uuid,text,bigint,bigint)",
    ])
      assert.equal(
        (await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') allowed", [role, rpc]))
          .rows[0].allowed,
        false,
      );
  }
});
test("confirmed deposits are idempotent, conflicting proofs are rejected", async () => {
  assert.equal((await deposit()).rows[0].credit_devnet_custody, true);
  assert.equal((await deposit()).rows[0].credit_devnet_custody, false);
  await rejects(() => deposit(1001), /conflict/);
  assert.equal((await balances()).rows[0].confirmed_lamports, 1000);
});
test("pending/no deposit provides no spendable balance", async () => {
  await rejects(() => reserve(), /Insufficient/);
});
test("reservations include fee caps and prevent aggregate overspending", async () => {
  await deposit();
  await reserve();
  assert.equal((await balances()).rows[0].reserved_lamports, 610);
  await rejects(() => reserve(400, 10, "00000000-0000-4000-8000-000000000007"), /Insufficient/);
  assert.equal((await db.query("SELECT count(*)::int n FROM custody_reservations")).rows[0].n, 1);
});
test("reservation retries cannot reserve twice or change the destination/amount", async () => {
  await deposit();
  await reserve();
  await reserve();
  assert.equal((await balances()).rows[0].reserved_lamports, 610);
  await rejects(() => reserve(601), /replay conflict/);
});
test("settlement conserves tip funds, debits actual fee and releases fee headroom", async () => {
  await deposit();
  await reserve();
  await settle();
  assert.deepEqual((await balances()).rows[0], { confirmed_lamports: 395, reserved_lamports: 0 });
  assert.equal(
    (await db.query("SELECT confirmed_lamports FROM custody_accounts WHERE id=$1", [wb])).rows[0]
      .confirmed_lamports,
    600,
  );
  assert.equal((await settle()).rows[0].settle_devnet_custody_tip, false);
  assert.equal((await db.query("SELECT count(*)::int n FROM custody_ledger")).rows[0].n, 4);
  await rejects(() => settle(6), /replay conflict/);
});
test("over-cap fee cannot settle or release reserved balance", async () => {
  await deposit();
  await reserve();
  await rejects(() => settle(11), /Invalid/);
  assert.deepEqual((await balances()).rows[0], {
    confirmed_lamports: 1000,
    reserved_lamports: 610,
  });
});
test("foreign identity, banned membership and frozen accounts cannot reserve", async () => {
  await deposit();
  await rejects(
    () => db.query("SELECT reserve_devnet_custody_tip($1,$2,$3,$4,$5,1,1)", [r, g, b, wa, wb]),
    /Foreign/,
  );
  await db.query("UPDATE group_members SET is_banned=true WHERE id=$1", [a]);
  await rejects(() => reserve(), /unavailable/);
  await db.query("UPDATE group_members SET is_banned=false WHERE id=$1", [a]);
  await db.query("UPDATE custody_accounts SET status='frozen' WHERE id=$1", [wa]);
  await rejects(() => reserve(), /unavailable/);
});
test("self tips and negative or unbounded requests are rejected", async () => {
  await deposit();
  await rejects(() => reserve(-1), /Invalid/);
  await rejects(() => reserve(1, 1000001), /Invalid/);
  await rejects(
    () => db.query("SELECT reserve_devnet_custody_tip($1,$2,$3,$4,$4,1,1)", [r, g, a, wa]),
    /Invalid/,
  );
});
test("a settled internal tip cannot also be credited as an external deposit", async () => {
  await deposit();
  await reserve();
  await settle();
  await rejects(
    () => db.query("SELECT credit_devnet_custody($1,$2,600,2)", [wb, tipSig]),
    /Internal/,
  );
});
test("audit failure rolls back balances and receipts with the transaction", async () => {
  await db.exec(
    "CREATE FUNCTION fail_custody_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced audit failure'; END $$; CREATE TRIGGER fail_custody_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_custody_audit();",
  );
  await rejects(() => deposit(), /forced audit failure/);
  assert.equal((await balances()).rows[0].confirmed_lamports, 0);
  assert.equal((await db.query("SELECT count(*)::int n FROM custody_ledger")).rows[0].n, 0);
});
test("history cannot be rewritten and clients/service cannot read encrypted keys", async () => {
  await deposit();
  await rejects(() => db.exec("DELETE FROM custody_ledger"), /append-only/);
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(
      (
        await db.query("SELECT has_table_privilege($1,'custody_key_envelopes','SELECT') allowed", [
          role,
        ])
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await db.query(
          "SELECT has_function_privilege($1,'reserve_devnet_custody_tip(uuid,uuid,uuid,uuid,uuid,bigint,bigint)','EXECUTE') allowed",
          [role],
        )
      ).rows[0].allowed,
      false,
    );
  }
  for (const table of ["custody_accounts", "custody_reservations", "custody_ledger"]) {
    assert.equal(
      (await db.query("SELECT relrowsecurity FROM pg_class WHERE relname=$1", [table])).rows[0]
        .relrowsecurity,
      true,
    );
    assert.equal(
      (
        await db.query(
          "SELECT has_table_privilege('service_role',$1,'INSERT,UPDATE,DELETE') allowed",
          [table],
        )
      ).rows[0].allowed,
      false,
    );
  }
});
test("mainnet accounting is structurally forbidden", async () => {
  await rejects(
    () => db.query("UPDATE custody_accounts SET network='mainnet-beta' WHERE id=$1", [wa]),
    /check constraint/,
  );
});

test("provisioning binds ciphertext metadata, starts frozen and preserves its first identity", async () => {
  await db.query("DELETE FROM custody_accounts WHERE id=$1", [wa]);
  const envelope = {
    walletId: wa,
    groupId: g,
    membershipId: a,
    network: "devnet",
    version: 1,
    address: "4".repeat(32),
    wrappingKeyVersion: "synthetic-test-v1",
    seedIv: "synthetic",
    encryptedSeed: "synthetic",
    wrappingIv: "synthetic",
    wrappedDataKey: "synthetic",
  };
  const provision = (payload) =>
    db.query("SELECT provision_devnet_custody($1,$2,$3,$4,$5)", [
      wa,
      g,
      a,
      envelope.address,
      payload,
    ]);
  await rejects(() => provision({ ...envelope, groupId: b }), /Invalid custody envelope/);
  await rejects(
    () => provision({ ...envelope, rawPrivateKey: "synthetic-not-a-key" }),
    /Invalid custody envelope/,
  );
  assert.equal((await provision(envelope)).rows[0].provision_devnet_custody, wa);
  assert.equal((await provision(envelope)).rows[0].provision_devnet_custody, wa);
  assert.equal(
    (await db.query("SELECT status FROM custody_accounts WHERE id=$1", [wa])).rows[0].status,
    "frozen",
  );
  assert.equal((await db.query("SELECT count(*)::int n FROM custody_key_envelopes")).rows[0].n, 1);
});

test("expired reservations retain funds until an actual verified settlement, not a timer release", async () => {
  await deposit();
  await reserve();
  await db.query(
    "UPDATE custody_reservations SET expires_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
    [r],
  );
  assert.equal((await balances()).rows[0].reserved_lamports, 610);
  await settle();
  assert.equal((await balances()).rows[0].reserved_lamports, 0);
});
