import { admin, logAudit } from "./db.server";
import { isValidSolanaAddress } from "./solana.server";
import { newToken } from "./session.server";
import { getBruhConfig } from "./bruh-config.server";

export type WalletChallenge = { challengeId: string; nonce: string; message: string };

/**
 * Ownership proof is required before an address can receive tips: the member
 * signs a nonce message with the wallet's own key. The bot never sees a key.
 */
export async function createWalletChallenge(
  membershipId: string,
  address: string,
): Promise<{ ok: true; challenge: WalletChallenge } | { ok: false; reason: string }> {
  if (!isValidSolanaAddress(address)) return { ok: false, reason: "invalid_address" };
  const db = await admin();
  const nonce = newToken();
  const message = [
    "BRUH wallet verification",
    `address: ${address}`,
    `nonce: ${nonce}`,
    "Signing proves you control this wallet. It never moves funds.",
  ].join("\n");

  const { data, error } = await db
    .from("wallet_challenges")
    .insert({
      membership_id: membershipId,
      address,
      nonce,
      message,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;

  return { ok: true, challenge: { challengeId: data.id, nonce, message } };
}

export async function completeWalletChallenge(input: {
  challengeId: string;
  membershipId: string;
  signatureHash: string;
  method: string;
}): Promise<{ ok: true; address: string } | { ok: false; reason: string }> {
  const db = await admin();
  const { data: challenge } = await db
    .from("wallet_challenges")
    .select("*")
    .eq("id", input.challengeId)
    .eq("membership_id", input.membershipId)
    .maybeSingle();

  if (!challenge) return { ok: false, reason: "challenge_not_found" };
  if (challenge.consumed_at) return { ok: false, reason: "challenge_used" };
  if (new Date(challenge.expires_at) < new Date()) return { ok: false, reason: "challenge_expired" };

  const { walletReplacementDelayMinutes } = getBruhConfig();
  const now = new Date();

  const { data: current } = await db
    .from("wallets")
    .select("id, address")
    .eq("membership_id", input.membershipId)
    .eq("status", "verified")
    .maybeSingle();

  // Replacing an active wallet is delayed: an attacker who briefly controls an
  // account cannot redirect tips instantly.
  const activeFrom = current
    ? new Date(now.getTime() + walletReplacementDelayMinutes * 60_000)
    : now;

  if (current) {
    await db.from("wallets").update({ status: "pending_replacement" }).eq("id", current.id);
  }

  await db.from("wallets").insert({
    membership_id: input.membershipId,
    address: challenge.address,
    status: "verified",
    verification_method: input.method,
    signature_hash: input.signatureHash,
    nonce: challenge.nonce,
    verified_at: now.toISOString(),
    active_from: activeFrom.toISOString(),
  });

  await db
    .from("wallet_challenges")
    .update({ consumed_at: now.toISOString() })
    .eq("id", challenge.id);

  await logAudit({
    actorType: "member",
    actorId: input.membershipId,
    eventType: "wallet_verified",
    entityType: "wallet",
    entityId: challenge.address,
  });

  return { ok: true, address: challenge.address };
}

/** Returns the payout address only when it is verified and past its delay. */
export async function getActiveWallet(membershipId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("wallets")
    .select("address, active_from")
    .eq("membership_id", membershipId)
    .eq("status", "verified")
    .lte("active_from", new Date().toISOString())
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.address ?? null;
}

export async function revokeWallets(membershipId: string) {
  const db = await admin();
  await db
    .from("wallets")
    .update({ status: "revoked", replaced_at: new Date().toISOString() })
    .eq("membership_id", membershipId)
    .in("status", ["verified", "pending_replacement"]);
  await logAudit({
    actorType: "member",
    actorId: membershipId,
    eventType: "wallet_revoked",
    entityType: "wallet",
  });
}
