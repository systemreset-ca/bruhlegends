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
    value: {
      account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } };
    }[];
  }>("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
  return result.value.reduce(
    (total, entry) => total + (entry.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
    0,
  );
}

export type ParsedTransaction = {
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
 * Pure: how much the expected recipient gained in the expected asset. Returns
 * null when the recipient never appears, so a transaction that paid someone
 * else — or moved a different mint — can never be read as a match.
 */
export function recipientDelta(
  tx: ParsedTransaction,
  recipient: string,
  mint: string | null,
): bigint | null {
  if (!tx.meta) return null;

  if (mint) {
    const matches = (balance: { owner?: string; mint: string }) =>
      balance.owner === recipient && balance.mint === mint;
    const before = tx.meta.preTokenBalances?.find(matches);
    const after = tx.meta.postTokenBalances?.find(matches);
    if (!before && !after) return null;
    return BigInt(after?.uiTokenAmount.amount ?? "0") - BigInt(before?.uiTokenAmount.amount ?? "0");
  }

  const index = tx.transaction.message.accountKeys.findIndex((key) => key.pubkey === recipient);
  if (index < 0) return null;
  return BigInt(tx.meta.postBalances[index] ?? 0) - BigInt(tx.meta.preBalances[index] ?? 0);
}

export function transferAmountMatches(
  actual: bigint,
  expected: bigint,
  tolerance: bigint = 0n,
): boolean {
  if (actual < 0n || expected < 0n || tolerance < 0n) return false;
  const difference = actual >= expected ? actual - expected : expected - actual;
  return difference <= tolerance;
}

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
  const signatures = await rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [
    input.reference,
    { limit: 10 },
  ]);
  if (signatures.length === 0) return { verified: false, reason: "no_transaction_found" };

  const tolerance = input.toleranceBaseUnits ?? 0n;
  let mismatch: TransferVerification | null = null;

  for (const entry of signatures) {
    if (entry.err) continue;
    const tx = await rpc<ParsedTransaction | null>("getTransaction", [
      entry.signature,
      { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
    ]);
    if (!tx?.meta || tx.meta.err) continue;

    const delta = recipientDelta(tx, input.recipient, input.mint);
    if (delta === null) {
      mismatch ??= {
        verified: false,
        reason: "recipient_not_credited",
        signature: entry.signature,
      };
      continue;
    }

    if (transferAmountMatches(delta, input.amountBaseUnits, tolerance)) {
      return { verified: true, signature: entry.signature, slot: tx.slot, raw: tx.meta };
    }
    mismatch = { verified: false, reason: "amount_mismatch", signature: entry.signature };
  }

  return mismatch ?? { verified: false, reason: "no_confirmed_matching_transaction" };
}
