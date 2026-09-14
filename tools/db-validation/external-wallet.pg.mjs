import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("external candidates remain unverified, immutable and account-owned through controlled RPCs", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    );
    await db.exec(
      await readFile(
        new URL("../../docs/proposed-external-wallet-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    const address = "11111111111111111111111111111111";
    const id = "00000000-0000-4000-8000-000000000001";
    await db.exec("SET ROLE service_role;");
    const register = (user, value, uuid) =>
      db.query("SELECT bruh_external_wallet_register($1,$2,$3::uuid) AS candidate", [
        user,
        value,
        uuid,
      ]);
    const first = (await register("123", address, id)).rows[0].candidate;
    assert.equal(first.status, "unverified");
    assert.equal(first.telegramUserId, "123");
    assert.deepEqual(
      (await register("123", address, "00000000-0000-4000-8000-000000000002")).rows[0].candidate,
      first,
    );
    assert.equal(
      (await db.query("SELECT bruh_external_wallet_read('456') AS candidate")).rows[0].candidate,
      null,
    );
    await assert.rejects(register("123", "22222222222222222222222222222222", id));
    await assert.rejects(register("0", address, id));
    await assert.rejects(register("01", address, id));
    await assert.rejects(register("4503599627370496", address, id));
    await assert.rejects(db.query("SELECT * FROM bruh_external_wallet_candidates"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`RESET ROLE; SET ROLE ${role};`);
      await assert.rejects(register("123", address, id));
      await assert.rejects(db.query("SELECT bruh_external_wallet_read('123')"));
      await assert.rejects(db.query("SELECT * FROM bruh_external_wallet_audit"));
    }
    await db.exec("RESET ROLE;");
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM bruh_external_wallet_candidates")).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM bruh_external_wallet_audit")).rows[0].n,
      1,
    );
    await assert.rejects(
      db.query("UPDATE bruh_external_wallet_candidates SET status='unverified'"),
    );
    await assert.rejects(db.query("DELETE FROM bruh_external_wallet_audit"));
  } finally {
    await db.close();
  }
});
