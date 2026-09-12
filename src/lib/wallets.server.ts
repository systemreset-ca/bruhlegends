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
  const { walletReplacementDelayMinutes } = getBruhConfig();
  const { data, error } = await db.rpc("complete_wallet_challenge", {
    p_challenge_id: input.challengeId,
    p_membership_id: input.membershipId,
    p_signature_hash: input.signatureHash,
    p_verification_method: input.method,
    p_replacement_delay_minutes: walletReplacementDelayMinutes,
  });
  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  return result?.wallet_address
    ? { ok: true, address: result.wallet_address }
    : { ok: false, reason: "challenge_invalid" };
}

/** Returns the payout address only when it is verified and past its delay. */
export async function getActiveWallet(membershipId: string): Promise<string | null> {
  const db = await admin();
  const now = new Date().toISOString();
  const { data } = await db
    .from("wallets")
    .select("address, active_from")
    .eq("membership_id", membershipId)
    .in("status", ["verified", "pending_replacement"])
    .lte("active_from", now)
    .or(`replaced_at.is.null,replaced_at.gt.${now}`)
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
