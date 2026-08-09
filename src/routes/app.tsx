import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  exchangeLoginTokenFn,
  getMeFn,
  startWalletLinkFn,
  finishWalletLinkFn,
  unlinkWalletFn,
  getGroupBoardFn,
} from "@/lib/miniapp.functions";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "BRUH App — Wallets, calls and leaderboards" },
      {
        name: "description",
        content:
          "Link a Solana wallet per Telegram group, review open calls and see your group's BRUH Score ranking.",
      },
      { property: "og:title", content: "BRUH App" },
      {
        property: "og:description",
        content: "Per-group wallet linking and call tracking for BRUH communities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MiniApp,
});

const SESSION_KEY = "bruh_session";

type GroupEntry = {
  membershipId: string;
  groupId: string;
  title: string;
  displayName: string;
  wallet: string | null;
};

function MiniApp() {
  const exchange = useServerFn(exchangeLoginTokenFn);
  const getMe = useServerFn(getMeFn);
  const startLink = useServerFn(startWalletLinkFn);
  const finishLink = useServerFn(finishWalletLinkFn);
  const unlink = useServerFn(unlinkWalletFn);
  const getBoard = useServerFn(getGroupBoardFn);

  const [session, setSession] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [board, setBoard] = useState<Awaited<ReturnType<typeof getGroupBoardFn>> | null>(null);
  const [address, setAddress] = useState("");
  const [challenge, setChallenge] = useState<{ challengeId: string; message: string } | null>(null);
  const [signature, setSignature] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    getBoard({ data: { session, membershipId: selected } })
      .then(setBoard)
      .catch(() => setBoard(null));
  }, [session, selected]);

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
    return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
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

      {current && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Wallet</h2>
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

      {board && (
        <>
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Leaderboard</h2>
            {board.leaderboard.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No ranked callers yet.</p>
            ) : (
              <ol className="mt-3 divide-y divide-border">
                {board.leaderboard.map((row, index) => (
                  <li key={row.membershipId} className="flex justify-between py-2 text-sm">
                    <span>
                      {index + 1}. {row.displayName}
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
                      {call.symbol}{" "}
                      <span className="text-muted-foreground">· {call.caller}</span>
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
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-5 py-10">{children}</div>
    </main>
  );
}
