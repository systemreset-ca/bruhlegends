import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import bs58 from "bs58";

test("wallet export is account-bound, expiring, single-use and audit-only", async () => {
  const db = new PGlite();
  const address = (n) => bs58.encode(new Uint8Array(32).fill(n));
  const q = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  try {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE groups(id text primary key,telegram_chat_id bigint,is_paused boolean,removed_at timestamptz); CREATE TABLE group_members(group_id text,telegram_user_id bigint,is_banned boolean,pseudonym text); INSERT INTO groups VALUES('g1',-100123,false,null); INSERT INTO group_members VALUES('g1',123,false,null),('g1',456,false,null);",
    );
    for (const file of [
      "proposed-account-wallet-schema.sql",
      "proposed-account-tip-schema.sql",
      "proposed-account-tip-authorization.sql",
    ])
      await db.exec(await readFile(new URL(`../../docs/${file}`, import.meta.url), "utf8"));
    for (const file of [
      "0022_bruh_secure_action_status.sql",
      "0024_bruh_secure_action_proof_window.sql",
      "0026_bruh_secure_action_runtime_pbkdf2.sql",
      "0028_bruh_account_wallet_export.sql",
    ])
      await db.exec(
        await readFile(new URL(`../../drizzle/migrations/${file}`, import.meta.url), "utf8"),
      );
    await db.exec("SET ROLE service_role");
    const wallets = new Map();
    for (const [user, n] of [
      [123, 1],
      [456, 2],
    ]) {
      const id = randomUUID();
      wallets.set(user, id);
      await db.query("SELECT bruh_account_wallet_provision($1::jsonb)", [
        {
          id,
          telegramUserId: String(user),
          network: "devnet",
          address: address(n),
          keyVersion: "fixture",
          ivHex: "01".repeat(12),
          ciphertextHex: "02".repeat(48),
        },
      ]);
    }
    const lease = await q("SELECT bruh_secure_action_setup_begin(123) AS value");
    assert.ok(lease);
    assert.equal(
      await q("SELECT bruh_secure_action_enroll(123,$1,$2,$3) AS value", [
        lease,
        "01".repeat(16),
        "02".repeat(32),
      ]),
      true,
    );
    const requested = await q("SELECT bruh_account_wallet_export_request(123) AS value");
    assert.equal(requested.wallet_id, wallets.get(123));
    assert.equal(requested.address, address(1));
    assert.equal(requested.status, "pending");
    const duplicate = await q("SELECT bruh_account_wallet_export_request(123) AS value");
    assert.equal(duplicate.id, requested.id);
    assert.equal(
      await q("SELECT bruh_account_wallet_export_read($1,456) AS value", [requested.id]),
      null,
    );
    assert.equal(
      (await q("SELECT bruh_account_wallet_export_begin(456,$1) AS value", [requested.id])).allowed,
      false,
    );
    const challenge = await q("SELECT bruh_account_wallet_export_begin(123,$1) AS value", [
      requested.id,
    ]);
    assert.equal(challenge.allowed, true);
    assert.equal(challenge.iterations, 100000);
    assert.equal(
      (await q("SELECT bruh_account_wallet_export_begin(123,$1) AS value", [requested.id])).allowed,
      false,
    );
    const tokenHash = "05".repeat(32);
    assert.equal(
      await q("SELECT bruh_account_wallet_export_finish(123,$1,$2,true,$3) AS value", [
        requested.id,
        challenge.nonce,
        tokenHash,
      ]),
      true,
    );
    assert.equal(
      await q("SELECT bruh_account_wallet_export_finish(123,$1,$2,true,$3) AS value", [
        requested.id,
        challenge.nonce,
        tokenHash,
      ]),
      false,
    );
    const consumed = await q("SELECT bruh_account_wallet_export_consume($1,123,$2) AS value", [
      requested.id,
      tokenHash,
    ]);
    assert.equal(consumed.wallet_id, wallets.get(123));
    assert.equal(consumed.address, address(1));
    await assert.rejects(
      q("SELECT bruh_account_wallet_export_consume($1,123,$2) AS value", [requested.id, tokenHash]),
    );
    const grants = (
      await db.query(
        "SELECT has_function_privilege('anon','bruh_account_wallet_export_request(bigint)','EXECUTE') AS anon,has_function_privilege('authenticated','bruh_account_wallet_export_consume(uuid,bigint,text)','EXECUTE') AS authenticated,has_function_privilege('service_role','bruh_account_wallet_export_consume(uuid,bigint,text)','EXECUTE') AS service",
      )
    ).rows[0];
    assert.deepEqual(grants, { anon: false, authenticated: false, service: true });
    await assert.rejects(db.query("SELECT * FROM bruh_account_wallet_export_intents"));
    await assert.rejects(db.query("SELECT * FROM bruh_account_wallet_export_authorizations"));
    await db.exec("RESET ROLE");
    const audit = (
      await db.query(
        "SELECT event_type FROM bruh_secure_action_audit WHERE telegram_user_id=123 ORDER BY id",
      )
    ).rows.map((row) => row.event_type);
    assert.deepEqual(audit, [
      "enrolled",
      "export_requested",
      "export_attempt",
      "export_authorized",
      "export_revealed",
    ]);
    await assert.rejects(db.query("DELETE FROM bruh_secure_action_audit"));
  } finally {
    await db.close();
  }
});
