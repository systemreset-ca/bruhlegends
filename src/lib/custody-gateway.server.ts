import bs58 from "bs58";
import { signBridgeRequest } from "../../services/custody-signer/bridge-auth";
import { resolveSession, verifyInitData, type MiniAppSession } from "./session.server";
import { admin } from "./db.server";

const SIGNER_ORIGIN = "https://bruh-devnet-guardian.lovable.app";
const PATH = "/api/internal/custody/provision";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Approval = {
  approved: true;
  groupId: string;
  membershipId: string;
  telegramChatId: string;
  telegramUserId: string;
};
type Wallet = {
  walletId: string;
  address: string;
  network: "devnet";
  wrappingKeyVersion: string;
  frozen: true;
};
export type CustodyGatewayOutcome =
  | { ok: true; created: boolean; wallet: Wallet }
  | {
      ok: false;
      reason:
        | "disabled"
        | "configuration_unavailable"
        | "unauthorized"
        | "membership_denied"
        | "signer_unavailable";
    };
type Input = { session: string; membershipId: string; initData: string };
export type CustodyGatewayDeps = {
  enabled: boolean;
  callerSecret: string | undefined;
  callerKeyId: string | undefined;
  signerOrigin: string | undefined;
  session(token: string): Promise<MiniAppSession | null>;
  telegram(initData: string): number | null;
  membership(userId: number, membershipId: string): Promise<Approval | null>;
  transport: typeof fetch;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function telegramId(v: unknown, signed = false): v is string {
  if (typeof v !== "string" || !(signed ? /^-?[1-9][0-9]*$/ : /^[1-9][0-9]*$/).test(v))
    return false;
  const value = BigInt(v);
  return value >= -4_503_599_627_370_495n && value <= 4_503_599_627_370_495n;
}

/** Denied-by-default application caller. Client supplies only session, raw
 * Telegram proof and owned membership selection. Approval UUIDs/chat/user are
 * resolved from server records, never forwarded from client approval claims. */
export async function provisionThroughCustodyGateway(
  input: Input,
  deps: CustodyGatewayDeps,
): Promise<CustodyGatewayOutcome> {
  if (deps.enabled !== true) return { ok: false, reason: "disabled" };
  if (
    !deps.callerSecret ||
    deps.callerSecret.length < 64 ||
    !deps.callerKeyId ||
    !/^[A-Za-z0-9._-]{1,64}$/.test(deps.callerKeyId) ||
    deps.signerOrigin !== SIGNER_ORIGIN
  )
    return { ok: false, reason: "configuration_unavailable" };
  let approval: Approval;
  try {
    if (
      !UUID.test(input.membershipId) ||
      typeof input.initData !== "string" ||
      input.initData.length === 0 ||
      Buffer.byteLength(input.initData) > 4096
    )
      return { ok: false, reason: "unauthorized" };
    const session = await deps.session(input.session);
    const userId = deps.telegram(input.initData);
    if (
      !session ||
      !Number.isSafeInteger(userId) ||
      !userId ||
      userId <= 0 ||
      userId > 4_503_599_627_370_495 ||
      session.telegramUserId !== userId
    )
      return { ok: false, reason: "unauthorized" };
    const member = await deps.membership(userId, input.membershipId.toLowerCase());
    if (
      !member ||
      member.approved !== true ||
      !UUID.test(member.groupId) ||
      member.membershipId !== input.membershipId.toLowerCase() ||
      !telegramId(member.telegramChatId, true) ||
      !telegramId(member.telegramUserId) ||
      member.telegramUserId !== String(userId) ||
      (session.groupId !== null && session.groupId !== member.groupId)
    )
      return { ok: false, reason: "membership_denied" };
    approval = {
      approved: true,
      groupId: member.groupId,
      membershipId: member.membershipId,
      telegramChatId: member.telegramChatId,
      telegramUserId: member.telegramUserId,
    };
  } catch {
    return { ok: false, reason: "unauthorized" };
  }

  const rawBody = JSON.stringify({
    version: 1,
    telegram_init_data: input.initData,
    telegram_chat_id: approval.telegramChatId,
    membership_approval: approval,
  });
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 5000);
  try {
    const headers = signBridgeRequest({
      secret: deps.callerSecret,
      keyId: deps.callerKeyId,
      path: PATH,
      rawBody,
    });
    const response = await deps.transport(`${SIGNER_ORIGIN}${PATH}`, {
      method: "POST",
      headers,
      body: rawBody,
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new Error();
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const result: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (
      !object(result) ||
      Object.keys(result).sort().join(",") !== "created,ok,wallet" ||
      result["ok"] !== true ||
      typeof result["created"] !== "boolean" ||
      !object(result["wallet"])
    )
      throw new Error();
    const w = result["wallet"];
    if (
      Object.keys(w).sort().join(",") !== "address,frozen,network,walletId,wrappingKeyVersion" ||
      typeof w["walletId"] !== "string" ||
      !UUID.test(w["walletId"]) ||
      typeof w["address"] !== "string" ||
      bs58.decode(w["address"]).length !== 32 ||
      w["network"] !== "devnet" ||
      w["frozen"] !== true ||
      typeof w["wrappingKeyVersion"] !== "string" ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(w["wrappingKeyVersion"])
    )
      throw new Error();
    return {
      ok: true,
      created: result["created"],
      wallet: {
        walletId: w["walletId"],
        address: w["address"],
        network: "devnet",
        frozen: true,
        wrappingKeyVersion: w["wrappingKeyVersion"],
      },
    };
  } catch {
    return { ok: false, reason: "signer_unavailable" };
  } finally {
    clearTimeout(deadline);
  }
}

/** Not called by the UI or bot. Enable flag and caller configuration are absent
 * by default; the corresponding signer receiver is not deployed. */
export async function provisionMyDevnetCustodyWallet(input: Input) {
  return provisionThroughCustodyGateway(input, {
    enabled: process.env["BRUH_CUSTODY_DEVNET_ENABLED"] === "true",
    callerSecret: process.env["BRUH_SIGNER_CALLER_SECRET"],
    callerKeyId: process.env["BRUH_SIGNER_CALLER_KEY_ID"],
    signerOrigin: process.env["BRUH_SIGNER_ORIGIN"],
    session: resolveSession,
    telegram: (raw) => verifyInitData(raw, 300),
    async membership(userId, membershipId) {
      const db = await admin();
      const { data, error } = await db
        .from("group_members")
        .select("id,group_id,telegram_user_id,is_banned,groups(id,telegram_chat_id)")
        .eq("id", membershipId)
        .eq("telegram_user_id", userId)
        .eq("is_banned", false)
        .maybeSingle();
      if (
        error ||
        !data ||
        data.is_banned !== false ||
        !data.groups ||
        data.groups.id !== data.group_id
      )
        return null;
      return {
        approved: true,
        groupId: data.group_id,
        membershipId: data.id,
        telegramChatId: String(data.groups.telegram_chat_id),
        telegramUserId: String(data.telegram_user_id),
      };
    },
    transport: (input, init) => globalThis.fetch(input, init),
  });
}
