import { createHash } from "node:crypto";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519";
import { resolveSession } from "./session.server";
import { admin } from "./db.server";
import {
  createWalletChallenge,
  completeWalletChallenge,
  getActiveWallet,
  revokeWallets,
} from "./wallets.server";
import { getLeaderboard } from "./scoring.server";

async function requireSession(session: string) {
  const resolved = await resolveSession(session);
  if (!resolved) throw new Error("Session expired. Re-open the link from the bot.");
  return resolved;
}

/** Every membership the caller owns; nothing outside their own Telegram id. */
async function ownedMembership(telegramUserId: number, membershipId: string) {
  const db = await admin();
  const { data } = await db
    .from("group_members")
    .select("id, group_id, display_name, telegram_user_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!data || Number(data.telegram_user_id) !== telegramUserId) {
    throw new Error("That group membership isn't yours.");
  }
  return data;
}

export async function loadProfile(session: string) {
  const { telegramUserId } = await requireSession(session);
  const db = await admin();
  const { data: memberships } = await db
    .from("group_members")
    .select("id, display_name, group_id, groups(title)")
    .eq("telegram_user_id", telegramUserId)
    .eq("is_banned", false);

  const groups = await Promise.all(
    (memberships ?? []).map(async (row: any) => ({
      membershipId: row.id,
      groupId: row.group_id,
      title: row.groups?.title ?? "Group",
      displayName: row.display_name,
      wallet: await getActiveWallet(row.id),
    })),
  );

  return { telegramUserId, groups };
}

export async function startWalletLink(input: {
  session: string;
  membershipId: string;
  address: string;
}) {
  const { telegramUserId } = await requireSession(input.session);
  await ownedMembership(telegramUserId, input.membershipId);
  const result = await createWalletChallenge(input.membershipId, input.address);
  if (!result.ok) throw new Error("That doesn't look like a Solana address.");
  return result.challenge;
}

export async function finishWalletLink(input: {
  session: string;
  membershipId: string;
  challengeId: string;
  signature: string;
}) {
  const { telegramUserId } = await requireSession(input.session);
  await ownedMembership(telegramUserId, input.membershipId);

  const db = await admin();
  const { data: challenge } = await db
    .from("wallet_challenges")
    .select("address, message")
    .eq("id", input.challengeId)
    .eq("membership_id", input.membershipId)
    .maybeSingle();
  if (!challenge) throw new Error("Verification request not found.");

  // Ed25519 proof against the address itself — no trust in the client.
  let valid = false;
  try {
    valid = ed25519.verify(
      bs58.decode(input.signature),
      new TextEncoder().encode(challenge.message),
      bs58.decode(challenge.address),
    );
  } catch {
    valid = false;
  }
  if (!valid) throw new Error("Signature doesn't match that address.");

  const completed = await completeWalletChallenge({
    challengeId: input.challengeId,
    membershipId: input.membershipId,
    signatureHash: createHash("sha256").update(input.signature).digest("hex"),
    method: "ed25519_message",
  });
  if (!completed.ok) throw new Error("This verification link is no longer valid.");
  return { address: completed.address };
}

export async function unlinkWallet(input: { session: string; membershipId: string }) {
  const { telegramUserId } = await requireSession(input.session);
  await ownedMembership(telegramUserId, input.membershipId);
  await revokeWallets(input.membershipId);
  return { ok: true };
}

export async function loadGroupBoard(input: { session: string; membershipId: string }) {
  const { telegramUserId } = await requireSession(input.session);
  const membership = await ownedMembership(telegramUserId, input.membershipId);
  const db = await admin();

  const [board, calls] = await Promise.all([
    getLeaderboard(membership.group_id, 10),
    db
      .from("calls")
      .select("symbol, mint, baseline_price_usd, last_price_usd, ath_multiple, group_members(display_name)")
      .eq("group_id", membership.group_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    leaderboard: board,
    calls: (calls.data ?? []).map((call: any) => ({
      symbol: call.symbol ?? call.mint.slice(0, 6),
      caller: call.group_members?.display_name ?? "member",
      current:
        Number(call.baseline_price_usd) > 0
          ? Number(call.last_price_usd ?? 0) / Number(call.baseline_price_usd)
          : 0,
      peak: Number(call.ath_multiple ?? 1),
    })),
  };
}
