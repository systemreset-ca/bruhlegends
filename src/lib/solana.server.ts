import bs58 from "bs58";
import { randomBytes } from "node:crypto";
import { getBruhConfig } from "./bruh-config.server";

type RpcResult<T> = { result?: T; error?: { code: number; message: string } };

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const { rpcUrl } = getBruhConfig();
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Solana RPC ${method} failed [${response.status}]: ${body}`);
    throw new Error(`Solana RPC failed [${response.status}]`);
  }
  const json = (await response.json()) as RpcResult<T>;
  if (json.error) {
    console.error(`Solana RPC ${method} error: ${json.error.message}`);
    throw new Error(`Solana RPC error: ${json.error.message}`);
  }
  return json.result as T;
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

/** A Solana Pay reference is any 32-byte public key; it is never signed with. */
export function createReferenceKey(): string {
  return bs58.encode(randomBytes(32));
}

export function buildSolanaPayUrl(input: {
  recipient: string;
  amountDisplay: number;
  reference: string;
  splToken?: string | null;
  label?: string;
  message?: string;
}): string {
  const params = new URLSearchParams();
  params.set("amount", String(input.amountDisplay));
  params.set("reference", input.reference);
  if (input.splToken) params.set("spl-token", input.splToken);
  params.set("label", input.label ?? "BRUH");
  params.set("message", input.message ?? "BRUH tip");
  return `solana:${input.recipient}?${params.toString()}`;
}

export async function getSolBalance(address: string): Promise<number> {
  const result = await rpc<{ value: number }>("getBalance", [address]);
  return result.value / 1_000_000_000;
}

export async function getTokenBalance(owner: string, mint: string): Promise<number> {
  const result = await rpc<{
    value: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } }[];
  }>("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
  return result.value.reduce(
    (total, entry) => total + (entry.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
    0,
  );
}

type ParsedTransaction = {
  slot: number;
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: { owner?: string; mint: string; uiTokenAmount: { amount: string } }[];
    postTokenBalances?: { owner?: string; mint: string; uiTokenAmount: { amount: string } }[];
  } | null;
  transaction: { message: { accountKeys: { pubkey: string }[] } };
};

export type TransferVerification = {
  verified: boolean;
  reason?: string;
  signature?: string;
  slot?: number;
  raw?: unknown;
};

/**
 * Server-side verification: a tip counts only when a confirmed transaction
 * carrying the intent's reference key moved the expected mint and amount to the
 * expected recipient. Nothing the client sends can substitute for this.
 */
export async function verifyTransferByReference(input: {
  reference: string;
  recipient: string;
  mint: string | null;
  amountBaseUnits: bigint;
  /** Allowed shortfall in base units (0 = exact). */
  toleranceBaseUnits?: bigint;
}): Promise<TransferVerification> {
  const signatures = await rpc<{ signature: string; err: unknown }[]>(
    "getSignaturesForAddress",
    [input.reference, { limit: 10 }],
  );
  if (signatures.length === 0) return { verified: false, reason: "no_transaction_found" };

  const tolerance = input.toleranceBaseUnits ?? 0n;

  for (const entry of signatures) {
    if (entry.err) continue;
    const tx = await rpc<ParsedTransaction | null>("getTransaction", [
      entry.signature,
      { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
    ]);
    if (!tx?.meta || tx.meta.err) continue;

    let delta = 0n;
    if (input.mint) {
      const before =
        tx.meta.preTokenBalances?.find(
          (balance) => balance.owner === input.recipient && balance.mint === input.mint,
        )?.uiTokenAmount.amount ?? "0";
      const after =
        tx.meta.postTokenBalances?.find(
          (balance) => balance.owner === input.recipient && balance.mint === input.mint,
        )?.uiTokenAmount.amount ?? "0";
      delta = BigInt(after) - BigInt(before);
    } else {
      const index = tx.transaction.message.accountKeys.findIndex(
        (key) => key.pubkey === input.recipient,
      );
      if (index < 0) continue;
      delta =
        BigInt(tx.meta.postBalances[index] ?? 0) - BigInt(tx.meta.preBalances[index] ?? 0);
    }

    if (delta + tolerance >= input.amountBaseUnits) {
      return { verified: true, signature: entry.signature, slot: tx.slot, raw: tx.meta };
    }
    return { verified: false, reason: "amount_mismatch", signature: entry.signature };
  }

  return { verified: false, reason: "no_confirmed_matching_transaction" };
}
