import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { before, after, beforeEach, afterEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const root = new URL("../../", import.meta.url);
const g = "00000000-0000-4000-8000-000000000001";
const a = "00000000-0000-4000-8000-000000000002";
const b = "00000000-0000-4000-8000-000000000003";
const reviewer = "00000000-0000-4000-8000-000000000004";
const tip = "00000000-0000-4000-8000-000000000005";
const weights = {
  tip_sent: 5,
  tip_received: 5,
  active_day: 2,
  legitimate_call: 3,
  group_referral: 4,
  tester_bonus: 3,
};
let season;

before(
  async () => {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    );
    for (const path of [
      "supabase/migrations/20260809033130_768fc15d-33c4-4d3f-9d1b-79f705430b94.sql",
      "supabase/migrations/20260912064500_enforce_group_relationships.sql",
      "supabase/migrations/20260912190000_pin_tip_intent_network.sql",
      "supabase/migrations/20260913140000_participation_ledger.sql",
    ])
      await db.exec(await readFile(new URL(path, root), "utf8"));
  },
  { timeout: 30000 },
);
after(async () => db.close());
beforeEach(async () => {
  await db.exec("BEGIN;");
  await db.exec("INSERT INTO telegram_users(telegram_user_id) VALUES(1),(2),(3)");
  await db.query("INSERT INTO groups(id,telegram_chat_id) VALUES($1,-1)", [g]);
  await db.query(
    "INSERT INTO group_members(id,group_id,telegram_user_id,role) VALUES($1,$4,1,'member'),($2,$4,2,'member'),($3,$4,3,'admin')",
    [a, b, reviewer, g],
  );
});
afterEach(async () => {
  await db.exec("ROLLBACK;");
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM participation_events")).rows[0].n,
    0,
  );
});
async function campaign(overrides = {}) {
  const cfg = {
    network: "mainnet-beta",
    approval: "test-only-approved-rules",
    daily: 20,
    member: 100,
    pair: 10,
    budget: 100,
    tester: 3,
    weights,
    ...overrides,
  };
  const result = await db.query(
    "SELECT create_participation_season($1,'Test','v1',$2,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 day',$3,$4,$5,$6,$7,$8,$9) AS id",
    [
      g,
      cfg.network,
      cfg.weights,
      cfg.daily,
      cfg.member,
      cfg.pair,
      cfg.budget,
      cfg.tester,
      cfg.approval,
    ],
  );
  season = result.rows[0].id;
  return season;
}
async function activate() {
  await db.query("SELECT set_participation_season_status($1,'active')", [season]);
}
async function payment(id = tip, ref = "ref", network = "mainnet-beta") {
  await db.query(
    "INSERT INTO tip_intents(id,group_id,sender_membership_id,recipient_membership_id,recipient_address,asset_symbol,amount_base_units,amount_display,reference_key,expires_at,status,network) VALUES($1,$2,$3,$4,'recipient','SOL',100,0.0000001,$5,clock_timestamp()+interval '1 hour','confirmed',$6)",
    [id, g, a, b, ref, network],
  );
  await db.query(
    "INSERT INTO verified_transfers(tip_intent_id,signature,slot,recipient_address,amount_base_units) VALUES($1,$2,1,'recipient',100)",
    [id, ref],
  );
}
async function award(kind = "tip_sent", member = a, source = tip) {
  return (
    await db.query("SELECT (award_participation($1,$2,$3,$4)).*", [season, member, kind, source])
  ).rows[0];
}
async function expectFailure(action, message) {
  await db.exec("SAVEPOINT expected_failure");
  await assert.rejects(action, message);
  await db.exec("ROLLBACK TO SAVEPOINT expected_failure; RELEASE SAVEPOINT expected_failure");
}

test("starts draft, rejects earning and refuses activation without approved rules", async () => {
  await campaign({ approval: null });
  await expectFailure(() => award(), /earning disabled/);
  await expectFailure(activate, /approved earning rules required/);
});
test("rejects malformed or fractional earning rules", async () => {
  await expectFailure(
    () => campaign({ weights: { ...weights, tip_sent: -1 } }),
    /invalid earning weights/,
  );
  await expectFailure(
    () => campaign({ weights: { ...weights, tip_sent: 1.5 } }),
    /invalid earning weights/,
  );
  await expectFailure(
    () => campaign({ weights: { ...weights, extra: 1 } }),
    /invalid earning weights/,
  );
});
test("confirmed receipt awards once and retries return the same audited event", async () => {
  await campaign();
  await activate();
  await payment();
  const first = await award();
  const repeat = await award();
  assert.equal(first.status, "awarded");
  assert.equal(first.points, 5);
  assert.equal(repeat.id, first.id);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM participation_events")).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM audit_events WHERE event_type='participation_recorded'",
      )
    ).rows[0].n,
    1,
  );
});
test("missing/mismatched receipt, wrong beneficiary and wrong network cannot award", async () => {
  await campaign();
  await activate();
  await payment();
  await db.query("UPDATE verified_transfers SET amount_base_units=101 WHERE tip_intent_id=$1", [
    tip,
  ]);
  await expectFailure(() => award(), /matching verified receipt/);
  await expectFailure(() => award("tip_sent", b), /eligible confirmed tip/);
  await db.query("UPDATE tip_intents SET network='devnet' WHERE id=$1", [tip]);
  await expectFailure(() => award(), /eligible confirmed tip/);
});
test("unconfirmed and devnet tip volume cannot generate allocation points", async () => {
  await campaign({ network: "devnet" });
  await activate();
  await payment(tip, "ref", "devnet");
  await expectFailure(() => award(), /eligible confirmed tip/);
  await db.query("UPDATE tip_intents SET status='awaiting_payment' WHERE id=$1", [tip]);
  await expectFailure(() => award(), /eligible confirmed tip/);
});
test("caps serialize into held events; retries cannot create extra capacity", async () => {
  await campaign({ daily: 5 });
  await activate();
  await payment();
  assert.equal((await award()).points, 5);
  const held = await award("active_day");
  assert.equal(held.status, "held");
  assert.equal(held.reason_code, "daily_cap");
  assert.equal(held.points, 0);
  assert.equal((await award("active_day")).id, held.id);
});
test("active days deduplicate across separate tips on the same UTC date", async () => {
  await campaign();
  await activate();
  await payment();
  const first = await award("active_day");
  const next = "00000000-0000-4000-8000-000000000006";
  await payment(next, "next");
  assert.equal((await award("active_day", a, next)).id, first.id);
});
test("pair and total-budget caps cannot be bypassed by recipient awards", async () => {
  await campaign({ pair: 5, budget: 8 });
  await activate();
  await payment();
  await award();
  assert.equal((await award("active_day")).reason_code, "pair_cap");
  assert.equal((await award("tip_received", b)).reason_code, "season_budget");
});
test("member season cap applies independently of daily cap", async () => {
  await campaign({ member: 5 });
  await activate();
  await payment();
  await award();
  assert.equal((await award("active_day")).reason_code, "member_cap");
});
test("reversals append once, never rewrite history or restore gross earning capacity", async () => {
  await campaign({ daily: 5 });
  await activate();
  await payment();
  const first = await award();
  const request = "00000000-0000-4000-8000-000000000010";
  const reverse = async () =>
    (
      await db.query("SELECT (reverse_participation($1,$2,$3,'invalidated')).*", [
        first.id,
        reviewer,
        request,
      ])
    ).rows[0];
  const r = await reverse();
  assert.equal(r.points, -5);
  assert.equal((await reverse()).id, r.id);
  assert.equal(
    (await db.query("SELECT participation_member_total($1,$2)::int AS n", [g, a])).rows[0].n,
    0,
  );
  assert.equal((await award("active_day")).reason_code, "daily_cap");
  await expectFailure(
    () => db.query("UPDATE participation_events SET points=100 WHERE id=$1", [first.id]),
    /immutable/,
  );
  await expectFailure(
    () => db.query("DELETE FROM participation_events WHERE id=$1", [first.id]),
    /immutable/,
  );
});
test("only independent group reviewers can attest bounded tester recognition", async () => {
  await campaign({ network: "devnet" });
  await activate();
  const evidence = "00000000-0000-4000-8000-000000000020";
  await expectFailure(
    () =>
      db.query("SELECT review_participation_activity($1,$2,'tester_bonus',$3,$2)", [
        season,
        a,
        evidence,
      ]),
    /independent group reviewer/,
  );
  const review = (
    await db.query("SELECT review_participation_activity($1,$2,'tester_bonus',$3,$4) AS id", [
      season,
      a,
      evidence,
      reviewer,
    ])
  ).rows[0].id;
  assert.equal((await award("tester_bonus", a, review)).points, 3);
  const second = (
    await db.query(
      "SELECT review_participation_activity($1,$2,'tester_bonus',gen_random_uuid(),$3) AS id",
      [season, a, reviewer],
    )
  ).rows[0].id;
  assert.equal((await award("tester_bonus", a, second)).reason_code, "tester_cap");
});
test("opted-out, banned and foreign memberships cannot earn", async () => {
  await campaign();
  await activate();
  await payment();
  await db.query("UPDATE group_members SET participation_opt_out=true WHERE id=$1", [a]);
  await expectFailure(() => award(), /eligible group membership/);
  await db.query(
    "UPDATE group_members SET participation_opt_out=false,is_banned=true WHERE id=$1",
    [a],
  );
  await expectFailure(() => award(), /eligible group membership/);
  await expectFailure(
    () => award("tip_sent", "00000000-0000-4000-8000-000000000099"),
    /eligible group membership/,
  );
});
test("same verified wallet is excluded even during its replacement cutoff", async () => {
  await campaign();
  await activate();
  await payment();
  await db.query(
    "INSERT INTO wallets(membership_id,address,status,replaced_at) VALUES($1,'same','verified',clock_timestamp()+interval '30 minutes'),($2,'same','verified',NULL)",
    [a, b],
  );
  await expectFailure(() => award(), /self recognition excluded/);
});
test("clients have no privileges and service writes require controlled functions", async () => {
  const acl = (
    await db.query(
      "SELECT has_table_privilege('anon','participation_events','SELECT') AS anon, has_table_privilege('authenticated','participation_events','INSERT') AS client, has_table_privilege('service_role','participation_events','INSERT') AS direct_write, has_table_privilege('service_role','participation_events','SELECT') AS service_read, has_function_privilege('anon','public.award_participation(uuid,uuid,text,uuid)','EXECUTE') AS public_call, has_function_privilege('service_role','public.award_participation(uuid,uuid,text,uuid)','EXECUTE') AS service_call",
    )
  ).rows[0];
  assert.deepEqual(acl, {
    anon: false,
    client: false,
    direct_write: false,
    service_read: true,
    public_call: false,
    service_call: true,
  });
  await campaign();
  await activate();
  await payment();
  await db.exec("SET LOCAL ROLE service_role");
  assert.equal((await award()).points, 5);
  await db.exec("RESET ROLE");
});
test("forced audit failure rolls back the award with its entire transaction", async () => {
  await campaign();
  await activate();
  await payment();
  await db.exec(
    "CREATE FUNCTION test_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='participation_recorded' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER test_fail BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION test_audit_fail();",
  );
  await expectFailure(() => award(), /forced audit failure/);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM participation_events")).rows[0].n,
    0,
  );
});
test("immutable rule configuration and terminal close prevent silent changes", async () => {
  await campaign();
  await activate();
  await expectFailure(
    () => db.query("UPDATE participation_seasons SET season_budget=1000 WHERE id=$1", [season]),
    /immutable/,
  );
  await db.query("SELECT set_participation_season_status($1,'closed')", [season]);
  await expectFailure(activate, /invalid season transition/);
});

test("receipt/status triggers queue a single job; bounded worker awards both users once", async () => {
  await campaign();
  await activate();
  await payment();
  await db.query("UPDATE tip_intents SET status='confirmed' WHERE id=$1", [tip]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM participation_jobs")).rows[0].n, 1);
  await db.exec("SET LOCAL ROLE service_role");
  const run = (await db.query("SELECT process_participation_jobs(20) AS r")).rows[0].r;
  assert.deepEqual(run, { processed: 1, failed: 0 });
  assert.deepEqual((await db.query("SELECT process_participation_jobs(20) AS r")).rows[0].r, {
    processed: 0,
    failed: 0,
  });
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM participation_events")).rows[0].n,
    4,
  );
  await db.exec("RESET ROLE");
});
test("worker failures roll back partial awards and retry only five times", async () => {
  await campaign();
  await activate();
  await payment();
  await db.exec(
    "CREATE FUNCTION test_job_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='participation_recorded' THEN RAISE EXCEPTION 'not logged secret'; END IF; RETURN NEW; END; $$; CREATE TRIGGER test_job_fail BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION test_job_audit_fail();",
  );
  for (let attempt = 1; attempt <= 5; attempt++) {
    const r = (await db.query("SELECT process_participation_jobs(20) AS r")).rows[0].r;
    assert.deepEqual(r, { processed: 0, failed: 1 });
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM participation_events")).rows[0].n,
      0,
    );
    const job = (await db.query("SELECT attempts,status,error_code FROM participation_jobs"))
      .rows[0];
    assert.equal(job.attempts, attempt);
    assert.equal(job.error_code, "P0001");
    assert.equal(job.status, attempt === 5 ? "dead" : "pending");
    await db.exec(
      "UPDATE participation_jobs SET available_at=clock_timestamp()-interval '1 second'",
    );
  }
  assert.deepEqual((await db.query("SELECT process_participation_jobs(20) AS r")).rows[0].r, {
    processed: 0,
    failed: 0,
  });
});
test("draft and devnet seasons create no automatic tip jobs", async () => {
  await campaign({ network: "devnet" });
  await activate();
  await payment(tip, "ref", "devnet");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM participation_jobs")).rows[0].n, 0);
});
test("worker rejects unbounded batch sizes", async () => {
  await expectFailure(() => db.query("SELECT process_participation_jobs(21)"), /invalid job limit/);
  await expectFailure(() => db.query("SELECT process_participation_jobs(0)"), /invalid job limit/);
});
