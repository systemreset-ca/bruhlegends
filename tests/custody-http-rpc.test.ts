import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { DevnetHttpSolRpc } from "../services/custody-signer/http-rpc";
import {
  DEVNET_GENESIS,
  Keypair,
  signSolTransfer,
  type SolTransferApproval,
} from "../services/custody-signer/sol-transfer";

function fixture() {
  const seed = randomBytes(32);
  const approval: SolTransferApproval = {
    walletId: "00000000-0000-4000-8000-000000000001",
    groupId: "00000000-0000-4000-8000-000000000002",
    membershipId: "00000000-0000-4000-8000-000000000003",
    reservationId: "00000000-0000-4000-8000-000000000004",
    network: "devnet",
    sender: Keypair.fromSeed(seed).publicKey.toBase58(),
    recipient: Keypair.generate().publicKey.toBase58(),
    reference: Keypair.generate().publicKey.toBase58(),
    lamports: "12345",
    feeCapLamports: "10000",
    blockhash: Keypair.generate().publicKey.toBase58(),
    lastValidBlockHeight: 99,
  };
  const signed = signSolTransfer(seed, approval);
  seed.fill(0);
  return { approval, signed };
}
type RpcCall = { method: string; params: unknown[]; id: number };
function mock(answer: (call: RpcCall) => unknown) {
  return vi.fn(async (_url: unknown, init: RequestInit) => {
    const call = JSON.parse(String(init.body)) as RpcCall;
    return Response.json({ jsonrpc: "2.0", id: call.id, result: answer(call) });
  }) as unknown as typeof fetch;
}
describe("devnet HTTP-only custody RPC", () => {
  it("preserves the global receiver for the default Worker fetch transport", async () => {
    const { approval } = fixture();
    const previous = globalThis.fetch;
    globalThis.fetch = async function (this: unknown, _input, init) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      const call = JSON.parse(String(init?.body)) as RpcCall;
      return Response.json({
        jsonrpc: "2.0",
        id: call.id,
        result:
          call.method === "getGenesisHash"
            ? DEVNET_GENESIS
            : call.method === "getLatestBlockhash"
              ? { value: { blockhash: approval.blockhash, lastValidBlockHeight: 99 } }
              : { value: 5000 },
      });
    };
    try {
      expect(await new DevnetHttpSolRpc("https://rpc.invalid").prepare(approval)).toEqual(approval);
    } finally {
      globalThis.fetch = previous;
    }
  });
  it("rejects missing HTTPS and URL credentials", () => {
    expect(() => new DevnetHttpSolRpc("http://rpc.invalid")).toThrow();
    expect(() => new DevnetHttpSolRpc("https://user:password@rpc.invalid")).toThrow();
  });
  it("prepares finalized blockhash and exact message fee without Connection construction", async () => {
    const { approval } = fixture();
    const transport = mock((call) => {
      if (call.method === "getGenesisHash") return DEVNET_GENESIS;
      if (call.method === "getLatestBlockhash") {
        expect(call.params).toEqual([{ commitment: "finalized" }]);
        return { value: { blockhash: approval.blockhash, lastValidBlockHeight: 99 } };
      }
      expect(call.method).toBe("getFeeForMessage");
      return { value: 5000 };
    });
    const rpc = new DevnetHttpSolRpc("https://rpc.invalid", transport);
    expect(await rpc.prepare(approval)).toEqual(approval);
  });
  it.each([null, -1, 1.5, 10001, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unavailable or invalid fee %s",
    async (fee) => {
      const { approval } = fixture();
      const rpc = new DevnetHttpSolRpc(
        "https://rpc.invalid",
        mock((call) => (call.method === "getGenesisHash" ? DEVNET_GENESIS : { value: fee })),
      );
      await expect(rpc.verifyFee(approval)).rejects.toThrow();
    },
  );
  it("never broadcasts when provider is not devnet", async () => {
    const { approval, signed } = fixture();
    const transport = mock((call) => {
      expect(call.method).toBe("getGenesisHash");
      return "wrong-chain";
    });
    await expect(
      new DevnetHttpSolRpc("https://rpc.invalid", transport).broadcast(signed, approval),
    ).rejects.toThrow("requires devnet");
  });
  it("broadcasts exact signed bytes with preflight and bounded retries", async () => {
    const { approval, signed } = fixture();
    const rpc = new DevnetHttpSolRpc(
      "https://rpc.invalid",
      mock((call) => {
        if (call.method === "getGenesisHash") return DEVNET_GENESIS;
        expect(call.method).toBe("sendTransaction");
        expect(call.params).toEqual([
          signed.wireBase64,
          {
            encoding: "base64",
            skipPreflight: false,
            preflightCommitment: "finalized",
            maxRetries: 2,
          },
        ]);
        return signed.signature;
      }),
    );
    expect(await rpc.broadcast(signed, approval)).toBe(signed.signature);
    await expect(rpc.broadcast(signed, { ...approval, lamports: "12346" })).rejects.toThrow(
      "differs",
    );
  });
  it("refuses a contradictory broadcast acknowledgment", async () => {
    const { approval, signed } = fixture();
    const rpc = new DevnetHttpSolRpc(
      "https://rpc.invalid",
      mock((call) =>
        call.method === "getGenesisHash" ? DEVNET_GENESIS : "not-the-signed-signature",
      ),
    );
    await expect(rpc.broadcast(signed, approval)).rejects.toThrow("acknowledgment mismatch");
  });
  it("counts only exact finalized wire proof and reports failed fee separately", async () => {
    const { approval, signed } = fixture();
    let transaction: unknown = null;
    const rpc = new DevnetHttpSolRpc(
      "https://rpc.invalid",
      mock((call) => {
        if (call.method === "getGenesisHash") return DEVNET_GENESIS;
        expect(call.params).toEqual([
          signed.signature,
          { encoding: "base64", commitment: "finalized", maxSupportedTransactionVersion: 0 },
        ]);
        return transaction;
      }),
    );
    expect(await rpc.inspect(signed, approval)).toEqual({ state: "pending" });
    transaction = {
      slot: 22,
      transaction: [signed.wireBase64, "base64"],
      meta: { fee: 5000, err: null },
    };
    expect(await rpc.inspect(signed, approval)).toEqual({
      state: "confirmed_exact_transfer",
      feeLamports: "5000",
      slot: 22,
    });
    transaction = {
      slot: 22,
      transaction: [signed.wireBase64, "base64"],
      meta: { fee: 5000, err: { InstructionError: [0, "failure"] } },
    };
    expect((await rpc.inspect(signed, approval)).state).toBe("finalized_failed");
    transaction = {
      slot: 22,
      transaction: [fixture().signed.wireBase64, "base64"],
      meta: { fee: 5000, err: null },
    };
    expect(await rpc.inspect(signed, approval)).toEqual({ state: "mismatch" });
  });
  it("redacts provider failure and performs no automatic retry", async () => {
    const transport = vi.fn(async () => {
      throw new Error("provider-secret-must-not-escape");
    }) as unknown as typeof fetch;
    await expect(
      new DevnetHttpSolRpc("https://rpc.invalid", transport).assertDevnetGenesis(),
    ).rejects.toThrow(/^Custody RPC unavailable or invalid\.$/);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized and mismatched JSON-RPC responses", async () => {
    const huge = (async () => new Response("x".repeat(131073))) as typeof fetch;
    await expect(
      new DevnetHttpSolRpc("https://rpc.invalid", huge).assertDevnetGenesis(),
    ).rejects.toThrow("unavailable or invalid");
    const badId = (async () =>
      Response.json({ jsonrpc: "2.0", id: -1, result: DEVNET_GENESIS })) as typeof fetch;
    await expect(
      new DevnetHttpSolRpc("https://rpc.invalid", badId).assertDevnetGenesis(),
    ).rejects.toThrow("unavailable or invalid");
  });
});
