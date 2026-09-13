import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import { describe, expect, it, vi } from "vitest";
import {
  provisionThroughCustodyGateway,
  type CustodyGatewayDeps,
} from "../src/lib/custody-gateway.server";
import { bridgeCallerPublicKey, verifyBridgeRequest } from "../services/custody-signer/bridge-auth";

function fixture() {
  const membershipId = "00000000-0000-4000-8000-000000000001";
  const groupId = "00000000-0000-4000-8000-000000000002";
  const wallet = {
    walletId: "00000000-0000-4000-8000-000000000003",
    address: bs58.encode(randomBytes(32)),
    network: "devnet",
    frozen: true,
    wrappingKeyVersion: "test-v1",
  };
  const callerSecret = randomBytes(48).toString("hex");
  const input = {
    session: "fixture-session-not-forwarded",
    membershipId,
    initData: "fixture-telegram-proof",
  };
  const deps: CustodyGatewayDeps = {
    enabled: true,
    callerSecret,
    callerKeyId: "test-bridge-v1",
    signerOrigin: "https://bruh-devnet-guardian.lovable.app",
    session: vi.fn(async () => ({ telegramUserId: 123, groupId: null })),
    telegram: vi.fn(() => 123),
    membership: vi.fn(async () => ({
      approved: true,
      groupId,
      membershipId,
      telegramChatId: "-100123",
      telegramUserId: "123",
    })),
    transport: vi.fn(async () =>
      Response.json({ ok: true, created: true, wallet }),
    ) as unknown as typeof fetch,
  };
  return { input, deps, wallet, groupId };
}
describe("disabled-by-default BRUH custody gateway", () => {
  it("constructs server-owned membership approval and signs its exact body", async () => {
    const { input, deps, wallet, groupId } = fixture();
    deps.transport = (async (url, options) => {
      expect(String(url)).toBe(
        "https://bruh-devnet-guardian.lovable.app/api/internal/custody/provision",
      );
      const rawBody = String(options?.body);
      const payload = JSON.parse(rawBody);
      expect(payload).toEqual({
        version: 1,
        telegram_init_data: input.initData,
        telegram_chat_id: "-100123",
        membership_approval: {
          approved: true,
          groupId,
          membershipId: input.membershipId,
          telegramChatId: "-100123",
          telegramUserId: "123",
        },
      });
      expect(rawBody).not.toContain(input.session);
      expect(
        await verifyBridgeRequest({
          method: "POST",
          path: "/api/internal/custody/provision",
          rawBody,
          headers: new Headers(options?.headers),
          expectedKeyId: deps.callerKeyId,
          expectedPublicKey: bridgeCallerPublicKey(deps.callerSecret!),
          consumeNonce: async () => true,
        }),
      ).toBe(true);
      return Response.json({ ok: true, created: true, wallet });
    }) as typeof fetch;
    expect(await provisionThroughCustodyGateway(input, deps)).toEqual({
      ok: true,
      created: true,
      wallet,
    });
  });
  it("rejects disabled/configuration paths before touching identity/database/provider", async () => {
    const { input, deps } = fixture();
    expect(await provisionThroughCustodyGateway(input, { ...deps, enabled: false })).toEqual({
      ok: false,
      reason: "disabled",
    });
    expect(
      await provisionThroughCustodyGateway(input, { ...deps, callerSecret: undefined }),
    ).toEqual({ ok: false, reason: "configuration_unavailable" });
    expect(
      await provisionThroughCustodyGateway(input, {
        ...deps,
        signerOrigin: "https://another-project.invalid",
      }),
    ).toEqual({ ok: false, reason: "configuration_unavailable" });
    expect(deps.session).not.toHaveBeenCalled();
    expect(deps.transport).not.toHaveBeenCalled();
  });
  it("requires fresh Telegram proof matching resolved session identity", async () => {
    const { input, deps } = fixture();
    for (const user of [null, 124, 0, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect(
        await provisionThroughCustodyGateway(input, { ...deps, telegram: () => user }),
      ).toEqual({ ok: false, reason: "unauthorized" });
    }
    expect(deps.membership).not.toHaveBeenCalled();
    expect(deps.transport).not.toHaveBeenCalled();
  });
  it("denies absent, banned or mismatched owned membership", async () => {
    const { input, deps } = fixture();
    expect(
      await provisionThroughCustodyGateway(input, { ...deps, membership: async () => null }),
    ).toEqual({ ok: false, reason: "membership_denied" });
    const approved = await deps.membership(123, input.membershipId);
    expect(
      await provisionThroughCustodyGateway(input, {
        ...deps,
        membership: async () => ({ ...approved!, telegramUserId: "124" }),
      }),
    ).toEqual({ ok: false, reason: "membership_denied" });
    expect(deps.transport).not.toHaveBeenCalled();
  });
  it("does not let a group-scoped session provision another owned group", async () => {
    const { input, deps } = fixture();
    expect(
      await provisionThroughCustodyGateway(input, {
        ...deps,
        session: async () => ({
          telegramUserId: 123,
          groupId: "00000000-0000-4000-8000-000000000099",
        }),
      }),
    ).toEqual({ ok: false, reason: "membership_denied" });
  });
  it("ignores client approval claims instead of signing them", async () => {
    const { input, deps, wallet } = fixture();
    deps.transport = (async (_url, options) => {
      expect(String(options?.body)).not.toContain("client-selected-identity");
      return Response.json({ ok: true, created: false, wallet });
    }) as typeof fetch;
    const untrusted = {
      ...input,
      membership_approval: { telegramUserId: "client-selected-identity" },
    };
    expect((await provisionThroughCustodyGateway(untrusted, deps)).ok).toBe(true);
  });
  it.each([
    { network: "mainnet-beta" },
    { frozen: false },
    { address: "invalid" },
    { encryptedSeed: "forbidden-extra" },
  ])("rejects malformed or unsafe signer metadata %j", async (change) => {
    const { input, deps, wallet } = fixture();
    const transport = (async () =>
      Response.json({ ok: true, created: true, wallet: { ...wallet, ...change } })) as typeof fetch;
    expect(await provisionThroughCustodyGateway(input, { ...deps, transport })).toEqual({
      ok: false,
      reason: "signer_unavailable",
    });
  });
  it("does not leak signer errors, retry or accept oversized responses", async () => {
    const { input, deps } = fixture();
    const transport = vi.fn(async () => {
      throw new Error("secret-provider-error-not-returned");
    }) as unknown as typeof fetch;
    expect(await provisionThroughCustodyGateway(input, { ...deps, transport })).toEqual({
      ok: false,
      reason: "signer_unavailable",
    });
    expect(transport).toHaveBeenCalledTimes(1);
    const huge = (async () => new Response("x".repeat(8193))) as typeof fetch;
    expect(await provisionThroughCustodyGateway(input, { ...deps, transport: huge })).toEqual({
      ok: false,
      reason: "signer_unavailable",
    });
  });
});
