import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import bs58 from "bs58";
test("finalized account tips credit history atomically once with exact group attribution", async () => {
  const db = new PGlite();
  const addr = (n) => bs58.encode(new Uint8Array(32).fill(n));
  const sig = bs58.encode(new Uint8Array(64).fill(7));
  const group = randomUUID(),
    sender = randomUUID(),
    recipient = randomUUID(),
    id = randomUUID();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE groups(id uuid primary key,telegram_chat_id bigint unique);
      CREATE TABLE group_members(id uuid primary key,group_id uuid references groups(id),telegram_user_id bigint,unique(group_id,telegram_user_id));
      CREATE TABLE tip_intents(id uuid primary key,group_id uuid references groups(id),network text,sender_membership_id uuid references group_members(id),recipient_membership_id uuid references group_members(id),recipient_address text,asset_symbol text,asset_mint text,amount_base_units numeric,amount_display numeric,reference_key text unique,privacy text,status text,expires_at timestamptz,created_at timestamptz);
      CREATE TABLE verified_transfers(tip_intent_id uuid unique references tip_intents(id),signature text unique,slot bigint,recipient_address text,asset_mint text,amount_base_units numeric,confirmed_at timestamptz,raw jsonb);`);
    await db.query("INSERT INTO groups VALUES($1,-100123)", [group]);
    await db.query("INSERT INTO group_members VALUES($1,$2,123),($3,$2,456)", [
      sender,
      group,
      recipient,
    ]);
    for (const file of [
      "proposed-account-wallet-schema.sql",
      "proposed-account-tip-schema.sql",
      "proposed-account-tip-credit.sql",
    ])
      await db.exec(await readFile(new URL(`../../docs/${file}`, import.meta.url), "utf8"));
    await db.exec("SET ROLE service_role");
    for (const [user, n] of [
      [123, 1],
      [456, 2],
    ])
      await db.query("SELECT bruh_account_wallet_provision($1::jsonb)", [
        {
          id: randomUUID(),
          telegramUserId: String(user),
          network: "devnet",
          address: addr(n),
          keyVersion: "fixture-v1",
          ivHex: "01".repeat(12),
          ciphertextHex: "02".repeat(48),
        },
      ]);
    await db.query("SELECT bruh_account_tip_reserve($1::jsonb)", [
      {
        id,
        requestKey: "fixture",
        chatId: "-100123",
        senderUserId: "123",
        recipientUserId: "456",
        network: "devnet",
        reference: addr(3),
        lamports: "1000001",
        feeLamports: "5000",
        observedBalance: "1005001",
        observedSlot: "100",
        expiresAt: new Date(Date.now() + 180000).toISOString(),
      },
    ]);
    const credit = (user = 123, signature = sig, slot = 101, fee = 5000) =>
      db.query("SELECT bruh_account_tip_finalize_credit($1,$2,$3,$4,$5) AS result", [
        id,
        user,
        signature,
        slot,
        fee,
      ]);
    await assert.rejects(credit()); // unsigned cannot count
    await db.query("SELECT bruh_account_tip_signed($1,123,$2,$3,200)", [
      id,
      sig,
      Buffer.alloc(248).toString("base64"),
    ]);
    await assert.rejects(credit(456));
    await assert.rejects(credit(123, sig, 99));
    await assert.rejects(credit(123, sig, 101, 5001));
    await db.exec(
      "RESET ROLE; CREATE FUNCTION fixture_fail_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER fixture_fail BEFORE INSERT ON bruh_account_tip_credit_audit FOR EACH ROW EXECUTE FUNCTION fixture_fail_credit(); SET ROLE service_role;",
    );
    await assert.rejects(credit());
    assert.equal(
      (await db.query("SELECT bruh_account_tip_read($1,123) AS result", [id])).rows[0].result.state,
      "signed",
    );
    await db.exec("RESET ROLE");
    assert.equal((await db.query("SELECT count(*)::int AS n FROM tip_intents")).rows[0].n, 0);
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM verified_transfers")).rows[0].n,
      0,
    );
    await db.exec(
      "DROP TRIGGER fixture_fail ON bruh_account_tip_credit_audit; SET ROLE service_role;",
    );
    assert.equal((await credit()).rows[0].result.credited, true);
    assert.equal((await credit()).rows[0].result.credited, true);
    const acl = (
      await db.query(
        "SELECT has_function_privilege('service_role','bruh_account_tip_finalize(uuid,bigint,text,bigint,bigint)','EXECUTE') AS old,has_function_privilege('anon','bruh_account_tip_finalize_credit(uuid,bigint,text,bigint,bigint)','EXECUTE') AS anon,has_function_privilege('authenticated','bruh_account_tip_finalize_credit(uuid,bigint,text,bigint,bigint)','EXECUTE') AS auth",
      )
    ).rows[0];
    assert.deepEqual(acl, { old: false, anon: false, auth: false });
    await assert.rejects(db.query("SELECT * FROM bruh_account_tip_credit_audit"));
    await db.exec("RESET ROLE");
    const tip = (await db.query("SELECT * FROM tip_intents")).rows[0];
    assert.equal(tip.id, id);
    assert.equal(tip.group_id, group);
    assert.equal(tip.sender_membership_id, sender);
    assert.equal(tip.recipient_membership_id, recipient);
    assert.equal(tip.amount_base_units, "1000001");
    assert.equal(Number(tip.amount_display), 0.001000001);
    assert.equal(tip.reference_key, addr(3));
    assert.equal(tip.asset_mint, null);
    assert.equal(tip.status, "confirmed");
    const proof = (await db.query("SELECT * FROM verified_transfers")).rows[0];
    assert.equal(proof.signature, sig);
    assert.equal(Number(proof.slot), 101);
    assert.equal(proof.recipient_address, addr(2));
    assert.equal(proof.raw.reference, addr(3));
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM bruh_account_tip_credit_audit")).rows[0].n,
      1,
    );
    await db.exec(`ALTER TABLE group_members ADD COLUMN is_banned boolean NOT NULL DEFAULT false, ADD COLUMN pseudonym text;
      CREATE TABLE telegram_users(telegram_user_id bigint primary key,username text,first_name text);
      INSERT INTO telegram_users VALUES(123,'fixture-sender',null),(456,'fixture-recipient',null);
      CREATE TABLE calls(id uuid primary key,group_id uuid,caller_membership_id uuid,mint text,ath_multiple double precision,status text,source text,baseline_price_usd double precision,created_at timestamptz default now());
      CREATE TABLE milestones(call_id uuid,milestone integer);`);
    await db.exec(
      await readFile(
        new URL("../../docs/proposed-community-leaderboard.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec("SET ROLE service_role");
    const community = (
      await db.query("SELECT bruh_community_leaderboard('all',100,'devnet','tippers') AS rows")
    ).rows[0].rows;
    assert.equal(community.length, 1);
    assert.equal(community[0].telegramUserId, "123");
    assert.equal(community[0].tipsSent, 1);
    assert.equal(community[0].groups, 1);
    const all = (
      await db.query("SELECT bruh_community_leaderboard('all',100,'devnet','callers') AS rows")
    ).rows[0].rows;
    assert.equal(all.length, 2);
    assert.equal(all.find((row) => row.telegramUserId === "456").tipsReceived, 1);
    await db.exec("RESET ROLE");
    await db.query("UPDATE group_members SET pseudonym='fixture-forgotten' WHERE id=$1", [
      recipient,
    ]);
    await db.exec("SET ROLE service_role");
    assert.equal(
      (await db.query("SELECT bruh_community_leaderboard('all',100,'devnet','tippers') AS rows"))
        .rows[0].rows.length,
      0,
    );
    await db.exec("RESET ROLE");
    await assert.rejects(db.query("DELETE FROM bruh_account_tip_credit_audit"));
  } finally {
    await db.close();
  }
});
