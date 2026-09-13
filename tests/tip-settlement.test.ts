import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  verify: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../src/lib/db.server", () => ({ admin: mocks.admin }));
vi.mock("../src/lib/solana.server", () => ({
  verifyTransferByReference: mocks.verify,
  buildSolanaPayUrl: vi.fn(),
  createReferenceKey: vi.fn(),
}));
vi.mock("../src/lib/bruh-config.server", () => ({
  getBruhConfig: () => ({ network: "devnet" }),
  USDC_MAINNET_MINT: "unused",
}));

import { confirmTip } from "../src/lib/tips.server";

const intent = {
  id: "intent",
  network: "devnet",
  reference_key: "reference",
  recipient_address: "recipient",
  asset_mint: null,
  amount_base_units: "1000000",
  status: "created",
  expires_at: "2099-01-01T00:00:00Z",
};

function rows(value: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: value, error: null });
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.from.mockImplementation(() => rows(intent));
  mocks.verify.mockResolvedValue({ verified: true, signature: "signature", slot: 123 });
  mocks.rpc.mockResolvedValue({
    data: [{ status: "confirmed", signature: "signature", reason: null }],
    error: null,
  });
});

describe("atomic tip settlement", () => {
  it("passes the verified intent snapshot to one database operation", async () => {
    expect(await confirmTip(intent.id)).toEqual({ status: "confirmed", signature: "signature" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("settle_tip_intent", {
      p_intent_id: "intent",
      p_network: "devnet",
      p_reference: "reference",
      p_recipient: "recipient",
      p_mint: null,
      p_amount: "1000000",
      p_signature: "signature",
      p_slot: 123,
      p_raw: null,
    });
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("tip_intents");
  });

  it("never reports confirmed when the atomic database operation fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("database failure") });
    await expect(confirmTip(intent.id)).rejects.toThrow("database failure");
  });

  it("preserves receipt conflicts as pending without inventing a receipt", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ status: "pending", signature: null, reason: "receipt_conflict" }],
      error: null,
    });
    expect(await confirmTip(intent.id)).toEqual({ status: "pending", reason: "receipt_conflict" });
  });

  it("rejects a malformed success response", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ status: "confirmed", signature: null }], error: null });
    await expect(confirmTip(intent.id)).rejects.toThrow("Invalid tip settlement result");
  });

  it("uses atomic expiry without calling the Solana provider", async () => {
    mocks.from.mockImplementation(() => rows({ ...intent, expires_at: "2000-01-01T00:00:00Z" }));
    mocks.rpc.mockResolvedValue({
      data: [{ status: "expired", signature: null, reason: "intent_expired" }],
      error: null,
    });
    expect(await confirmTip(intent.id)).toEqual({ status: "expired", reason: "intent_expired" });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls[0][1].p_signature).toBeNull();
  });

  it("returns an existing receipt without another provider lookup or settlement", async () => {
    mocks.from.mockImplementation((table) =>
      rows(table === "tip_intents" ? { ...intent, status: "confirmed" } : { signature: "stored" }),
    );
    expect(await confirmTip(intent.id)).toEqual({ status: "confirmed", signature: "stored" });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed if a confirmed intent has no receipt", async () => {
    mocks.from.mockImplementation((table) =>
      rows(table === "tip_intents" ? { ...intent, status: "confirmed" } : null),
    );
    await expect(confirmTip(intent.id)).rejects.toThrow("Confirmed tip has no stored receipt");
  });
});
