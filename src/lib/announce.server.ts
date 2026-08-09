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
export type AnnounceDecision = "send" | "queue" | "drop";

/**
 * Single gate for every group broadcast. Nothing is silently lost: digest modes
 * and quiet hours queue the message instead of dropping it, and only a hard
 * "off" (or a removed/paused group) discards it.
 */
export function announceDecision(
  group: GroupAnnounceSettings | null,
  kind: AnnounceKind,
  now = new Date(),
): AnnounceDecision {
  if (!group) return "drop";
  if (group.removed_at) return "drop";
  if (group.is_paused) return "drop";
  if (kind === "tip" && !group.announce_tips) return "drop";

  const mode = group.announcement_mode ?? "immediate";
  if (mode === "off") return "drop";
  if (mode === "hourly" || mode === "daily") return "queue";
  if (mode !== "immediate") return "drop";

  return inQuietHours(group.quiet_hours_start, group.quiet_hours_end, now) ? "queue" : "send";
}

/** Kept for callers that only need the immediate-send answer. */
export function canAnnounce(group: GroupAnnounceSettings | null, kind: AnnounceKind): boolean {
  return announceDecision(group, kind) === "send";
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

/**
 * Routes one broadcast: sends it now, parks it in the digest queue, or drops it.
 * `dedupeKey` makes re-runs of the scheduler idempotent.
 */
export async function dispatchAnnouncement(input: {
  group: GroupAnnounceSettings | null;
  kind: AnnounceKind;
  body: string;
  dedupeKey?: string | null;
}): Promise<AnnounceDecision> {
  const decision = announceDecision(input.group, input.kind);
  if (decision === "drop" || !input.group) return "drop";

  if (decision === "send") {
    const { sendMessage } = await import("./telegram.server");
    await sendMessage(input.group.telegram_chat_id, input.body);
    return "send";
  }

  const db = await admin();
  await db.from("announcement_queue").upsert(
    {
      group_id: input.group.id,
      kind: input.kind,
      body: input.body,
      dedupe_key: input.dedupeKey ?? null,
    },
    { onConflict: "group_id,dedupe_key", ignoreDuplicates: true },
  );
  return "queue";
}

const DIGEST_WINDOW_MS: Record<string, number> = {
  hourly: 60 * 60_000,
  daily: 24 * 60 * 60_000,
};

/**
 * Releases queued announcements. Digest groups flush once their window has
 * elapsed since the oldest queued item; immediate groups flush the moment
 * quiet hours end. Paused, removed and "off" groups never flush.
 */
export async function flushDigests(now = new Date()): Promise<{ groups: number; sent: number }> {
  const db = await admin();
  const { sendMessage } = await import("./telegram.server");

  const { data: pending } = await db
    .from("announcement_queue")
    .select("id, group_id, kind, body, created_at")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  const byGroup = new Map<string, { id: string; body: string; created_at: string }[]>();
  for (const row of pending ?? []) {
    const list = byGroup.get(row.group_id) ?? [];
    list.push({ id: row.id, body: row.body, created_at: row.created_at });
    byGroup.set(row.group_id, list);
  }

  let sent = 0;
  let groupsFlushed = 0;

  for (const [groupId, items] of byGroup) {
    const group = await loadGroupAnnounceSettings(groupId);
    if (!group || group.removed_at || group.is_paused) continue;

    const mode = group.announcement_mode ?? "immediate";
    if (mode === "off") continue;

    if (mode === "immediate") {
      if (inQuietHours(group.quiet_hours_start, group.quiet_hours_end, now)) continue;
    } else {
      const window = DIGEST_WINDOW_MS[mode];
      if (!window) continue;
      const oldest = new Date(items[0]!.created_at).getTime();
      if (now.getTime() - oldest < window) continue;
      if (inQuietHours(group.quiet_hours_start, group.quiet_hours_end, now)) continue;
    }

    const heading = mode === "immediate" ? "While the group was quiet" : "BRUH digest";
    await sendMessage(
      group.telegram_chat_id,
      [`<b>${heading}</b>`, "", ...items.map((item) => item.body)].join("\n\n"),
    );

    await db
      .from("announcement_queue")
      .update({ sent_at: now.toISOString() })
      .in(
        "id",
        items.map((item) => item.id),
      );

    sent += items.length;
    groupsFlushed += 1;
  }

  return { groups: groupsFlushed, sent };
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
