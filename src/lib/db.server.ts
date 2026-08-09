import type { SupabaseClient } from "@supabase/supabase-js";

export type Admin = SupabaseClient<never, "public", never>;

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (table: string) => any;
    rpc: (fn: string, args?: Record<string, unknown>) => any;
  };
}

export type TelegramChat = {
  id: number;
  title?: string;
  type: string;
};

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export async function upsertGroup(chat: TelegramChat) {
  const db = await admin();
  const { data: existing } = await db
    .from("groups")
    .select("*")
    .eq("telegram_chat_id", chat.id)
    .maybeSingle();

  if (existing) {
    if (chat.title && chat.title !== existing.title) {
      await db.from("groups").update({ title: chat.title }).eq("id", existing.id);
    }
    return existing;
  }

  const { data, error } = await db
    .from("groups")
    .insert({
      telegram_chat_id: chat.id,
      title: chat.title ?? "Unknown group",
      chat_type: chat.type,
    })
    .select("*")
    .single();
  if (error) throw error;

  await db.from("seasons").insert({
    group_id: data.id,
    name: "Season 1",
    is_active: true,
  });
  await db.from("audit_events").insert({
    group_id: data.id,
    actor_type: "system",
    event_type: "group_installed",
    entity_type: "group",
    entity_id: data.id,
  });
  return data;
}

/** Telegram may hand a basic group a new chat id; move the record, keep data. */
export async function migrateChatId(fromChatId: number, toChatId: number) {
  const db = await admin();
  await db.from("groups").update({ telegram_chat_id: toChatId }).eq("telegram_chat_id", fromChatId);
}

export async function upsertMember(groupId: string, user: TelegramUser) {
  const db = await admin();
  await db.from("telegram_users").upsert(
    {
      telegram_user_id: user.id,
      username: user.username ?? null,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      language_code: user.language_code ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id" },
  );

  const displayName = user.username ? `@${user.username}` : (user.first_name ?? "Member");
  const { data: existing } = await db
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .eq("telegram_user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.display_name !== displayName) {
      await db.from("group_members").update({ display_name: displayName }).eq("id", existing.id);
    }
    return { ...existing, display_name: displayName };
  }

  const { data, error } = await db
    .from("group_members")
    .insert({ group_id: groupId, telegram_user_id: user.id, display_name: displayName })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function activeSeason(groupId: string) {
  const db = await admin();
  const { data } = await db
    .from("seasons")
    .select("*")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function logAudit(entry: {
  groupId?: string | null;
  actorType: string;
  actorId?: string | null;
  eventType: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  const db = await admin();
  await db.from("audit_events").insert({
    group_id: entry.groupId ?? null,
    actor_type: entry.actorType,
    actor_id: entry.actorId ?? null,
    event_type: entry.eventType,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    before_state: entry.before ?? null,
    after_state: entry.after ?? null,
  });
}
