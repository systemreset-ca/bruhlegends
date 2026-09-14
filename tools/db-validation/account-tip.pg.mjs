import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import bs58 from "bs58";

test("account tips reserve once, preserve signed spends and settle idempotently", async () => {
  const db = new PGlite();
  const address = (n) => bs58.encode(new Uint8Array(32).fill(n));
  const signature = bs58.encode(new Uint8Array(64).fill(7));
  try {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    );
    for (const file of ["proposed-account-wallet-schema.sql", "proposed-account-tip-schema.sql"])
      await db.exec(await readFile(new URL(`../../docs/${file}`, import.meta.url), "utf8"));
    await db.exec("SET ROLE service_role;");
    for (const [user, n] of [
      [123, 1],
      [456, 2],
    ]) {
      await db.query("SELECT bruh_account_wallet_provision($1::jsonb)", [
        {
          id: randomUUID(),
          telegramUserId: String(user),
          network: "devnet",
          address: address(n),
          keyVersion: "fixture-v1",
          ivHex: "01".repeat(12),
          ciphertextHex: "02".repeat(48),
        },
      ]);
    }
    const input = {
      id: randomUUID(),
      requestKey: "fixture-group-message",
      chatId: "-100123",
      senderUserId: "123",
      recipientUserId: "456",
      network: "devnet",
      reference: address(3),
      lamports: "1000000",
      feeLamports: "5000",
      observedBalance: "1005000",
      observedSlot: "100",
      expiresAt: new Date(Date.now() + 240000).toISOString(),
    };
    const reserve = async (record) =>
      (await db.query("SELECT bruh_account_tip_reserve($1::jsonb) AS tip", [record])).rows[0].tip;
    const transition = async (sql, args) => (await db.query(sql, args)).rows[0].tip;
    const first = await reserve(input);
    assert.deepEqual(
      (
        await db.query("SELECT bruh_account_tip_find_request($1,$2) AS tip", [
          input.requestKey,
          123,
        ])
      ).rows[0].tip,
      first,
    );
    assert.equal(
      (
        await db.query("SELECT bruh_account_tip_find_request($1,$2) AS tip", [
          input.requestKey,
          456,
        ])
      ).rows[0].tip,
      null,
    );
    assert.equal(
      (await db.query("SELECT bruh_account_tip_find_request($1,$2) AS tip", ["absent", 123]))
        .rows[0].tip,
      null,
    );
    const requestPrivileges = (
      await db.query(
        "SELECT has_function_privilege('anon','bruh_account_tip_find_request(text,bigint)','EXECUTE') AS anon,has_function_privilege('authenticated','bruh_account_tip_find_request(text,bigint)','EXECUTE') AS authenticated,has_function_privilege('service_role','bruh_account_tip_find_request(text,bigint)','EXECUTE') AS service",
      )
    ).rows[0];
    assert.deepEqual(requestPrivileges, { anon: false, authenticated: false, service: true });
    assert.equal(first.state, "reserved");
    assert.equal(first.sender_address, address(1));
    assert.equal(first.recipient_address, address(2));
    assert.equal(first.telegram_chat_id, -100123);
    assert.deepEqual(await reserve({ ...input, id: randomUUID() }), first);
    for (const changes of [
      { lamports: "1000001" },
      { recipientUserId: "123" },
      { chatId: "-100456" },
      { reference: address(4) },
      { feeLamports: null },
    ])
      await assert.rejects(reserve({ ...input, ...changes }));
    await assert.rejects(
      reserve({ ...input, id: randomUUID(), requestKey: "parallel", reference: address(4) }),
    );
    assert.equal(
      (await db.query("SELECT bruh_account_tip_read($1,456) AS tip", [input.id])).rows[0].tip,
      null,
    );
    await assert.rejects(db.query("SELECT bruh_account_tip_cancel($1,456)", [input.id]));
    const signSql = "SELECT bruh_account_tip_signed($1,123,$2,'AQID',200) AS tip";
    const signed = await transition(signSql, [input.id, signature]);
    assert.equal(signed.state, "signed");
    assert.deepEqual(await transition(signSql, [input.id, signature]), signed);
    await assert.rejects(
      db.query("SELECT bruh_account_tip_signed($1,123,$2,'AQIE',200)", [input.id, signature]),
    );
    // Isolated fixture clock advance through an admin-only trigger bypass.
    // Application roles cannot mutate the frozen expiry.
    await db.exec(
      "RESET ROLE; ALTER TABLE bruh_account_tip_intents DISABLE TRIGGER bruh_account_tip_intent_immutable;",
    );
    await db.query(
      "UPDATE bruh_account_tip_intents SET expires_at=now()-interval '1 second' WHERE id=$1",
      [input.id],
    );
    await db.exec(
      "ALTER TABLE bruh_account_tip_intents ENABLE TRIGGER bruh_account_tip_intent_immutable; SET ROLE service_role;",
    );
    // Expired UI must not free funds for an already signed transaction.
    await assert.rejects(db.query("SELECT bruh_account_tip_cancel($1,123)", [input.id]));
    await assert.rejects(
      db.query("SELECT bruh_account_tip_finalize($1,123,$2,101,4999)", [input.id, signature]),
    );
    await assert.rejects(
      db.query("SELECT bruh_account_tip_finalize($1,123,$2,99,5000)", [input.id, signature]),
    );
    const finalSql = "SELECT bruh_account_tip_finalize($1,123,$2,101,5000) AS tip";
    const finalized = await transition(finalSql, [input.id, signature]);
    assert.equal(finalized.state, "finalized");
    assert.deepEqual(await transition(finalSql, [input.id, signature]), finalized);
    // Previously finalized debit must be reflected in a newer balance observation.
    const next = {
      ...input,
      id: randomUUID(),
      requestKey: "next",
      reference: address(4),
      observedSlot: "102",
    };
    await assert.rejects(reserve({ ...next, observedSlot: "101" }));
    await assert.rejects(reserve({ ...next, observedBalance: "1004999" }));
    await reserve(next);
    const cancelSql = "SELECT bruh_account_tip_cancel($1,123) AS tip";
    const cancelled = await transition(cancelSql, [next.id]);
    assert.equal(cancelled.state, "cancelled");
    assert.deepEqual(await transition(cancelSql, [next.id]), cancelled);
    await assert.rejects(db.query(signSql, [next.id, signature]));
    await assert.rejects(db.query("SELECT * FROM bruh_account_tip_execution"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`RESET ROLE; SET ROLE ${role};`);
      await assert.rejects(db.query("SELECT bruh_account_tip_read($1,123)", [input.id]));
      await assert.rejects(reserve(input));
      await assert.rejects(db.query("SELECT * FROM bruh_account_tip_audit"));
    }
    await db.exec("RESET ROLE;");
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM bruh_account_tip_audit")).rows[0].n,
      5,
    );
    await assert.rejects(db.query("DELETE FROM bruh_account_tip_audit"));
    await assert.rejects(db.query("UPDATE bruh_account_tip_intents SET lamports=1"));
  } finally {
    await db.close();
  }
});
