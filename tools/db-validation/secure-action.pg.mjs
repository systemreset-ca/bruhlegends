import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import bs58 from "bs58";

test("SAP attempts are bounded, account/intent bound and atomically consumed with signed persistence", async () => {
  const db = new PGlite();
  const address = (n) => bs58.encode(new Uint8Array(32).fill(n));
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
    await db.exec(
      await readFile(
        new URL("../../drizzle/migrations/0022_bruh_secure_action_status.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../../drizzle/migrations/0024_bruh_secure_action_proof_window.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
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
          address: address(n),
          keyVersion: "fixture",
          ivHex: "01".repeat(12),
          ciphertextHex: "02".repeat(48),
        },
      ]);
    const id = randomUUID();
    await db.query("SELECT bruh_account_tip_reserve($1::jsonb)", [
      {
        id,
        requestKey: "fixture",
        chatId: "-100123",
        senderUserId: "123",
        recipientUserId: "456",
        network: "devnet",
        reference: address(3),
        lamports: "100000",
        feeLamports: "5000",
        observedBalance: "1000000",
        observedSlot: "100",
        expiresAt: new Date(Date.now() + 240000).toISOString(),
      },
    ]);
    const q = async (sql, args = []) => (await db.query(sql, args)).rows[0].value;
    assert.equal(await q("SELECT bruh_secure_action_password_set(123) AS value"), false);
    const lease = await q("SELECT bruh_secure_action_setup_begin(123) AS value");
    assert.ok(lease);
    assert.equal(await q("SELECT bruh_secure_action_setup_begin(123) AS value"), null);
    assert.equal(
      await q("SELECT bruh_secure_action_enroll(123,null,$1,$2) AS value", [
        "01".repeat(16),
        "02".repeat(32),
      ]),
      false,
    );
    assert.equal(
      await q("SELECT bruh_secure_action_enroll(123,$1,$2,$3) AS value", [
        lease,
        "01".repeat(16),
        "02".repeat(32),
      ]),
      true,
    );
    assert.equal(await q("SELECT bruh_secure_action_password_set(123) AS value"), true);
    assert.equal(
      await q("SELECT bruh_secure_action_enroll(123,$1,$2,$3) AS value", [
        lease,
        "03".repeat(16),
        "04".repeat(32),
      ]),
      false,
    );
    assert.equal(
      (await q("SELECT bruh_secure_action_begin(456,$1) AS value", [id])).allowed,
      false,
    );
    const begin = () => q("SELECT bruh_secure_action_begin(123,$1) AS value", [id]);
    const finish = (nonce, ok, hash = "05".repeat(32), intent = id) =>
      q("SELECT bruh_secure_action_finish(123,$1,$2,$3,$4) AS value", [intent, nonce, ok, hash]);
    let c = await begin();
    assert.equal(c.allowed, true);
    await db.exec("RESET ROLE");
    const proofSeconds = Number(
      (
        await db.query(
          "SELECT extract(epoch from (attempt_expires_at-now())) AS value FROM bruh_secure_action_credentials WHERE telegram_user_id=123",
        )
      ).rows[0].value,
    );
    assert.ok(proofSeconds > 100 && proofSeconds <= 121);
    await db.exec("SET ROLE service_role");
    assert.equal((await begin()).allowed, false);
    assert.equal(await finish(null, true), false);
    assert.equal(await finish(c.nonce, true, "05".repeat(32), randomUUID()), false);
    assert.equal(await finish(c.nonce, false), false);
    // Isolated admin advances only the throttle clock; no production bypass RPC exists.
    const advance = async () => {
      await db.exec(
        "RESET ROLE; UPDATE bruh_secure_action_credentials SET next_attempt_at=now()-interval '1 second'; SET ROLE service_role;",
      );
    };
    for (let attempt = 1; attempt < 5; attempt++) {
      await advance();
      c = await begin();
      assert.equal(c.allowed, true);
      assert.equal(await finish(c.nonce, false), false);
    }
    await advance();
    assert.equal((await begin()).allowed, false);
    await db.exec(
      "RESET ROLE; UPDATE bruh_secure_action_credentials SET locked_until=now()-interval '1 second'; SET ROLE service_role;",
    );
    c = await begin();
    assert.equal(c.allowed, true);
    assert.equal(await finish(c.nonce, true), true);
    assert.equal(await finish(c.nonce, true), false);
    const read = () =>
      q("SELECT bruh_account_tip_authorized_read($1,123,$2) AS value", [id, "05".repeat(32)]);
    assert.ok(await read());
    assert.equal(
      await q("SELECT bruh_account_tip_authorized_read($1,456,$2) AS value", [id, "05".repeat(32)]),
      null,
    );
    const signed = (bytes) =>
      q("SELECT bruh_account_tip_authorized_signed($1,123,$2,$3,$4,200) AS value", [
        id,
        "05".repeat(32),
        bs58.encode(new Uint8Array(64).fill(7)),
        bytes,
      ]);
    await assert.rejects(signed("!"));
    assert.ok(await read());
    await db.exec("RESET ROLE; UPDATE groups SET is_paused=true; SET ROLE service_role;");
    await assert.rejects(signed("AQID"));
    assert.ok(await read());
    await db.exec("RESET ROLE; UPDATE groups SET is_paused=false; SET ROLE service_role;");
    assert.equal((await signed("AQID")).state, "signed");
    assert.equal(await read(), null);
    await assert.rejects(signed("AQID"));
    const grants = (
      await db.query(
        "SELECT has_function_privilege('service_role','bruh_account_tip_signed(uuid,bigint,text,text,bigint)','EXECUTE') AS old,has_function_privilege('anon','bruh_secure_action_begin(bigint,uuid)','EXECUTE') AS anon,has_function_privilege('authenticated','bruh_account_tip_authorized_signed(uuid,bigint,text,text,text,bigint)','EXECUTE') AS authenticated,has_function_privilege('service_role','bruh_secure_action_password_set(bigint)','EXECUTE') AS status_service,has_function_privilege('anon','bruh_secure_action_password_set(bigint)','EXECUTE') AS status_anon",
      )
    ).rows[0];
    assert.deepEqual(grants, {
      old: false,
      anon: false,
      authenticated: false,
      status_service: true,
      status_anon: false,
    });
    await assert.rejects(db.query("SELECT * FROM bruh_secure_action_credentials"));
    await assert.rejects(db.query("SELECT * FROM bruh_account_tip_authorizations"));
    await db.exec("RESET ROLE;");
    await assert.rejects(db.query("DELETE FROM bruh_secure_action_audit"));
  } finally {
    await db.close();
  }
});
