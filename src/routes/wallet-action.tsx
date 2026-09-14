import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeLoginTokenFn } from "@/lib/miniapp.functions";
import {
  enrollSecureActionFn,
  executeAccountTipFn,
  readAccountTipFn,
  reconcileAccountTipFn,
} from "@/lib/account-tip.functions";

export const Route = createFileRoute("/wallet-action")({ ssr: false, component: WalletAction });
function rawInitData(): string {
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
      ?.initData ?? ""
  );
}
function sol(lamports: string): string {
  const value = BigInt(lamports);
  return `${value / 1000000000n}.${(value % 1000000000n).toString().padStart(9, "0")}`;
}
function WalletAction() {
  const [session, setSession] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [tip, setTip] = useState<Awaited<ReturnType<typeof readAccountTipFn>> | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("Opening private wallet action…");
  const [signature, setSignature] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("t");
      const id = url.searchParams.get("tip");
      url.searchParams.delete("t");
      window.history.replaceState({}, "", url.toString());
      if (!token || !rawInitData())
        throw new Error("Open this button inside your private Telegram BRUH chat.");
      const result = await exchangeLoginTokenFn({ data: { token } });
      if (!result.session)
        throw new Error("This private link expired. Request a fresh link from the bot.");
      const record = id
        ? await readAccountTipFn({
            data: { session: result.session, initData: rawInitData(), intentId: id },
          })
        : null;
      if (cancelled) return;
      setSession(result.session);
      setIntentId(id);
      setTip(record);
      setEnrolling(!id);
      setSignature(record?.signature ?? null);
      setStatus(
        record
          ? `Tip state: ${record.state}`
          : "Choose a separate Secure Action Password of at least 15 characters.",
      );
    })()
      .catch((error) => {
        if (!cancelled)
          setStatus(error instanceof Error ? error.message : "Wallet action unavailable.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function act(action: "enroll" | "send" | "check") {
    if (!session || busy) return;
    setBusy(true);
    const supplied = password;
    setShowPassword(false);
    setShowConfirmation(false);
    setPassword("");
    setConfirmation("");
    try {
      const context = { session, initData: rawInitData() };
      if (action === "enroll") {
        await enrollSecureActionFn({ data: { ...context, password: supplied, confirmation } });
        setEnrolling(false);
        setStatus("Password saved. Existing passwords cannot be overwritten here.");
      } else if (intentId && action === "send") {
        const result = await executeAccountTipFn({
          data: { ...context, intentId, password: supplied },
        });
        setSignature(result.signature);
        setStatus(
          result.state === "finalized"
            ? "Tip finalized and verified."
            : "Signed transaction recorded. Check confirmation before attempting anything else.",
        );
      } else if (intentId) {
        const result = await reconcileAccountTipFn({ data: { ...context, intentId } });
        setStatus(
          result.settled
            ? "Tip finalized and verified."
            : "Not finalized yet. No replacement transaction was created.",
        );
      }
    } catch {
      setStatus(
        "Action unavailable or password rejected. Request a fresh private link if it expired.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-lg p-6 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="min-w-0 flex-1 text-xl font-semibold">Private Wallet Authorization</h1>
        <img
          src="/bruh_wallet.png"
          alt="BRUH wallet"
          width={80}
          height={68}
          className="h-auto w-16 shrink-0 object-contain sm:w-20"
        />
      </header>
      <p role="status">{status}</p>
      {tip && (
        <dl className="space-y-2 break-all">
          <dt>Network</dt>
          <dd>Solana devnet — test SOL</dd>
          <dt>Recipient</dt>
          <dd>{tip.recipient}</dd>
          <dt>Tip</dt>
          <dd>{sol(tip.lamports)} SOL</dd>
          <dt>Network fee</dt>
          <dd>{sol(tip.feeLamports)} SOL</dd>
          <dt>Reference</dt>
          <dd>{tip.reference}</dd>
        </dl>
      )}
      {session && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act(enrolling ? "enroll" : "send");
          }}
          className="space-y-3"
        >
          {(enrolling || intentId) && (
            <label className="block">
              Secure Action Password
              <div className="relative">
                <input
                  id="secure-action-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={enrolling ? "new-password" : "current-password"}
                  minLength={15}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="block w-full border rounded p-2 pr-20"
                />
                <button
                  type="button"
                  aria-controls="secure-action-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-sm"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          )}
          {enrolling && (
            <label className="block">
              Confirm password
              <div className="relative">
                <input
                  id="secure-action-confirmation"
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={15}
                  maxLength={128}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="block w-full border rounded p-2 pr-20"
                />
                <button
                  type="button"
                  aria-controls="secure-action-confirmation"
                  aria-label={
                    showConfirmation ? "Hide confirmation password" : "Show confirmation password"
                  }
                  aria-pressed={showConfirmation}
                  onClick={() => setShowConfirmation((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-sm"
                >
                  {showConfirmation ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          )}
          {(enrolling || intentId) && (
            <button disabled={busy} type="submit" className="border rounded p-2">
              {enrolling ? "Set password" : "Authorize this exact tip"}
            </button>
          )}
          {intentId && (
            <>
              <button
                disabled={busy}
                type="button"
                onClick={() => void act("check")}
                className="border rounded p-2"
              >
                Check confirmation
              </button>
              <button
                disabled={busy}
                type="button"
                onClick={() => setEnrolling(!enrolling)}
                className="border rounded p-2"
              >
                {enrolling ? "Back to tip" : "First-time password setup"}
              </button>
            </>
          )}
        </form>
      )}
      {signature && (
        <a
          className="block break-all underline"
          target="_blank"
          rel="noreferrer"
          href={`https://solscan.io/tx/${signature}?cluster=devnet`}
        >
          View recorded transaction on Solscan
        </a>
      )}
    </main>
  );
}
