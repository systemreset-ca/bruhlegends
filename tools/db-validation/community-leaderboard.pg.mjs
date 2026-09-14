import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("community ranks canonical accounts across groups without exposing private source data", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE TABLE telegram_users(telegram_user_id bigint primary key,username text,first_name text);
   CREATE TABLE group_members(id text primary key,group_id text,telegram_user_id bigint,is_banned boolean default false,pseudonym text);
   CREATE TABLE calls(id text primary key,group_id text,caller_membership_id text,mint text,ath_multiple double precision,status text,source text,baseline_price_usd double precision,created_at timestamptz default now());
   CREATE TABLE milestones(call_id text,milestone integer);
   CREATE TABLE tip_intents(id text primary key,group_id text,sender_membership_id text,recipient_membership_id text,status text,privacy text,network text,amount_base_units bigint,recipient_address text,asset_mint text,created_at timestamptz default now());
   CREATE TABLE verified_transfers(tip_intent_id text,signature text,confirmed_at timestamptz default now(),amount_base_units bigint,recipient_address text,asset_mint text);
   INSERT INTO telegram_users VALUES(123,'alice',null),(456,'bob',null),(789,'forgotten',null);
   INSERT INTO group_members(id,group_id,telegram_user_id) VALUES('a1','g1',123),('a2','g2',123),('b1','g1',456),('b2','g2',456);
   INSERT INTO group_members VALUES('f','g1',789,false,'anon-old'),('banned','g1',456,true,null);
   INSERT INTO calls(id,group_id,caller_membership_id,mint,ath_multiple,status,source,baseline_price_usd) VALUES
    ('c1','g1','a1','mint1',2,'active','explicit',1),('c2','g2','a2','mint2',3,'active','detected',1),
    ('c3','g2','a2','mint3',4,'archived','explicit',1),('c4','g1','b1','mint4',100,'active','explicit',1),
    ('invalid','g1','a1','bad',1000,'invalidated','explicit',1),('import','g1','a1','bad2',1000,'archived','import',1),
    ('forgot','g1','f','bad3',1000,'active','explicit',1),('ban','g1','banned','bad4',1000,'active','explicit',1),
    ('cross','g1','a2','bad5',1000,'active','explicit',1);
   INSERT INTO milestones VALUES('c1',2),('c1',2),('c2',2),('invalid',100);
   INSERT INTO tip_intents(id,group_id,sender_membership_id,recipient_membership_id,status,privacy,network,amount_base_units,recipient_address) VALUES
    ('t1','g1','b1','a1','confirmed','public','devnet',10,'alice-address'),
    ('duplicate','g2','b2','a2','confirmed','public','devnet',10,'alice-address'),
    ('private','g1','b1','a1','confirmed','private','devnet',10,'alice-address'),
    ('anonymous','g1','b1','a1','confirmed','anonymous','devnet',10,'alice-address'),
    ('pending','g1','b1','a1','awaiting_payment','public','devnet',10,'alice-address'),
    ('no-proof','g1','b1','a1','confirmed','public','devnet',10,'alice-address'),
    ('self','g1','a1','a1','confirmed','public','devnet',10,'alice-address'),
    ('wrong-proof','g1','b1','a1','confirmed','public','devnet',10,'alice-address'),
    ('mainnet','g1','b1','a1','confirmed','public','mainnet-beta',10,'alice-address');
   INSERT INTO verified_transfers(tip_intent_id,signature,amount_base_units,recipient_address) VALUES
    ('t1','same-sig',10,'alice-address'),('duplicate','same-sig',10,'alice-address'),
    ('private','private-sig',10,'alice-address'),('anonymous','anonymous-sig',10,'alice-address'),
    ('pending','pending-sig',10,'alice-address'),('self','self-sig',10,'alice-address'),
    ('wrong-proof','wrong-sig',9,'alice-address'),('mainnet','same-sig',10,'alice-address');
   UPDATE calls SET created_at=now()-interval '8 days' WHERE id='c3';
   REVOKE ALL ON telegram_users,group_members,calls,milestones,tip_intents,verified_transfers FROM PUBLIC,anon,authenticated,service_role;`);
    await db.exec(
      await readFile(
        new URL("../../docs/proposed-community-leaderboard.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec("SET ROLE service_role;");
    const board = async (window = "all", kind = "callers", network = "devnet") =>
      (
        await db.query("SELECT bruh_community_leaderboard($1,10,$2,$3) AS board", [
          window,
          network,
          kind,
        ])
      ).rows[0].board;
    const rows = await board();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].telegramUserId, "123");
    const alice = rows[0];
    assert.equal(alice.calls, 3);
    assert.equal(alice.uniqueTokens, 3);
    assert.equal(alice.groups, 2);
    assert.equal(alice.bestMultiple, 4);
    assert.equal(alice.milestones, 2);
    assert.equal(alice.tipsReceived, 1);
    assert.equal(rows[1].ranked, false);
    assert.equal(rows[1].tipsSent, 1);
    assert.ok(!JSON.stringify(rows).includes("alice-address"));
    assert.ok(!JSON.stringify(rows).includes("g1"));
    assert.equal(
      alice.score,
      Number(
        (
          (Math.log10(5) * 40 + Math.log10(4) * 30 + 25 + Math.log10(3) * 8) * 0.5 +
          Math.log10(2) * 10
        ).toFixed(2),
      ),
    );
    const recent = await board("7d");
    assert.equal(recent.find((r) => r.telegramUserId === "123").calls, 2);
    assert.equal((await board("all", "tippers"))[0].telegramUserId, "456");
    assert.equal((await board("all", "tippers", "mainnet-beta"))[0].tipsSent, 1);
    await assert.rejects(board("invalid"));
    await assert.rejects(board("all", "invalid"));
    await assert.rejects(db.query("SELECT * FROM calls"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`RESET ROLE; SET ROLE ${role};`);
      await assert.rejects(board());
    }
  } finally {
    await db.close();
  }
});
