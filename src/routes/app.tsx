import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PARTICIPATION } from "@/lib/participation";
import {
  exchangeInitDataFn,
  exchangeLoginTokenFn,
  getMeFn,
  startWalletLinkFn,
  finishWalletLinkFn,
  unlinkWalletFn,
  getGroupBoardFn,
  getTipsFn,
  verifyTipFn,
  getModerationFn,
  settleDisputeFn,
  saveSettingsFn,
  getCallsFn,
  importCallsFn,
  getProfileStatsFn,
  getTipTargetsFn,
  composeTipFn,
  exportMyDataFn,
  forgetMeFn,
  getParticipationFn,
} from "@/lib/miniapp.functions";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "BRUH App — Wallet, calls and leaderboards" },
      {
        name: "description",
        content:
          "Review open calls and your group's BRUH Score ranking. Your BRUH devnet wallet is created with private bot commands, not here.",
      },
      { property: "og:title", content: "BRUH App" },
      {
        property: "og:description",
        content: "Call tracking and group leaderboards for BRUH communities, in Solana devnet beta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MiniApp,
});

const SESSION_KEY = "bruh_session";

type ExplorerCall = {
  id: string;
  symbol: string;
  mint: string;
  status: string;
  note: string | null;
  caller: string;
  createdAt: string;
  current: number;
  peak: number;
  peakAt: string | null;
  liquidityUsd: number;
};

type TabId = "wallet" | "board" | "calls" | "tips" | "credits" | "profile" | "admin";

const TABS: { id: TabId; label: string }[] = [
  { id: "wallet", label: "Wallet" },
  { id: "board", label: "Board" },
  { id: "calls", label: "Calls" },
  { id: "tips", label: "Tips" },
  { id: "credits", label: "Credits" },
  { id: "profile", label: "Profile" },
];

type GroupEntry = {
  membershipId: string;
  groupId: string;
  title: string;
  displayName: string;
  wallet: string | null;
};

function MiniApp() {
  const exchange = useServerFn(exchangeLoginTokenFn);
  const exchangeInitData = useServerFn(exchangeInitDataFn);
  const getMe = useServerFn(getMeFn);
  const startLink = useServerFn(startWalletLinkFn);
  const finishLink = useServerFn(finishWalletLinkFn);
  const unlink = useServerFn(unlinkWalletFn);
  const getBoard = useServerFn(getGroupBoardFn);
  const getTips = useServerFn(getTipsFn);
  const verifyTip = useServerFn(verifyTipFn);
  const getModeration = useServerFn(getModerationFn);
  const settleDispute = useServerFn(settleDisputeFn);
  const saveSettings = useServerFn(saveSettingsFn);
  const getCalls = useServerFn(getCallsFn);
  const importCalls = useServerFn(importCallsFn);

  const getProfileStats = useServerFn(getProfileStatsFn);
  const getTipTargets = useServerFn(getTipTargetsFn);
  const composeTip = useServerFn(composeTipFn);
  const exportMyData = useServerFn(exportMyDataFn);
  const forgetMe = useServerFn(forgetMeFn);
  const getParticipation = useServerFn(getParticipationFn);

  const [session, setSession] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [board, setBoard] = useState<Awaited<ReturnType<typeof getGroupBoardFn>> | null>(null);
  const [address, setAddress] = useState("");
  const [challenge, setChallenge] = useState<{ challengeId: string; message: string } | null>(null);
  const [signature, setSignature] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [boardWindow, setBoardWindow] = useState<"7d" | "30d" | "all">("all");
  const [csv, setCsv] = useState("");

  const [tips, setTips] = useState<Awaited<ReturnType<typeof getTipsFn>>["tips"]>([]);
  const [mod, setMod] = useState<Awaited<ReturnType<typeof getModerationFn>> | null>(null);
  const [tab, setTab] = useState<TabId>("wallet");
  const [participation, setParticipation] = useState<Awaited<
    ReturnType<typeof getParticipationFn>
  > | null>(null);
  const [participationError, setParticipationError] = useState<string | null>(null);

  useEffect(() => {
    setParticipation(null);
    setParticipationError(null);
    if (!session || !selected || tab !== "credits") return;
    let cancelled = false;
    getParticipation({ data: { session, membershipId: selected } })
      .then((result) => {
        if (!cancelled) setParticipation(result);
      })
      .catch(() => {
        if (!cancelled)
          setParticipationError("Participation history is unavailable. Try again later.");
      });
    return () => {
      cancelled = true;
    };
  }, [session, selected, tab]);
  const [explorer, setExplorer] = useState<Awaited<ReturnType<typeof getCallsFn>> | null>(null);
  const [openCallId, setOpenCallId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfileStatsFn>> | null>(
    null,
  );
  const [targets, setTargets] = useState<Awaited<ReturnType<typeof getTipTargetsFn>> | null>(null);
  const [draft, setDraft] = useState({ recipient: "", asset: "SOL", amount: "" });

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("t");
      let active = window.localStorage.getItem(SESSION_KEY);

      if (token) {
        const result = await exchange({ data: { token } });
        if (result.session) {
          active = result.session;
          window.localStorage.setItem(SESSION_KEY, result.session);
        }
        url.searchParams.delete("t");
        window.history.replaceState({}, "", url.toString());
      }

      // Inside Telegram the signed initData payload is authoritative, so it can
      // mint a session without the one-time link.
      const initData = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
        .Telegram?.WebApp?.initData;
      if (!active && initData) {
        try {
          const result = await exchangeInitData({ data: { initData } });
          if (result.session) {
            active = result.session;
            window.localStorage.setItem(SESSION_KEY, result.session);
          }
        } catch {
          /* falls back to the login-link flow */
        }
      }

      const requestedTab = url.searchParams.get("tab");
      if (requestedTab && ["wallet", "board", "calls", "tips", "profile"].includes(requestedTab)) {
        setTab(requestedTab as TabId);
      }

      if (!active) {
        setLoading(false);
        return;
      }
      setSession(active);
      try {
        const profile = await getMe({ data: { session: active } });
        setGroups(profile.groups);
        setSelected(profile.groups[0]?.membershipId ?? null);
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
        setSession(null);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!session || !selected) return;
    getBoard({ data: { session, membershipId: selected, seasonId, window: boardWindow } })
      .then(setBoard)
      .catch(() => setBoard(null));
  }, [session, selected, seasonId, boardWindow]);

  useEffect(() => {
    if (!session || !selected) return;
    setSeasonId(null);
    getTips({ data: { session, membershipId: selected } })
      .then((result) => setTips(result.tips))
      .catch(() => setTips([]));
    // Moderation tools only resolve for Telegram group admins; silence otherwise.
    getModeration({ data: { session, membershipId: selected } })
      .then(setMod)
      .catch(() => setMod(null));
  }, [session, selected]);

  useEffect(() => {
    if (!session || !selected) return;
    if (tab !== "calls") return;
    getCalls({ data: { session, membershipId: selected, callId: openCallId } })
      .then(setExplorer)
      .catch(() => setExplorer(null));
  }, [session, selected, tab, openCallId]);

  useEffect(() => {
    if (!session || !selected) return;
    if (tab !== "profile") return;
    getProfileStats({ data: { session, membershipId: selected } })
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [session, selected, tab]);

  useEffect(() => {
    if (!session || !selected) return;
    if (tab !== "tips") return;
    getTipTargets({ data: { session, membershipId: selected } })
      .then(setTargets)
      .catch(() => setTargets(null));
  }, [session, selected, tab]);

  async function handleComposeTip() {
    if (!session || !selected) return;
    setStatus(null);
    const amount = Number(draft.amount);
    if (!draft.recipient || !Number.isFinite(amount) || amount <= 0) {
      setStatus("Pick a member and a valid amount.");
      return;
    }
    try {
      await composeTip({
        data: {
          session,
          membershipId: selected,
          recipientMembershipId: draft.recipient,
          assetSymbol: draft.asset,
          amount,
        },
      });
      setDraft({ recipient: "", asset: draft.asset, amount: "" });
      setStatus("Tip request created — pay it below, then verify.");
      await refreshTips();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tip could not be prepared.");
    }
  }

  async function handleExport() {
    if (!session || !selected) return;
    const result = await exportMyData({ data: { session, membershipId: selected } });
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bruh-my-data-${selected.slice(0, 8)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!session || !selected) return;
    try {
      const result = await importCalls({ data: { session, membershipId: selected, csv } });
      setStatus(
        `Imported ${result.inserted} call(s)${
          result.skipped.length > 0 ? `, skipped ${result.skipped.length}` : ""
        }.`,
      );
      if (result.inserted > 0) setCsv("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    }
  }

  async function handleForgetMe() {
    if (!session || !selected) return;
    if (!window.confirm("Revoke your wallet and anonymise your record in this group?")) return;
    const result = await forgetMe({ data: { session, membershipId: selected } });
    setStatus(`Done — you now appear as ${result.pseudonym}.`);
    await refreshProfile(session);
    setProfile(null);
  }

  async function refreshTips() {
    if (!session || !selected) return;
    const result = await getTips({ data: { session, membershipId: selected } });
    setTips(result.tips);
  }

  async function handleVerifyTip(tipId: string) {
    if (!session || !selected) return;
    setStatus(null);
    try {
      const result = await verifyTip({ data: { session, membershipId: selected, tipId } });
      setStatus(
        result.status === "confirmed"
          ? "Tip confirmed on-chain."
          : "No matching transfer found yet — try again once your wallet confirms.",
      );
      await refreshTips();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not verify that tip.");
    }
  }

  async function handleDispute(disputeId: string, outcome: "uphold" | "reject") {
    if (!session || !selected) return;
    await settleDispute({ data: { session, membershipId: selected, disputeId, outcome } });
    const refreshed = await getModeration({ data: { session, membershipId: selected } });
    setMod(refreshed);
    setStatus(outcome === "uphold" ? "Call invalidated." : "Dispute rejected.");
  }

  async function patchSettings(patch: Record<string, unknown>) {
    if (!session || !selected || !mod) return;
    setMod({ ...mod, settings: { ...mod.settings, ...(patch as any) } });
    await saveSettings({ data: { session, membershipId: selected, patch: patch as any } });
    setStatus("Settings saved.");
  }

  const current = groups.find((group) => group.membershipId === selected) ?? null;

  async function refreshProfile(activeSession: string) {
    const profile = await getMe({ data: { session: activeSession } });
    setGroups(profile.groups);
  }

  async function handleStartLink() {
    if (!session || !selected) return;
    setStatus(null);
    try {
      const result = await startLink({
        data: { session, membershipId: selected, address: address.trim() },
      });
      setChallenge({ challengeId: result.challengeId, message: result.message });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start verification.");
    }
  }

  async function handleFinishLink() {
    if (!session || !selected || !challenge) return;
    setStatus(null);
    try {
      await finishLink({
        data: {
          session,
          membershipId: selected,
          challengeId: challenge.challengeId,
          signature: signature.trim(),
        },
      });
      setChallenge(null);
      setSignature("");
      setAddress("");
      setStatus("Wallet verified.");
      await refreshProfile(session);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Verification failed.");
    }
  }

  async function handleUnlink() {
    if (!session || !selected) return;
    await unlink({ data: { session, membershipId: selected } });
    setStatus("Wallet unlinked.");
    await refreshProfile(session);
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">Loading…</p>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Open BRUH from Telegram</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Send <span className="font-mono text-primary">/wallet</span> to the bot in a private chat
          and tap the link it gives you. Sessions are one-time and short-lived.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-semibold">BRUH</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wallets and stats are isolated per group.
        </p>
      </header>

      <section className="py-6">
        <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Group
        </label>
        <select
          value={selected ?? ""}
          onChange={(event) => setSelected(event.target.value)}
          className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          {groups.map((group) => (
            <option key={group.membershipId} value={group.membershipId}>
              {group.title}
            </option>
          ))}
        </select>
      </section>

      <nav className="mb-6 flex flex-wrap gap-2">
        {[...TABS, ...(mod ? [{ id: "admin" as TabId, label: "Admin" }] : [])].map((entry) => (
          <button
            key={entry.id}
            onClick={() => setTab(entry.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${
              tab === entry.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {status && <p className="mb-4 text-sm text-accent">{status}</p>}

      {tab === "wallet" && current && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Wallet</h2>
          <div className="mt-3 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              BRUH account wallet — Solana devnet beta (active)
            </p>
            <p className="mt-1">
              Your BRUH wallet is created and viewed in a private one-to-one chat with the bot, not
              here. Send <span className="font-mono text-primary">/start</span> and BRUH creates or
              reuses one encrypted wallet for your Telegram account;{" "}
              <span className="font-mono text-primary">/wallet make</span> confirms creation and{" "}
              <span className="font-mono text-primary">/wallet show</span> displays its address and
              live devnet balance. Nothing needs to be linked here for it.
            </p>
            <p className="mt-1">
              One wallet per Telegram account, shared across your groups while statistics stay
              separate per group. Spending, key export and retirement are not available, it runs on
              Solana devnet only and holds no real SOL. Tipping is switched off during this beta.
            </p>
          </div>
          {current.wallet ? (
            <div className="mt-3">
              <p className="break-all font-mono text-sm text-primary">{current.wallet}</p>
              <button
                onClick={handleUnlink}
                className="mt-4 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
              >
                Unlink wallet
              </button>
            </div>
          ) : challenge ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign this exact message with your wallet, then paste the base58 signature. Signing
                proves ownership — it never moves funds.
              </p>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono text-xs">
                {challenge.message}
              </pre>
              <input
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                placeholder="Base58 signature"
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              />
              <button
                onClick={handleFinishLink}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Verify signature
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Your Solana address"
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              />
              <button
                onClick={handleStartLink}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Start verification
              </button>
            </div>
          )}
          {status && <p className="mt-3 text-sm text-accent">{status}</p>}
        </section>
      )}

      {tab === "credits" && current && (
        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">
            {participation?.storageReady ? "Community participation points" : PARTICIPATION.title}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">Group: {current.title}</p>
          <p className="mt-3 text-sm text-muted-foreground">{PARTICIPATION.description}</p>
          <p className="mt-3 text-sm text-muted-foreground">{PARTICIPATION.disclosure}</p>
          {!participation?.storageReady && (
            <p className="mt-3 text-sm text-accent">{PARTICIPATION.next}</p>
          )}
          {participation?.storageReady && (
            <p className="mt-3 text-sm text-accent">
              {participation.earningEnabled
                ? "An earning season is active in this group."
                : "No earning season is currently active in this group. Existing history is preserved."}
            </p>
          )}
          {participationError && (
            <p className="mt-3 text-sm text-destructive">{participationError}</p>
          )}
          {!participation && !participationError && (
            <p className="mt-3 text-sm text-muted-foreground">Loading participation status…</p>
          )}
          {participation?.storageReady && (
            <>
              <p className="mt-4 font-mono">Participation points: {participation.totalPoints}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Tips awaiting point processing: {participation.pendingTips} · Tips needing review:{" "}
                {participation.tipsNeedingReview}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Not a token balance. Recent history shows up to 50 entries; the total includes all
                entries.
              </p>
              {participation.events.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  No participation events recorded.
                </p>
              )}
              <ul className="mt-3 divide-y divide-border">
                {participation.events.map((event) => (
                  <li key={event.id} className="py-3 text-sm">
                    <span>
                      {event.source_kind.replaceAll("_", " ")} · {event.status} · {event.points}{" "}
                      points
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rule {event.rule_version} · {event.reason_code.replaceAll("_", " ")} ·{" "}
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {current.wallet
              ? "A wallet is linked for this group. No BRUH allocation has been finalized."
              : "Verify your wallet in the Wallet tab before any future allocation is finalized."}
          </p>
        </section>
      )}

      {tab === "board" && board && (
        <>
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Leaderboard</h2>
              <div className="flex items-center gap-2">
                <select
                  value={boardWindow}
                  onChange={(event) => setBoardWindow(event.target.value as "7d" | "30d" | "all")}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  <option value="all">All time</option>
                  <option value="30d">Last 30d</option>
                  <option value="7d">Last 7d</option>
                </select>
                {board.seasons.length > 0 && (
                  <select
                    value={seasonId ?? ""}
                    onChange={(event) => setSeasonId(event.target.value || null)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">All seasons</option>
                    {board.seasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name}
                        {season.is_active ? " (live)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {board.leaderboard.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No ranked callers yet.</p>
            ) : (
              <ol className="mt-3 divide-y divide-border">
                {board.leaderboard.map((row, index) => (
                  <li key={row.membershipId} className="flex justify-between py-2 text-sm">
                    <span>
                      {index + 1}. {row.displayName}
                      {!row.ranked && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          low sample
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-primary">{row.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Open calls</h2>
            {board.calls.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No open calls.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {board.calls.map((call) => (
                  <li key={call.symbol + call.caller} className="flex justify-between py-2 text-sm">
                    <span>
                      {call.symbol} <span className="text-muted-foreground">· {call.caller}</span>
                    </span>
                    <span className="font-mono text-primary">
                      {call.current.toFixed(2)}x / {call.peak.toFixed(2)}x
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "tips" && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Send a tip</h2>
          {targets?.network === "devnet" && (
            <p className="mt-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm font-semibold text-primary">
              DEVNET TEST ONLY — set your wallet to Solana Devnet. Do not send mainnet funds.
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            Tipping is switched off in the current devnet wallet beta. BRUH builds the request and
            you approve it in your own wallet — nothing is ever held here.
          </p>
          <div className="mt-4 space-y-3">
            <select
              value={draft.recipient}
              onChange={(event) => setDraft({ ...draft, recipient: event.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Choose a member…</option>
              {(targets?.members ?? []).map(
                (member: { membershipId: string; displayName: string }) => (
                  <option key={member.membershipId} value={member.membershipId}>
                    {member.displayName}
                  </option>
                ),
              )}
            </select>
            <div className="flex gap-2">
              <input
                value={draft.amount}
                onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                placeholder="Amount"
                inputMode="decimal"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              />
              <select
                value={draft.asset}
                onChange={(event) => setDraft({ ...draft, asset: event.target.value })}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {(targets?.assets ?? ["SOL"]).map((asset: string) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleComposeTip}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create tip request
            </button>
          </div>
        </section>
      )}

      {tab === "tips" && tips.length > 0 && (
        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Pending tips</h2>
          <ul className="mt-3 space-y-4">
            {tips.map((tip) => (
              <li key={tip.id} className="rounded-md border border-border p-3">
                <div className="flex justify-between text-sm">
                  <span>
                    {tip.direction === "sent" ? "To" : "From"}{" "}
                    <span className="text-muted-foreground">{tip.counterparty}</span>
                  </span>
                  <span className="font-mono text-primary">
                    {tip.amountDisplay} {tip.assetSymbol}
                  </span>
                </div>
                {tip.network === "devnet" && (
                  <p className="mt-2 text-xs font-semibold text-primary">
                    DEVNET TEST ONLY — confirm your wallet network before signing.
                  </p>
                )}
                {tip.direction === "sent" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={tip.payUrl}
                      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Pay in wallet
                    </a>
                    <button
                      onClick={() => handleVerifyTip(tip.id)}
                      className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
                    >
                      I&apos;ve paid — verify
                    </button>
                  </div>
                )}
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                  ref {tip.reference}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "admin" && mod && (
        <>
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Import historical calls</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              CSV columns: mint, caller_telegram_id, baseline_price_usd, and optionally symbol,
              peak_price_usd, called_at, note. Imported calls are shown as history and never counted
              toward BRUH Score.
            </p>
            <textarea
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              rows={4}
              placeholder="mint,caller_telegram_id,baseline_price_usd,symbol"
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            />
            <button
              onClick={handleImport}
              disabled={csv.trim().length < 10}
              className="mt-3 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Import calls
            </button>
          </section>

          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Disputes</h2>
            {mod.disputes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nothing open.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {mod.disputes.map((dispute) => (
                  <li key={dispute.id} className="rounded-md border border-border p-3 text-sm">
                    <p>
                      <span className="font-mono text-primary">{dispute.token ?? "call"}</span> —{" "}
                      {dispute.reason}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">by {dispute.raisedBy}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleDispute(dispute.id, "uphold")}
                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                      >
                        Uphold (invalidate)
                      </button>
                      <button
                        onClick={() => handleDispute(dispute.id, "reject")}
                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Group settings</h2>
            <div className="mt-4 space-y-4 text-sm">
              <Field label="Detection mode">
                <select
                  value={mod.settings.detectionMode}
                  onChange={(event) => patchSettings({ detection_mode: event.target.value })}
                  className="rounded-md border border-input bg-background px-2 py-1"
                >
                  <option value="command_only">Command only</option>
                  <option value="full_detection">Full detection</option>
                </select>
              </Field>
              <Field label="Min liquidity (USD)">
                <input
                  type="number"
                  defaultValue={mod.settings.minLiquidityUsd}
                  onBlur={(event) =>
                    patchSettings({ min_liquidity_usd: Number(event.target.value) })
                  }
                  className="w-28 rounded-md border border-input bg-background px-2 py-1 font-mono"
                />
              </Field>
              <Field label="Min token age (min)">
                <input
                  type="number"
                  defaultValue={mod.settings.minTokenAgeMinutes}
                  onBlur={(event) =>
                    patchSettings({ min_token_age_minutes: Number(event.target.value) })
                  }
                  className="w-28 rounded-md border border-input bg-background px-2 py-1 font-mono"
                />
              </Field>
              <Field label="Repeat calls">
                <input
                  type="checkbox"
                  checked={mod.settings.allowRepeatCalls}
                  onChange={(event) => patchSettings({ allow_repeat_calls: event.target.checked })}
                />
              </Field>
              <Field label="Announce tips">
                <input
                  type="checkbox"
                  checked={mod.settings.announceTips}
                  onChange={(event) => patchSettings({ announce_tips: event.target.checked })}
                />
              </Field>
              <Field label="Announcements">
                <select
                  value={mod.settings.announcementMode}
                  onChange={(event) => patchSettings({ announcement_mode: event.target.value })}
                  className="rounded-md border border-input bg-background px-2 py-1"
                >
                  <option value="immediate">Immediate</option>
                  <option value="hourly">Hourly digest</option>
                  <option value="daily">Daily digest</option>
                  <option value="off">Off</option>
                </select>
              </Field>
              <Field label="Quiet hours (UTC)">
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    defaultValue={mod.settings.quietHoursStart ?? ""}
                    onBlur={(event) =>
                      patchSettings({
                        quiet_hours_start:
                          event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 font-mono"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    defaultValue={mod.settings.quietHoursEnd ?? ""}
                    onBlur={(event) =>
                      patchSettings({
                        quiet_hours_end:
                          event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 font-mono"
                  />
                </span>
              </Field>
              <Field label="Raw retention (days)">
                <input
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={mod.settings.retentionDays}
                  onBlur={(event) =>
                    patchSettings({ raw_message_retention_days: Number(event.target.value) })
                  }
                  className="w-24 rounded-md border border-input bg-background px-2 py-1 font-mono"
                />
              </Field>
            </div>
          </section>
        </>
      )}

      {tab === "calls" && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Calls</h2>
          {!explorer || explorer.calls.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No calls recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {explorer.calls.map((call: ExplorerCall) => {
                const detail =
                  explorer.detail && explorer.detail.id === call.id ? explorer.detail : null;
                return (
                  <li key={call.id} className="py-3">
                    <button
                      onClick={() => setOpenCallId(openCallId === call.id ? null : call.id)}
                      className="flex w-full items-start justify-between gap-3 text-left text-sm"
                    >
                      <span>
                        <span className="font-medium">{call.symbol}</span>{" "}
                        <span className="text-muted-foreground">· {call.caller}</span>
                        <span className="block text-xs text-muted-foreground">
                          {call.createdAt.slice(0, 10)} · {call.status}
                        </span>
                      </span>
                      <span className="whitespace-nowrap font-mono text-primary">
                        {call.current.toFixed(2)}x / {call.peak.toFixed(2)}x
                      </span>
                    </button>

                    {openCallId === call.id && (
                      <div className="mt-3 rounded-md border border-border bg-background p-3 text-xs">
                        <p className="break-all font-mono text-muted-foreground">{call.mint}</p>
                        {call.note && <p className="mt-2">{call.note}</p>}
                        <p className="mt-2 text-muted-foreground">
                          Baseline liquidity ${Math.round(call.liquidityUsd).toLocaleString()}
                          {call.peakAt
                            ? ` · peak ${call.peakAt.slice(0, 16).replace("T", " ")} UTC`
                            : ""}
                        </p>

                        <p className="mt-3 font-mono uppercase tracking-widest text-muted-foreground">
                          Milestones
                        </p>
                        {detail && detail.milestones.length > 0 ? (
                          <ul className="mt-1 space-y-1">
                            {detail.milestones.map((hit) => (
                              <li key={hit.milestone} className="flex justify-between">
                                <span className="text-primary">{hit.milestone}x</span>
                                <span className="text-muted-foreground">
                                  {hit.reachedAt.slice(0, 16).replace("T", " ")} UTC
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-muted-foreground">None yet.</p>
                        )}

                        <p className="mt-3 font-mono uppercase tracking-widest text-muted-foreground">
                          Recent prices
                        </p>
                        <ul className="mt-1 space-y-1">
                          {(detail?.observations ?? []).slice(0, 8).map((point) => (
                            <li key={point.observedAt} className="flex justify-between">
                              <span className="text-muted-foreground">
                                {point.observedAt.slice(5, 16).replace("T", " ")}
                              </span>
                              <span className="font-mono">
                                {point.priceUsd === null ? "—" : `$${point.priceUsd}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === "profile" && (
        <>
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">
              {profile?.member.displayName ?? current?.displayName ?? "You"}
            </h2>
            {profile?.row ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rank {profile.rank} of {profile.total} · {profile.member.role}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Stat label="BRUH Score" value={String(profile.row.score)} />
                  <Stat label="Calls" value={String(profile.row.calls)} />
                  <Stat label="Best" value={`${profile.row.bestMultiple.toFixed(2)}x`} />
                  <Stat label="Median" value={`${profile.row.medianMultiple.toFixed(2)}x`} />
                  <Stat label="Milestones" value={String(profile.row.milestones)} />
                  <Stat label="Tips received" value={String(profile.row.tipsReceived)} />
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Score blends peak and median multiples with your 2x hit rate and peer recognition,
                  then damps the total by sample size so one lucky call cannot top a group.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No recorded calls in this group yet.
              </p>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Your data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything BRUH holds about you in this group, and nothing from any other group.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleExport}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
              >
                Download CSV
              </button>
              <button
                onClick={handleForgetMe}
                className="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                Forget me
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Forgetting revokes your wallet link, anonymises your name and turns off passive
              detection. Calls stay in the group ledger, untied from you.
            </p>
          </section>
        </>
      )}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg text-primary">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-5 py-10">{children}</div>
    </main>
  );
}
