import { admin } from "./db.server";

export type GroupAnnounceSettings = {
  id: string;
  telegram_chat_id: number;
  is_paused: boolean;
  removed_at: string | null;
  announce_tips: boolean;
  announcement_mode: string;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
};

/** Hour-of-day (UTC) window; supports windows that wrap past midnight. */
export function inQuietHours(
  start: number | null | undefined,
  end: number | null | undefined,
  now = new Date(),
): boolean {
  if (start === null || start === undefined || end === null || end === undefined) return false;
  if (start === end) return false;
  const hour = now.getUTCHours();
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export type AnnounceKind = "milestone" | "tip";

/**
 * Single gate for every group broadcast: removed groups, paused groups,
 * per-kind switches, digest/off modes and quiet hours all stop here.
 */
export function canAnnounce(group: GroupAnnounceSettings | null, kind: AnnounceKind): boolean {
  if (!group) return false;
  if (group.removed_at) return false;
  if (group.is_paused) return false;
  if (kind === "tip" && !group.announce_tips) return false;
  const mode = group.announcement_mode ?? "immediate";
  if (mode === "off") return false;
  if (mode !== "immediate") return false; // digest modes are collected, not pushed
  return !inQuietHours(group.quiet_hours_start, group.quiet_hours_end);
}

export async function loadGroupAnnounceSettings(
  groupId: string,
): Promise<GroupAnnounceSettings | null> {
  const db = await admin();
  const { data } = await db
    .from("groups")
    .select(
      "id, telegram_chat_id, is_paused, removed_at, announce_tips, announcement_mode, quiet_hours_start, quiet_hours_end",
    )
    .eq("id", groupId)
    .maybeSingle();
  return (data as GroupAnnounceSettings | null) ?? null;
}

export type TipPrivacy = "public" | "pseudonymous" | "anonymous" | "private";

/** Resolves the name shown publicly for a member under a privacy mode. */
export function publicName(
  privacy: TipPrivacy,
  member: { display_name?: string | null; pseudonym?: string | null; id: string },
): string | null {
  switch (privacy) {
    case "private":
      return null;
    case "anonymous":
      return "someone";
    case "pseudonymous":
      return member.pseudonym ?? `member-${member.id.slice(0, 4)}`;
    default:
      return member.display_name ?? "a member";
  }
}
