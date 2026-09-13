import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bridgeCallerPublicKey,
  signBridgeRequest,
  verifyBridgeRequest,
  type BridgeNonceConsumer,
} from "../services/custody-signer/bridge-auth";

function fixture() {
  const secret = randomBytes(48).toString("hex");
  const now = Date.now();
  const rawBody = JSON.stringify({ test: true });
  const path = "/api/internal/custody/provision";
  const keyId = "test-bridge-v1";
  const headers = signBridgeRequest({ secret, keyId, now, rawBody, path });
  const nonces = new Set<string>(); // TEST ONLY; production requires shared atomic storage.
  const consumeNonce: BridgeNonceConsumer = async ({ nonce, expiresAt, now: clock }) => {
    expect(expiresAt - clock).toBe(300000);
    if (nonces.has(nonce)) return false;
    nonces.add(nonce);
    return true;
  };
  return {
    secret,
    now,
    path,
    rawBody,
    headers,
    method: "POST",
    expectedKeyId: keyId,
    expectedPublicKey: bridgeCallerPublicKey(secret),
    consumeNonce,
    clock: () => now,
  };
}
describe("isolated service public-key bridge authentication", () => {
  it("verifies using only the caller public key, and rejects replay", async () => {
    const input = fixture();
    expect(await verifyBridgeRequest(input)).toBe(true);
    expect(await verifyBridgeRequest(input)).toBe(false);
  });
  it("has exactly one winner for parallel same-nonce verification", async () => {
    const input = fixture();
    expect(
      (await Promise.all(Array.from({ length: 6 }, () => verifyBridgeRequest(input)))).filter(
        Boolean,
      ),
    ).toHaveLength(1);
  });
  it("rejects tampered body, path, key identifier and method", async () => {
    const input = fixture();
    expect(await verifyBridgeRequest({ ...input, rawBody: "{}" })).toBe(false);
    expect(await verifyBridgeRequest({ ...input, path: "/api/internal/custody/membership" })).toBe(
      false,
    );
    expect(await verifyBridgeRequest({ ...input, expectedKeyId: "another-caller" })).toBe(false);
    expect(await verifyBridgeRequest({ ...input, method: "GET" })).toBe(false);
    expect(await verifyBridgeRequest(input)).toBe(true);
  });
  it("rejects wrong public key and malformed signature without consuming nonce", async () => {
    const input = fixture();
    expect(
      await verifyBridgeRequest({
        ...input,
        expectedPublicKey: bridgeCallerPublicKey(randomBytes(48).toString("hex")),
      }),
    ).toBe(false);
    const headers = new Headers(input.headers);
    headers.set("x-bruh-bridge-signature", "invalid");
    expect(await verifyBridgeRequest({ ...input, headers })).toBe(false);
    expect(await verifyBridgeRequest(input)).toBe(true);
  });
  it("rejects absent config, absent/outage store and non-boolean claim", async () => {
    const input = fixture();
    expect(await verifyBridgeRequest({ ...input, expectedPublicKey: undefined })).toBe(false);
    expect(await verifyBridgeRequest({ ...input, expectedKeyId: undefined })).toBe(false);
    expect(await verifyBridgeRequest({ ...input, consumeNonce: null })).toBe(false);
    expect(
      await verifyBridgeRequest({
        ...input,
        consumeNonce: async () => {
          throw new Error("storage outage");
        },
      }),
    ).toBe(false);
    expect(
      await verifyBridgeRequest({
        ...input,
        consumeNonce: async () => undefined as unknown as boolean,
      }),
    ).toBe(false);
  });
  it("rejects expired, future and invalid clocks", async () => {
    const input = fixture();
    for (const offset of [-60001, 60001])
      expect(await verifyBridgeRequest({ ...input, clock: () => input.now + offset })).toBe(false);
    expect(await verifyBridgeRequest({ ...input, clock: () => Number.NaN })).toBe(false);
  });
  it("rechecks freshness after waiting on durable storage", async () => {
    const input = fixture();
    let time = input.now;
    expect(
      await verifyBridgeRequest({
        ...input,
        clock: () => time,
        consumeNonce: async () => {
          time += 60001;
          return true;
        },
      }),
    ).toBe(false);
  });
  it("rejects arbitrary routes and oversized signed inputs", () => {
    const input = fixture();
    expect(() =>
      signBridgeRequest({ ...input, keyId: input.expectedKeyId, path: "/arbitrary/sign" }),
    ).toThrow();
    expect(() =>
      signBridgeRequest({ ...input, keyId: input.expectedKeyId, rawBody: "x".repeat(8193) }),
    ).toThrow();
    expect(() => bridgeCallerPublicKey("short")).toThrow();
  });
});
