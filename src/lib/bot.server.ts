import { admin, upsertGroup, upsertMember, migrateChatId, logAudit } from "./db.server";
import { sendMessage, answerCallbackQuery, escapeHtml, isChatAdmin } from "./telegram.server";
import { createCall, extractCandidateMints } from "./calls.server";
import { getLeaderboard, getMemberStats, type LeaderboardWindow } from "./scoring.server";
import { createTipIntent, confirmTip, tipNetworkMetadata } from "./tips.server";
import { getActiveWallet } from "./wallets.server";
import { createLoginToken } from "./session.server";
import { getBruhConfig } from "./bruh-config.server";
import {
  startSeason,
  endSeason,
  listSeasons,
  listOpenDisputes,
  resolveDispute,
} from "./moderation.server";
import { listModerators, setMemberRole, groupStatus, forgetMember } from "./datarights.server";

const PROJECT_URL = "https://project--e287f314-27c2-40bf-94f4-4685a95781fe.lovable.app";

function appUrl(): string {
  return process.env["APP_URL"] ?? PROJECT_URL;
}

export type TelegramUpdate = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: {
    id: string;
    from: TgUser;
    data?: string;
    message?: TgMessage;
  };
  my_chat_member?: { chat: TgChat; new_chat_member: { status: string } };
};

type TgUser = {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

type TgChat = { id: number; type: string; title?: string };

type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  reply_to_message?: TgMessage;
  migrate_to_chat_id?: number;
};

const HELP = [
  "<b>BRUH — crypto community utility bot</b>",
  "",
  "<b>Calls</b>",
  "/call &lt;mint&gt; [note] — record a call with a locked-in baseline",
  "/calls — open calls in this group",
  "/leaderboard — this group's BRUH Score ranking",
  "/stats — your own record here",
  "",
  "<b>Wallet &amp; tips</b>",
  "/wallet — link or review your wallet (DM only)",
  "/tip &lt;amount&gt; &lt;asset&gt; — reply to someone to tip them",
  "/tips — your recent tip activity",
  "",
  "<b>Other</b>",
  "/privacy — what is stored and how to opt out",
  "/export — download everything BRUH holds about you here",
  "/forgetme — revoke your wallet and anonymise your record",
  "/dispute &lt;reason&gt; — reply to a call to flag it",
  "",
  "<b>Admins &amp; moderators</b>",
  "/disputes — open disputes here",
  "/resolve &lt;id&gt; uphold|reject [note] — settle a dispute",
  "/season start &lt;name&gt; · /season end · /season list",
  "/settings — current group configuration",
  "/moderators [add|remove] — list or change moderators (reply to a member)",
  "/status — health snapshot for this group",
  "/pause · /resume",
  "",
  "<i>BRUH is non-custodial. It never holds keys or funds — every transfer is approved in your own wallet.</i>",
].join("\n");

const PRIVACY = [
  "<b>Privacy</b>",
  "",
  "• Stored: your Telegram id, display name, calls, milestones, verified wallet address and confirmed tips — all scoped to this group only.",
  "• Never stored: private keys, seed phrases, message history beyond what a call needs.",
  "• Data is isolated per group. Your record here is not visible in other groups.",
  "• /optout stops passive call detection for you. /forgetme removes your wallet link and pseudonymises your record.",
].join("\n");

async function memberContext(chat: TgChat, from: TgUser) {
  const group = await upsertGroup(chat);
  const member = await upsertMember(group.id, from);
  return { group, member };
}

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  if (update.my_chat_member) {
    const { chat, new_chat_member } = update.my_chat_member;
    if (["member", "administrator"].includes(new_chat_member.status)) {
      const group = await upsertGroup(chat);
      const db = await admin();
      await db.from("groups").update({ removed_at: null }).eq("id", group.id);
      await sendMessage(
        chat.id,
        [
          "<b>BRUH is online.</b>",
          "",
          "Record calls, track how they perform, and tip the people who called them — non-custodially.",
          "",
          "Start with /call &lt;mint&gt;. Type /help for everything else.",
        ].join("\n"),
      );
      await logAudit({ groupId: group.id, actorType: "system", eventType: "bot_added" });
    } else if (["left", "kicked"].includes(new_chat_member.status)) {
      // Stop every broadcast for this chat; history is kept for audit only.
      const db = await admin();
      const { data: group } = await db
        .from("groups")
        .update({ removed_at: new Date().toISOString() })
        .eq("telegram_chat_id", chat.id)
        .select("id")
        .maybeSingle();
      if (group) {
        await logAudit({ groupId: group.id, actorType: "system", eventType: "bot_removed" });
      }
    }
    return;
  }

  if (update.callback_query) return handleCallback(update.callback_query);

  const message = update.message ?? update.edited_message;
  if (!message?.from || message.from.is_bot) return;

  if (message.migrate_to_chat_id) {
    await migrateChatId(message.chat.id, message.migrate_to_chat_id);
    return;
  }

  const text = message.text?.trim();
  if (!text) return;

  if (text.startsWith("/")) return handleCommand(message, text);
  if (message.chat.type !== "private") return handlePassive(message, text);
}

function parseCommand(text: string): { command: string; args: string[] } {
  const [head, ...rest] = text.split(/\s+/);
  const command = (head ?? "").split("@")[0]!.toLowerCase();
  return { command, args: rest };
}

async function handleCommand(message: TgMessage, text: string) {
  const { command, args } = parseCommand(text);
  const from = message.from!;
  const isPrivate = message.chat.type === "private";

  if (isPrivate) {
    switch (command) {
      case "/start":
        return handleStart(message, args);
      case "/help":
        await sendMessage(message.chat.id, HELP);
        return;
      case "/privacy":
        await sendMessage(message.chat.id, PRIVACY);
        return;
      case "/wallet":
        return handleWalletDm(message);
      default:
        await sendMessage(
          message.chat.id,
          "Most BRUH commands live in your group chat. Try /help.",
        );
        return;
    }
  }

  const { group, member } = await memberContext(message.chat, from);
  if (group.is_paused && command !== "/resume") return;
  if (member.is_banned) return;

  switch (command) {
    case "/help":
      await sendMessage(message.chat.id, HELP, { replyToMessageId: message.message_id });
      return;
    case "/privacy":
      await sendMessage(message.chat.id, PRIVACY, { replyToMessageId: message.message_id });
      return;
    case "/call":
      return handleCall(message, group, member, args);
    case "/calls":
      return handleCalls(message, group);
    case "/leaderboard":
      return handleLeaderboard(message, group, args);

    case "/stats":
      return handleStats(message, group, member);
    case "/wallet":
      return handleWalletPointer(message, group, member);
    case "/tip":
      return handleTip(message, group, member, args);
    case "/tips":
      return handleTips(message, group, member);
    case "/dispute":
      return handleDispute(message, group, member, args);
    case "/optout":
      return handleOptOut(message, member, true);
    case "/optin":
      return handleOptOut(message, member, false);
    case "/pause":
    case "/resume":
      return handlePause(message, group, from, command === "/pause");
    case "/disputes":
      return handleDisputeList(message, group, from);
    case "/resolve":
      return handleResolve(message, group, member, from, args);
    case "/season":
      return handleSeason(message, group, from, args);
    case "/settings":
      return handleSettings(message, group, from);
    case "/moderators":
      return handleModerators(message, group, member, from, args);
    case "/status":
      return handleStatus(message, group, from);
    case "/export":
      return handleExport(message, member);
    case "/forgetme":
      return handleForgetMe(message, member);
    default:
      return;
  }
}

async function handleStart(message: TgMessage, args: string[]) {
  const payload = args[0];
  if (payload?.startsWith("wallet_") || payload === "wallet") {
    return handleWalletDm(message);
  }
  await sendMessage(
    message.chat.id,
    [
      "<b>Welcome to BRUH.</b>",
      "",
      "Add me to your community group, then use /call to log a token and /tip to reward good calls.",
      "",
      "I am non-custodial: I never hold keys, and every transfer is signed in your own wallet.",
      "",
      "Use /wallet here to link a wallet, or /help for the full command list.",
    ].join("\n"),
  );
}

async function handleWalletDm(message: TgMessage) {
  const db = await admin();
  const { data: memberships } = await db
    .from("group_members")
    .select("id, group_id, groups(title)")
    .eq("telegram_user_id", message.from!.id);

  if (!memberships || memberships.length === 0) {
    await sendMessage(
      message.chat.id,
      "You are not in a BRUH group yet. Add the bot to your group and post once, then come back.",
    );
    return;
  }

  const token = await createLoginToken(message.from!.id, null);
  await sendMessage(
    message.chat.id,
    [
      "<b>Wallet linking</b>",
      "",
      "Wallets are linked <b>per group</b>, so your identity stays isolated.",
      "Open the BRUH app below, pick the group, and sign a one-off message to prove ownership.",
      "",
      "<i>Signing proves control of the address. It never moves funds.</i>",
    ].join("\n"),
    {
      keyboard: [[{ text: "Open BRUH app", url: `${appUrl()}/app?t=${token}` }]],
    },
  );
}

async function handleWalletPointer(message: TgMessage, group: any, member: any) {
  const address = await getActiveWallet(member.id);
  const summary = address
    ? `Your payout wallet here: <code>${escapeHtml(address)}</code>`
    : "No verified wallet for this group yet.";
  await sendMessage(
    message.chat.id,
    `${summary}\n\nManage it privately — wallet actions never happen in group chat.`,
    {
      replyToMessageId: message.message_id,
      keyboard: [
        [{ text: "Manage wallet in DM", url: `https://t.me/${await botUsername()}?start=wallet` }],
      ],
    },
  );
}

let cachedUsername: string | null = null;
async function botUsername(): Promise<string> {
  if (cachedUsername) return cachedUsername;
  const { telegramCall } = await import("./telegram.server");
  const me = await telegramCall<{ username: string }>("getMe");
  cachedUsername = me.username;
  return me.username;
}

async function handleCall(message: TgMessage, group: any, member: any, args: string[]) {
  const mint = args[0];
  if (!mint) {
    await sendMessage(message.chat.id, "Usage: /call &lt;mint address&gt; [note]", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const result = await createCall({
    groupId: group.id,
    callerMembershipId: member.id,
    mint,
    note: args.slice(1).join(" ") || null,
    sourceMessageId: message.message_id,
    source: "explicit",
    minLiquidityUsd: Number(group.min_liquidity_usd ?? 0),
    allowRepeatCalls: Boolean(group.allow_repeat_calls),
  });

  if (!result.ok) {
    const messages: Record<string, string> = {
      already_called: "That token is already an open call in this group.",
      token_unresolved: "I couldn't find a Solana market for that mint.",
      no_price_source: "No reliable price source for that token right now — call not recorded.",
      provider_disagreement:
        "Price sources disagree on that token right now — call not recorded. Try again shortly.",
      no_liquidity_data: "No pool depth data for that token right now — call not recorded.",

      insufficient_liquidity: `Liquidity is below this group's floor ($${Number(group.min_liquidity_usd ?? 0).toLocaleString()}).`,
    };
    await sendMessage(message.chat.id, messages[result.reason] ?? "Call could not be recorded.", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const snapshot = result.snapshot;
  await sendMessage(
    message.chat.id,
    [
      `<b>Call recorded — ${escapeHtml(snapshot.symbol ?? "token")}</b>`,
      `Caller: ${escapeHtml(member.display_name)}`,
      `Baseline: $${snapshot.priceUsd}`,
      snapshot.marketCapUsd
        ? `Market cap: $${Math.round(snapshot.marketCapUsd).toLocaleString()}`
        : "",
      snapshot.liquidityUsd
        ? `Liquidity: $${Math.round(snapshot.liquidityUsd).toLocaleString()}`
        : "",
      "",
      "<i>Baseline is locked. Not financial advice.</i>",
    ]
      .filter(Boolean)
      .join("\n"),
    { replyToMessageId: message.message_id },
  );
}

async function handleCalls(message: TgMessage, group: any) {
  const db = await admin();
  const { data: calls } = await db
    .from("calls")
    .select(
      "symbol, mint, ath_multiple, last_price_usd, baseline_price_usd, group_members(display_name)",
    )
    .eq("group_id", group.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!calls || calls.length === 0) {
    await sendMessage(message.chat.id, "No open calls yet. Start one with /call &lt;mint&gt;.", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const lines = calls.map((call: any) => {
    const now = Number(call.last_price_usd ?? 0);
    const base = Number(call.baseline_price_usd ?? 0);
    const current = base > 0 ? now / base : 0;
    return `• <b>${escapeHtml(call.symbol ?? call.mint.slice(0, 6))}</b> — ${current.toFixed(2)}x now, ${Number(call.ath_multiple ?? 1).toFixed(2)}x peak (${escapeHtml(call.group_members?.display_name ?? "member")})`;
  });

  await sendMessage(message.chat.id, `<b>Open calls</b>\n\n${lines.join("\n")}`, {
    replyToMessageId: message.message_id,
  });
}

async function handleLeaderboard(message: TgMessage, group: any, args: string[] = []) {
  const requested = (args[0] ?? "").toLowerCase();
  const window: LeaderboardWindow = requested === "7d" || requested === "30d" ? requested : "all";
  const rows = await getLeaderboard(group.id, 10, null, window);
  if (rows.length === 0) {
    await sendMessage(message.chat.id, "No ranked callers yet in this group.", {
      replyToMessageId: message.message_id,
    });
    return;
  }
  const lines = rows.map(
    (row, index) =>
      `${index + 1}. <b>${escapeHtml(row.displayName)}</b> — ${row.score} pts · ${row.calls} calls · best ${row.bestMultiple.toFixed(2)}x${row.ranked ? "" : " · low sample"}`,
  );
  const label = window === "all" ? "all time" : `last ${window === "7d" ? "7" : "30"} days`;
  await sendMessage(
    message.chat.id,
    `<b>BRUH Score — ${escapeHtml(group.title)}</b>\n<i>${label}</i>\n\n${lines.join("\n")}\n\n<i>Group-scoped. Peak multiples use locked baselines. Try /leaderboard 7d or 30d.</i>`,
    { replyToMessageId: message.message_id },
  );
}

async function handleStats(message: TgMessage, group: any, member: any) {
  const stats = await getMemberStats(group.id, member.id);
  if (!stats.row) {
    await sendMessage(message.chat.id, "You have no recorded calls in this group yet.", {
      replyToMessageId: message.message_id,
    });
    return;
  }
  const row = stats.row;
  await sendMessage(
    message.chat.id,
    [
      `<b>${escapeHtml(row.displayName)}</b> — rank ${stats.rank}/${stats.total}`,
      `Score: ${row.score}`,
      `Calls: ${row.calls} · Milestones: ${row.milestones}`,
      `Best: ${row.bestMultiple.toFixed(2)}x · Median: ${row.medianMultiple.toFixed(2)}x`,
      `Tips received: ${row.tipsReceived}`,
    ].join("\n"),
    { replyToMessageId: message.message_id },
  );
}

async function handleTip(message: TgMessage, group: any, member: any, args: string[]) {
  const target = message.reply_to_message?.from;
  if (!target || target.is_bot) {
    await sendMessage(message.chat.id, "Reply to the person you want to tip, then use /tip.", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const amount = Number(args[0]);
  const assetSymbol = (args[1] ?? "SOL").toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    await sendMessage(message.chat.id, "Usage: /tip &lt;amount&gt; &lt;SOL|USDC|BRUH&gt;", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const recipient = await upsertMember(group.id, target);
  const result = await createTipIntent({
    groupId: group.id,
    senderMembershipId: member.id,
    recipientMembershipId: recipient.id,
    assetSymbol,
    amount,
  });

  if (!result.ok) {
    const { bruhTippingEnabled } = getBruhConfig();
    const messages: Record<string, string> = {
      self_tip: "You can't tip yourself.",
      invalid_amount: "That amount isn't valid.",
      asset_unavailable:
        assetSymbol === "BRUH" && !bruhTippingEnabled
          ? "BRUH tipping turns on once the token mint is live. Use SOL on the current devnet."
          : "That asset isn't supported.",
      recipient_wallet_missing: `${escapeHtml(recipient.display_name)} hasn't linked a wallet in this group yet.`,
      membership_group_mismatch: "That recipient isn't available in this group.",
      membership_unavailable: "That member isn't available for tipping.",
    };
    await sendMessage(message.chat.id, messages[result.reason] ?? "Tip could not be prepared.", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const intent = result.intent;
  const networkMetadata = tipNetworkMetadata(intent.network);
  await sendMessage(
    message.chat.id,
    [
      `<b>Tip ready</b> — ${intent.amountDisplay} ${escapeHtml(intent.assetSymbol)} to ${escapeHtml(recipient.display_name)}`,
      `<b>Network: ${escapeHtml(networkMetadata.warning)}</b>`,
      "",
      "Approve it in your own wallet. BRUH never holds funds.",
      "Once signed, tap <b>I've paid</b> and I'll verify it on-chain.",
    ].join("\n"),
    {
      replyToMessageId: message.message_id,
      keyboard: [
        [{ text: "Open in wallet", url: intent.payUrl }],
        [{ text: "I've paid — verify", callback_data: `tipcheck:${intent.id}` }],
      ],
    },
  );
}

async function handleTips(message: TgMessage, group: any, member: any) {
  const db = await admin();
  const { data: tips } = await db
    .from("tip_intents")
    .select("amount_display, asset_symbol, status, created_at, sender_membership_id")
    .eq("group_id", group.id)
    .or(`sender_membership_id.eq.${member.id},recipient_membership_id.eq.${member.id}`)
    .order("created_at", { ascending: false })
    .limit(8);

  if (!tips || tips.length === 0) {
    await sendMessage(message.chat.id, "No tip activity yet.", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const lines = tips.map((tip: any) => {
    const direction = tip.sender_membership_id === member.id ? "sent" : "received";
    return `• ${direction} ${tip.amount_display} ${escapeHtml(tip.asset_symbol)} — ${escapeHtml(tip.status)}`;
  });
  await sendMessage(message.chat.id, `<b>Your tips here</b>\n\n${lines.join("\n")}`, {
    replyToMessageId: message.message_id,
  });
}

async function handleDispute(message: TgMessage, group: any, member: any, args: string[]) {
  const reason = args.join(" ").trim();
  if (!reason) {
    await sendMessage(
      message.chat.id,
      "Usage: /dispute &lt;reason&gt; (reply to the call message)",
      {
        replyToMessageId: message.message_id,
      },
    );
    return;
  }
  const db = await admin();
  const replyId = message.reply_to_message?.message_id;
  const { data: call } = replyId
    ? await db
        .from("calls")
        .select("id")
        .eq("group_id", group.id)
        .eq("source_message_id", replyId)
        .maybeSingle()
    : { data: null };

  await db.from("disputes").insert({
    group_id: group.id,
    call_id: call?.id ?? null,
    raised_by_membership_id: member.id,
    reason,
    status: "open",
  });
  await sendMessage(message.chat.id, "Dispute logged for group moderators to review.", {
    replyToMessageId: message.message_id,
  });
}

async function handleOptOut(message: TgMessage, member: any, optOut: boolean) {
  const db = await admin();
  await db.from("group_members").update({ detection_opt_out: optOut }).eq("id", member.id);
  await sendMessage(
    message.chat.id,
    optOut
      ? "Passive call detection is off for you in this group. /call still works."
      : "Passive call detection is on for you again.",
    { replyToMessageId: message.message_id },
  );
}

async function handlePause(message: TgMessage, group: any, from: TgUser, pause: boolean) {
  if (!(await isChatAdmin(message.chat.id, from.id))) {
    await sendMessage(message.chat.id, "Only group admins can do that.", {
      replyToMessageId: message.message_id,
    });
    return;
  }
  const db = await admin();
  await db.from("groups").update({ is_paused: pause }).eq("id", group.id);
  await sendMessage(message.chat.id, pause ? "BRUH paused for this group." : "BRUH resumed.", {
    replyToMessageId: message.message_id,
  });
}

/** Passive detection only runs when the group and the member both allow it. */
async function handlePassive(message: TgMessage, text: string) {
  const group = await upsertGroup(message.chat);
  if (group.is_paused || group.detection_mode !== "full_detection") return;

  const mints = extractCandidateMints(text);
  if (mints.length !== 1) return;

  const member = await upsertMember(group.id, message.from!);
  if (member.detection_opt_out || member.is_banned) return;

  const result = await createCall({
    groupId: group.id,
    callerMembershipId: member.id,
    mint: mints[0]!,
    sourceMessageId: message.message_id,
    source: "detected",
    minLiquidityUsd: Number(group.min_liquidity_usd ?? 0),
    allowRepeatCalls: Boolean(group.allow_repeat_calls),
  });
  if (!result.ok) return;

  await sendMessage(
    message.chat.id,
    `Call auto-recorded for <b>${escapeHtml(result.snapshot.symbol ?? "token")}</b> at $${result.snapshot.priceUsd}. Use /optout to stop this.`,
    { replyToMessageId: message.message_id, silent: true },
  );
}

async function handleCallback(query: NonNullable<TelegramUpdate["callback_query"]>) {
  const data = query.data ?? "";
  if (data.startsWith("tipcheck:")) {
    const intentId = data.slice("tipcheck:".length);
    const result = await confirmTip(intentId);
    const responses: Record<string, string> = {
      confirmed: "Tip verified on-chain ✅",
      pending: "No confirmed transfer yet — try again in a moment.",
      expired: "This tip request expired. Start a new one.",
      not_found: "That tip request no longer exists.",
    };
    await answerCallbackQuery(query.id, responses[result.status], result.status !== "confirmed");

    if (result.status === "confirmed" && query.message) {
      await sendMessage(
        query.message.chat.id,
        `Tip confirmed on-chain. <code>${escapeHtml(result.signature.slice(0, 24))}…</code>`,
        { replyToMessageId: query.message.message_id },
      );
    }
    return;
  }
  await answerCallbackQuery(query.id);
}

async function requireAdmin(message: TgMessage, from: TgUser): Promise<boolean> {
  if (await isChatAdmin(message.chat.id, from.id)) return true;
  await sendMessage(message.chat.id, "Only group admins can do that.", {
    replyToMessageId: message.message_id,
  });
  return false;
}

async function handleDisputeList(message: TgMessage, group: any, from: TgUser) {
  if (!(await requireAdmin(message, from))) return;
  const disputes = await listOpenDisputes(group.id);
  if (disputes.length === 0) {
    await sendMessage(message.chat.id, "No open disputes here.", {
      replyToMessageId: message.message_id,
    });
    return;
  }
  const lines = disputes.map(
    (dispute) =>
      `• <code>${dispute.id.slice(0, 8)}</code> — ${escapeHtml(dispute.token ?? "no call")} · ${escapeHtml(dispute.reason)} (by ${escapeHtml(dispute.raisedBy)})`,
  );
  await sendMessage(
    message.chat.id,
    `<b>Open disputes</b>\n\n${lines.join("\n")}\n\n<i>Settle with /resolve &lt;id&gt; uphold|reject [note]</i>`,
    { replyToMessageId: message.message_id },
  );
}

async function handleResolve(
  message: TgMessage,
  group: any,
  member: any,
  from: TgUser,
  args: string[],
) {
  if (!(await requireAdmin(message, from))) return;
  const shortId = args[0];
  const outcome = (args[1] ?? "").toLowerCase();
  if (!shortId || (outcome !== "uphold" && outcome !== "reject")) {
    await sendMessage(message.chat.id, "Usage: /resolve &lt;id&gt; uphold|reject [note]", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const open = await listOpenDisputes(group.id);
  const match = open.find((dispute) => dispute.id.startsWith(shortId));
  if (!match) {
    await sendMessage(message.chat.id, "No open dispute with that id.", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const result = await resolveDispute({
    groupId: group.id,
    disputeId: match.id,
    moderatorMembershipId: member.id,
    outcome,
    note: args.slice(2).join(" ") || null,
  });
  if (!result.ok) {
    await sendMessage(message.chat.id, "That dispute is already settled.", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  await sendMessage(
    message.chat.id,
    outcome === "uphold"
      ? "Dispute upheld — the call is invalidated and drops out of scoring."
      : "Dispute rejected — the call stands.",
    { replyToMessageId: message.message_id },
  );
}

async function handleSeason(message: TgMessage, group: any, from: TgUser, args: string[]) {
  const action = (args[0] ?? "list").toLowerCase();

  if (action === "list") {
    const seasons = await listSeasons(group.id);
    const lines = seasons.map(
      (season: any) =>
        `• ${escapeHtml(season.name)}${season.is_active ? " <b>(active)</b>" : ""} — from ${season.starts_at.slice(0, 10)}${season.ends_at ? ` to ${season.ends_at.slice(0, 10)}` : ""}`,
    );
    await sendMessage(
      message.chat.id,
      lines.length ? `<b>Seasons</b>\n\n${lines.join("\n")}` : "No seasons yet.",
      { replyToMessageId: message.message_id },
    );
    return;
  }

  if (!(await requireAdmin(message, from))) return;

  if (action === "start") {
    const name = args.slice(1).join(" ").trim();
    if (!name) {
      await sendMessage(message.chat.id, "Usage: /season start &lt;name&gt;", {
        replyToMessageId: message.message_id,
      });
      return;
    }
    const season = await startSeason(group.id, name);
    await sendMessage(
      message.chat.id,
      `<b>${escapeHtml(season.name)}</b> is live. New calls score into this season.`,
      { replyToMessageId: message.message_id },
    );
    return;
  }

  if (action === "end") {
    const season = await endSeason(group.id);
    await sendMessage(
      message.chat.id,
      season ? `<b>${escapeHtml(season.name)}</b> is closed.` : "No active season to close.",
      { replyToMessageId: message.message_id },
    );
    return;
  }

  await sendMessage(
    message.chat.id,
    "Usage: /season start &lt;name&gt; · /season end · /season list",
    {
      replyToMessageId: message.message_id,
    },
  );
}

async function handleSettings(message: TgMessage, group: any, from: TgUser) {
  if (!(await requireAdmin(message, from))) return;
  const quiet =
    group.quiet_hours_start === null || group.quiet_hours_end === null
      ? "off"
      : `${group.quiet_hours_start}:00–${group.quiet_hours_end}:00 UTC`;
  const token = await createLoginToken(from.id, group.id);
  await sendMessage(
    message.chat.id,
    [
      `<b>Settings — ${escapeHtml(group.title)}</b>`,
      `Detection: ${escapeHtml(group.detection_mode)}`,
      `Min liquidity: $${Number(group.min_liquidity_usd ?? 0).toLocaleString()}`,
      `Min token age: ${group.min_token_age_minutes ?? 0} min`,
      `Repeat calls: ${group.allow_repeat_calls ? "allowed" : "blocked"}`,
      `Tip announcements: ${group.announce_tips ? "on" : "off"} (${escapeHtml(group.announcement_mode)})`,
      `Quiet hours: ${quiet}`,
      `Raw retention: ${group.raw_message_retention_days} days`,
    ].join("\n"),
    {
      replyToMessageId: message.message_id,
      keyboard: [[{ text: "Edit in BRUH app", url: `${appUrl()}/app?t=${token}` }]],
    },
  );
}

async function handleModerators(
  message: TgMessage,
  group: any,
  member: any,
  from: TgUser,
  args: string[],
) {
  const action = (args[0] ?? "list").toLowerCase();

  if (action === "list") {
    const rows = await listModerators(group.id);
    await sendMessage(
      message.chat.id,
      rows.length
        ? `<b>Moderators</b>\n\n${rows.map((row) => `• ${escapeHtml(row.displayName)} — ${row.role}`).join("\n")}`
        : "No moderators set. Telegram group admins always have full powers.",
      { replyToMessageId: message.message_id },
    );
    return;
  }

  if (!(await requireAdmin(message, from))) return;

  const target = message.reply_to_message?.from;
  if (!target || target.is_bot) {
    await sendMessage(message.chat.id, "Reply to the member you want to add or remove.", {
      replyToMessageId: message.message_id,
    });
    return;
  }
  if (action !== "add" && action !== "remove") {
    await sendMessage(message.chat.id, "Usage: /moderators [list|add|remove]", {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const targetMember = await upsertMember(group.id, target);
  const result = await setMemberRole({
    groupId: group.id,
    membershipId: targetMember.id,
    role: action === "add" ? "moderator" : "member",
    actorMembershipId: member.id,
  });
  if (!result.ok) {
    await sendMessage(message.chat.id, "That member isn't in this group.", {
      replyToMessageId: message.message_id,
    });
    return;
  }
  await sendMessage(
    message.chat.id,
    action === "add"
      ? `${escapeHtml(result.displayName)} is now a moderator here.`
      : `${escapeHtml(result.displayName)} is no longer a moderator.`,
    { replyToMessageId: message.message_id },
  );
}

async function handleStatus(message: TgMessage, group: any, from: TgUser) {
  if (!(await requireAdmin(message, from))) return;
  const status = await groupStatus(group.id);
  await sendMessage(
    message.chat.id,
    [
      `<b>Status — ${escapeHtml(group.title)}</b>`,
      `State: ${group.is_paused ? "paused" : "active"} · detection ${escapeHtml(group.detection_mode)}`,
      `Season: ${status.activeSeason ? escapeHtml(status.activeSeason) : "none"}`,
      `Members: ${status.members} · Active calls: ${status.activeCalls}`,
      `Pending tips: ${status.pendingTips} · Open disputes: ${status.openDisputes}`,
      `Queued announcements: ${status.queuedAnnouncements}`,
      `Last price refresh: ${status.lastPriceRefresh ? status.lastPriceRefresh.replace("T", " ").slice(0, 16) + " UTC" : "not yet"}`,
    ].join("\n"),
    { replyToMessageId: message.message_id },
  );
}

async function handleExport(message: TgMessage, member: any) {
  const token = await createLoginToken(message.from!.id, null);
  await sendMessage(
    message.chat.id,
    "Your data export is personal, so it opens in the BRUH app rather than the group.",
    {
      replyToMessageId: message.message_id,
      keyboard: [[{ text: "Download my data", url: `${appUrl()}/app?t=${token}&tab=profile` }]],
    },
  );
  void member;
}

async function handleForgetMe(message: TgMessage, member: any) {
  const result = await forgetMember(member.id);
  await sendMessage(
    message.chat.id,
    [
      "Done. Your wallet link is revoked and your record here is now pseudonymous.",
      `You appear as <b>${escapeHtml(result.pseudonym)}</b> and passive detection is off.`,
      "",
      "<i>Calls stay in the group ledger because other members' scores depend on them, but they are no longer tied to your identity.</i>",
    ].join("\n"),
    { replyToMessageId: message.message_id },
  );
}
