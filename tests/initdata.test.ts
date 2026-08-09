import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyInitData } from "../src/lib/session.server";

const BOT_TOKEN = "123456:test-bot-token";

function signInitData(fields: Record<string, string>, token = BOT_TOKEN): string {
  const checkString = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  const params = new URLSearchParams(fields);
  params.set("hash", hash);
  return params.toString();
}

const fresh = () => ({
  auth_date: String(Math.floor(Date.now() / 1000)),
  user: JSON.stringify({ id: 4242, first_name: "Ada" }),
});

describe("telegram initData verification", () => {
  beforeAll(() => {
    process.env["TELEGRAM_BOT_TOKEN"] = BOT_TOKEN;
  });

  it("accepts an authentic payload", () => {
    expect(verifyInitData(signInitData(fresh()))).toBe(4242);
  });

  it("rejects a payload signed with the wrong token", () => {
    expect(verifyInitData(signInitData(fresh(), "999:attacker"))).toBeNull();
  });

  it("rejects a tampered user id", () => {
    const fields = fresh();
    const signed = signInitData(fields);
    const params = new URLSearchParams(signed);
    params.set("user", JSON.stringify({ id: 1, first_name: "Mallory" }));
    expect(verifyInitData(params.toString())).toBeNull();
  });

  it("rejects a missing hash and an empty payload", () => {
    const params = new URLSearchParams(fresh());
    expect(verifyInitData(params.toString())).toBeNull();
    expect(verifyInitData("")).toBeNull();
  });

  it("rejects a stale payload replayed later", () => {
    const stale = {
      auth_date: String(Math.floor(Date.now() / 1000) - 90_000),
      user: JSON.stringify({ id: 4242 }),
    };
    expect(verifyInitData(signInitData(stale))).toBeNull();
  });
});
