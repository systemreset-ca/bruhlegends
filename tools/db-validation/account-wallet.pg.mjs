import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("account wallet RPCs preserve one active wallet and deny direct key-table access", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    );
    await db.exec(
      await readFile(
        new URL("../../docs/proposed-account-wallet-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    const record = {
      id: "00000000-0000-4000-8000-000000000001",
      telegramUserId: "123",
      network: "devnet",
      address: "11111111111111111111111111111111",
      keyVersion: "fixture-v1",
      ivHex: "01".repeat(12),
      ciphertextHex: "02".repeat(48),
    };
    await db.exec("SET ROLE service_role;");
    const first = (
      await db.query("SELECT bruh_account_wallet_provision($1::jsonb) AS wallet", [record])
    ).rows[0].wallet;
    const replay = (
      await db.query("SELECT bruh_account_wallet_provision($1::jsonb) AS wallet", [
        { ...record, id: "00000000-0000-4000-8000-000000000002" },
      ])
    ).rows[0].wallet;
    assert.deepEqual(first, replay);
    assert.equal(
      (await db.query("SELECT bruh_account_wallet_read('456') AS wallet")).rows[0].wallet,
      null,
    );
    await assert.rejects(db.query("SELECT * FROM bruh_account_wallets"));
    await assert.rejects(db.query("DELETE FROM bruh_account_wallet_audit"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`RESET ROLE; SET ROLE ${role};`);
      await assert.rejects(db.query("SELECT bruh_account_wallet_read('123')"));
      await assert.rejects(db.query("SELECT bruh_account_wallet_provision($1::jsonb)", [record]));
      await assert.rejects(db.query("SELECT * FROM bruh_account_wallets"));
    }
    await db.exec("RESET ROLE;");
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM bruh_account_wallets")).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM bruh_account_wallet_audit")).rows[0].n,
      1,
    );
    await assert.rejects(db.query("UPDATE bruh_account_wallet_audit SET event_type = 'created'"));
    await assert.rejects(db.query("DELETE FROM bruh_account_wallets"));
    await assert.rejects(
      db.query("SELECT bruh_account_wallet_provision($1::jsonb)", [
        { ...record, network: "mainnet-beta" },
      ]),
    );
    await assert.rejects(
      db.query("SELECT bruh_account_wallet_provision($1::jsonb)", [
        { ...record, telegramUserId: "0" },
      ]),
    );
  } finally {
    await db.close();
  }
});
