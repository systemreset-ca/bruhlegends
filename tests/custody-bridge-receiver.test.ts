import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import { describe, expect, it, vi } from "vitest";
import { bridgeCallerPublicKey, signBridgeRequest } from "../services/custody-signer/bridge-auth";
import {
  receiveProvisionBridge,
  type BridgeReceiverDeps,
} from "../services/custody-signer/bridge-receiver";

function fixture() {
  const secret = randomBytes(48).toString("hex"),
    keyId = "test-receiver-v1",
    now = Date.now();
  const approval = {
    approved: true,
    groupId: "00000000-0000-4000-8000-000000000001",
    membershipId: "00000000-0000-4000-8000-000000000002",
    telegramChatId: "-100123",
    telegramUserId: "123",
  };
  const body = {
    version: 1,
    telegram_init_data: "fixture-only",
    telegram_chat_id: "-100123",
    membership_approval: approval,
  };
  const wallet = {
    walletId: "00000000-0000-4000-8000-000000000003",
    address: bs58.encode(randomBytes(32)),
    network: "devnet" as const,
    wrappingKeyVersion: "test-v1",
    frozen: true as const,
  };
  const nonces = new Set<string>(); // TEST ONLY, never used by production receiver.
  const deps: BridgeReceiverDeps = {
    enabled: true,
    expectedKeyId: keyId,
    expectedPublicKey: bridgeCallerPublicKey(secret),
    clock: () => now,
    consumeNonce: vi.fn(async ({ nonce }) => {
      if (nonces.has(nonce)) return false;
      nonces.add(nonce);
      return true;
    }),
    verifyTelegram: vi.fn(() => "123"),
    provision: vi.fn(async () => ({ created: true, wallet })),
  };
  function request(value: unknown = body, headers?: Headers) {
    const rawBody = typeof value === "string" ? value : JSON.stringify(value);
    return new Request("https://guardian.test/api/internal/custody/provision", {
      method: "POST",
      body: rawBody,
      headers:
        headers ??
        signBridgeRequest({ secret, keyId, path: "/api/internal/custody/provision", rawBody, now }),
    });
  }
  return { deps, body, wallet, request };
}
describe("isolated provisioning bridge receiver", () => {
  it("binds a real service signature to independent Telegram identity and exact frozen scope", async () => {
    const f = fixture(),
      response = await receiveProvisionBridge(f.request(), f.deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, created: true, wallet: f.wallet });
    expect(f.deps.provision).toHaveBeenCalledWith({
      groupId: f.body.membership_approval.groupId,
      membershipId: f.body.membership_approval.membershipId,
      telegramChatId: "-100123",
      telegramUserId: "123",
      network: "devnet",
    });
  });
  it("rejects exact replay across independently constructed requests", async () => {
    const f = fixture(),
      first = f.request(),
      second = first.clone();
    expect((await receiveProvisionBridge(first, f.deps)).status).toBe(200);
    expect((await receiveProvisionBridge(second, f.deps)).status).toBe(401);
    expect(f.deps.provision).toHaveBeenCalledTimes(1);
  });
  it("disabled receivers do no authentication or wallet work", async () => {
    const f = fixture();
    f.deps.enabled = false;
    expect((await receiveProvisionBridge(f.request(), f.deps)).status).toBe(404);
    expect(f.deps.consumeNonce).not.toHaveBeenCalled();
    expect(f.deps.provision).not.toHaveBeenCalled();
  });
  it("rejects missing public key and unavailable nonce storage", async () => {
    for (const change of [{ expectedPublicKey: undefined }, { consumeNonce: null }]) {
      const f = fixture();
      expect((await receiveProvisionBridge(f.request(), { ...f.deps, ...change })).status).toBe(
        401,
      );
      expect(f.deps.verifyTelegram).not.toHaveBeenCalled();
      expect(f.deps.provision).not.toHaveBeenCalled();
    }
  });
  it("rejects modified approval with original service signature", async () => {
    const f = fixture(),
      original = f.request();
    f.body.membership_approval.telegramUserId = "456";
    expect((await receiveProvisionBridge(f.request(f.body, original.headers), f.deps)).status).toBe(
      401,
    );
    expect(f.deps.verifyTelegram).not.toHaveBeenCalled();
  });
  it("rejects wrong Telegram identity or chat even with valid caller proof", async () => {
    for (const mode of ["user", "chat"]) {
      const f = fixture();
      if (mode === "user") f.deps.verifyTelegram = () => "456";
      else f.body.telegram_chat_id = "-999";
      expect((await receiveProvisionBridge(f.request(), f.deps)).status).toBe(401);
      expect(f.deps.provision).not.toHaveBeenCalled();
    }
  });
  it("rejects unsigned/client extensions and noncanonical Telegram IDs", async () => {
    for (const mutate of [
      (b: any) => (b.wallet_seed = "not-a-key"),
      (b: any) => (b.membership_approval.extra = true),
      (b: any) => (b.membership_approval.telegramUserId = "0123"),
      (b: any) => (b.membership_approval.approved = false),
      (b: any) => (b.version = 2),
    ]) {
      const f = fixture();
      mutate(f.body);
      expect((await receiveProvisionBridge(f.request(), f.deps)).status).toBe(401);
      expect(f.deps.provision).not.toHaveBeenCalled();
    }
  });
  it("does not reflect envelopes, unfreezing or mainnet in callback replies", async () => {
    for (const extra of [
      { envelope: { fixture: true } },
      { network: "mainnet-beta" },
      { frozen: false },
    ]) {
      const f = fixture();
      f.deps.provision = vi.fn(async () => ({
        created: true,
        wallet: { ...f.wallet, ...extra },
      })) as BridgeReceiverDeps["provision"];
      const response = await receiveProvisionBridge(f.request(), f.deps);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ok: false });
    }
  });
  it("rejects oversize streams before authentication", async () => {
    const f = fixture(),
      req = new Request("https://guardian.test/api/internal/custody/provision", {
        method: "POST",
        body: "x".repeat(8193),
      });
    expect((await receiveProvisionBridge(req, f.deps)).status).toBe(401);
    expect(f.deps.consumeNonce).not.toHaveBeenCalled();
  });
  it("does not expose thrown provider or vault errors", async () => {
    const f = fixture();
    f.deps.provision = async () => {
      throw new Error("fixture private diagnostic text");
    };
    const response = await receiveProvisionBridge(f.request(), f.deps);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private diagnostic");
  });
});
