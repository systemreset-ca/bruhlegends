import { admin, logAudit } from "./db.server";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","));
  return [header, ...body].join("\n");
}

/**
 * Everything BRUH holds about one membership, in a single CSV bundle. Scoped to
 * one group only — a member in three groups exports three separate files.
 */
export async function exportMemberData(membershipId: string): Promise<string> {
  const db = await admin();

  const { data: member } = await db
    .from("group_members")
    .select(
      "id, group_id, telegram_user_id, display_name, pseudonym, role, detection_opt_out, default_tip_privacy, joined_at, groups(title)",
    )
    .eq("id", membershipId)
    .maybeSingle();
  if (!member) throw new Error("Membership not found.");

  const [calls, tipsOut, tipsIn, wallets, disputes] = await Promise.all([
    db
      .from("calls")
      .select(
        "created_at, mint, symbol, status, baseline_price_usd, last_price_usd, ath_multiple, note",
      )
      .eq("caller_membership_id", membershipId)
      .order("created_at", { ascending: false }),
    db
      .from("tip_intents")
      .select("created_at, asset_symbol, amount_display, status, privacy")
      .eq("sender_membership_id", membershipId),
    db
      .from("tip_intents")
      .select("created_at, asset_symbol, amount_display, status, privacy")
      .eq("recipient_membership_id", membershipId),
    db
      .from("wallets")
      .select("address, status, verified_at, replaced_at")
      .eq("membership_id", membershipId),
    db
      .from("disputes")
      .select("created_at, reason, status, resolution")
      .eq("raised_by_membership_id", membershipId),
  ]);

  const sections = [
    `# profile (${member.groups?.title ?? "group"})`,
    toCsv(
      [
        {
          telegram_user_id: member.telegram_user_id,
          display_name: member.display_name,
          pseudonym: member.pseudonym,
          role: member.role,
          detection_opt_out: member.detection_opt_out,
          default_tip_privacy: member.default_tip_privacy,
          joined_at: member.joined_at,
        },
      ],
      [
        "telegram_user_id",
        "display_name",
        "pseudonym",
        "role",
        "detection_opt_out",
        "default_tip_privacy",
        "joined_at",
      ],
    ),
    "",
    "# calls",
    toCsv(calls.data ?? [], [
      "created_at",
      "mint",
      "symbol",
      "status",
      "baseline_price_usd",
      "last_price_usd",
      "ath_multiple",
      "note",
    ]),
    "",
    "# tips sent",
    toCsv(tipsOut.data ?? [], [
      "created_at",
      "asset_symbol",
      "amount_display",
      "status",
      "privacy",
    ]),
    "",
    "# tips received",
    toCsv(tipsIn.data ?? [], ["created_at", "asset_symbol", "amount_display", "status", "privacy"]),
    "",
    "# wallets",
    toCsv(wallets.data ?? [], ["address", "status", "verified_at", "replaced_at"]),
    "",
    "# disputes raised",
    toCsv(disputes.data ?? [], ["created_at", "reason", "status", "resolution"]),
    "",
  ];

  await logAudit({
    groupId: member.group_id,
    actorType: "member",
    actorId: membershipId,
    eventType: "data_exported",
    entityType: "group_member",
    entityId: membershipId,
  });

  return sections.join("\n");
}

/**
 * Right-to-be-forgotten. Calls stay in the ledger because other members' scores
 * and the group's history depend on them, but every identifier is severed:
 * wallet links revoked, display name replaced with a stable pseudonym, notes
 * and raw payloads cleared, detection turned off.
 */
export async function forgetMember(membershipId: string): Promise<{ pseudonym: string }> {
  const db = await admin();
  const { data: member } = await db
    .from("group_members")
    .select("id, group_id, telegram_user_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (!member) throw new Error("Membership not found.");

  const pseudonym = `anon-${membershipId.slice(0, 6)}`;

  await db
    .from("wallets")
    .update({ status: "revoked", replaced_at: new Date().toISOString() })
    .eq("membership_id", membershipId)
    .neq("status", "revoked");
  await db.from("wallet_challenges").delete().eq("membership_id", membershipId);

  await db
    .from("group_members")
    .update({
      display_name: pseudonym,
      pseudonym,
      detection_opt_out: true,
      default_tip_privacy: "anonymous",
    })
    .eq("id", membershipId);

  await db.from("calls").update({ note: null }).eq("caller_membership_id", membershipId);

  await logAudit({
    groupId: member.group_id,
    actorType: "member",
    actorId: membershipId,
    eventType: "member_forgotten",
    entityType: "group_member",
    entityId: membershipId,
  });

  return { pseudonym };
}

export type ModeratorRow = { membershipId: string; displayName: string; role: string };

export async function listModerators(groupId: string): Promise<ModeratorRow[]> {
  const db = await admin();
  const { data } = await db
    .from("group_members")
    .select("id, display_name, role")
    .eq("group_id", groupId)
    .in("role", ["moderator", "admin"])
    .order("role", { ascending: true });
  return (data ?? []).map((row: any) => ({
    membershipId: row.id as string,
    displayName: (row.display_name ?? "member") as string,
    role: row.role as string,
  }));
}

export async function setMemberRole(input: {
  groupId: string;
  membershipId: string;
  role: "member" | "moderator" | "admin";
  actorMembershipId: string;
}) {
  const db = await admin();
  const { data: before } = await db
    .from("group_members")
    .select("id, role, display_name")
    .eq("id", input.membershipId)
    .eq("group_id", input.groupId)
    .maybeSingle();
  if (!before) return { ok: false as const };

  await db.from("group_members").update({ role: input.role }).eq("id", input.membershipId);
  await logAudit({
    groupId: input.groupId,
    actorType: "admin",
    actorId: input.actorMembershipId,
    eventType: "member_role_changed",
    entityType: "group_member",
    entityId: input.membershipId,
    before: { role: before.role },
    after: { role: input.role },
  });
  return { ok: true as const, displayName: (before.display_name ?? "member") as string };
}

/** Operational snapshot for admins: is the bot working, and on what. */
export async function groupStatus(groupId: string) {
  const db = await admin();
  const [members, activeCalls, pendingTips, openDisputes, queued, lastObservation, season] =
    await Promise.all([
      db.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", groupId),
      db
        .from("calls")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("status", "active"),
      db
        .from("tip_intents")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .in("status", ["created", "awaiting_payment"]),
      db
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("status", "open"),
      db
        .from("announcement_queue")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .is("sent_at", null),
      db
        .from("calls")
        .select("last_observed_at")
        .eq("group_id", groupId)
        .not("last_observed_at", "is", null)
        .order("last_observed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("seasons").select("name").eq("group_id", groupId).eq("is_active", true).maybeSingle(),
    ]);

  return {
    members: members.count ?? 0,
    activeCalls: activeCalls.count ?? 0,
    pendingTips: pendingTips.count ?? 0,
    openDisputes: openDisputes.count ?? 0,
    queuedAnnouncements: queued.count ?? 0,
    lastPriceRefresh: (lastObservation.data?.last_observed_at ?? null) as string | null,
    activeSeason: (season.data?.name ?? null) as string | null,
  };
}
