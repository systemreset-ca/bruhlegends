import bs58 from "bs58";
import { verifyBridgeRequest, type BridgeNonceConsumer } from "./bridge-auth";

const PATH = "/api/internal/custody/provision";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type VerifiedProvisionScope = Readonly<{
  groupId: string;
  membershipId: string;
  telegramChatId: string;
  telegramUserId: string;
  network: "devnet";
}>;
type PublicWallet = {
  walletId: string;
  address: string;
  network: "devnet";
  wrappingKeyVersion: string;
  frozen: true;
};
export type BridgeReceiverDeps = {
  enabled: boolean;
  expectedKeyId: string | undefined;
  expectedPublicKey: string | undefined;
  consumeNonce: BridgeNonceConsumer | null | undefined;
  /** Guardian production must use its pinned Telegram production Ed25519 verifier.
   * The callback independently checks freshness and returns only the verified ID. */
  verifyTelegram(raw: string, now: number): string | null;
  /** Signer-owned frozen-wallet service. No envelope or key may leave this callback. */
  provision(scope: VerifiedProvisionScope): Promise<{ created: boolean; wallet: PublicWallet }>;
  clock?: () => number;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function exact(v: Record<string, unknown>, keys: string[]) {
  return Object.keys(v).sort().join(",") === keys.sort().join(",");
}
function id(v: unknown, chat = false): v is string {
  if (
    typeof v !== "string" ||
    !(chat ? /^-?[1-9][0-9]*$/ : /^[1-9][0-9]*$/).test(v) ||
    v.length > 17
  )
    return false;
  const n = BigInt(v);
  return n >= -4_503_599_627_370_495n && n <= 4_503_599_627_370_495n;
}
function scope(raw: string, deps: BridgeReceiverDeps, now: number): VerifiedProvisionScope | null {
  const body: unknown = JSON.parse(raw);
  if (
    !object(body) ||
    !exact(body, ["version", "telegram_init_data", "telegram_chat_id", "membership_approval"]) ||
    body["version"] !== 1
  )
    return null;
  const init = body["telegram_init_data"];
  const approval = body["membership_approval"];
  if (
    typeof init !== "string" ||
    !init ||
    Buffer.byteLength(init) > 4096 ||
    !id(body["telegram_chat_id"], true) ||
    !object(approval) ||
    !exact(approval, ["approved", "groupId", "membershipId", "telegramChatId", "telegramUserId"]) ||
    approval["approved"] !== true ||
    typeof approval["groupId"] !== "string" ||
    !UUID.test(approval["groupId"]) ||
    typeof approval["membershipId"] !== "string" ||
    !UUID.test(approval["membershipId"]) ||
    !id(approval["telegramChatId"], true) ||
    !id(approval["telegramUserId"]) ||
    approval["telegramChatId"] !== body["telegram_chat_id"]
  )
    return null;
  const user = deps.verifyTelegram(init, now);
  if (!id(user) || user !== approval["telegramUserId"]) return null;
  // Only the pinned BRUH backend can sign this exact approval. That backend must
  // have resolved its session and current non-banned membership before signing.
  return Object.freeze({
    groupId: approval["groupId"].toLowerCase(),
    membershipId: approval["membershipId"].toLowerCase(),
    telegramChatId: approval["telegramChatId"],
    telegramUserId: user,
    network: "devnet" as const,
  });
}
function reply(status: number, value: unknown) {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}
function publicWallet(v: unknown): v is PublicWallet {
  if (
    !object(v) ||
    !exact(v, ["walletId", "address", "network", "wrappingKeyVersion", "frozen"]) ||
    typeof v["walletId"] !== "string" ||
    !UUID.test(v["walletId"]) ||
    typeof v["address"] !== "string" ||
    v["network"] !== "devnet" ||
    v["frozen"] !== true ||
    typeof v["wrappingKeyVersion"] !== "string" ||
    !/^[A-Za-z0-9._-]{1,64}$/.test(v["wrappingKeyVersion"])
  )
    return false;
  try {
    return bs58.decode(v["address"]).length === 32;
  } catch {
    return false;
  }
}
/** Dormant receiver factory, not an active route. One durable nonce claim precedes
 * all Telegram, approval and vault work. Missing policy/configuration denies.
 * No HMAC bypass, user seed, transaction signing, funding or withdrawal path. */
export async function receiveProvisionBridge(
  request: Request,
  deps: BridgeReceiverDeps,
): Promise<Response> {
  if (deps.enabled !== true) return reply(404, { ok: false });
  if (request.method !== "POST" || new URL(request.url).pathname !== PATH)
    return reply(401, { ok: false });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    if (!request.body) return reply(401, { ok: false });
    reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 8192) {
        await reader.cancel();
        return reply(401, { ok: false });
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const clock = deps.clock ?? Date.now;
    if (
      !(await verifyBridgeRequest({
        method: request.method,
        path: PATH,
        headers: request.headers,
        rawBody,
        expectedKeyId: deps.expectedKeyId,
        expectedPublicKey: deps.expectedPublicKey,
        consumeNonce: deps.consumeNonce,
        clock,
      }))
    )
      return reply(401, { ok: false });
    const approved = scope(rawBody, deps, clock());
    if (!approved) return reply(401, { ok: false });
    const result: unknown = await deps.provision(approved);
    // Never serialize arbitrary storage/vault results or their envelopes.
    if (
      !object(result) ||
      !exact(result, ["created", "wallet"]) ||
      typeof result["created"] !== "boolean" ||
      !publicWallet(result["wallet"])
    )
      return reply(503, { ok: false });
    const w = result["wallet"];
    return reply(200, {
      ok: true,
      created: result["created"],
      wallet: {
        walletId: w.walletId,
        address: w.address,
        network: "devnet",
        wrappingKeyVersion: w.wrappingKeyVersion,
        frozen: true,
      },
    });
  } catch {
    return reply(503, { ok: false });
  } finally {
    reader?.releaseLock();
  }
}
