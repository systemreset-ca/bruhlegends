import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeLoginTokenFn } from "@/lib/miniapp.functions";
import {
  readWalletOnboardingFn,
  generateWalletOnboardingFn,
} from "@/lib/wallet-onboarding.functions";
import {
  secureActionPasswordError,
  newSecureActionPasswordError,
  secureActionPasswordRules,
} from "@/lib/secure-action-password";
import { Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  const [wallet, setWallet] =
    useState<Awaited<ReturnType<typeof readWalletOnboardingFn>>["wallet"]>(null);
  const [passwordSet, setPasswordSet] = useState(false);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [tip, setTip] = useState<Awaited<ReturnType<typeof readAccountTipFn>> | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState(true);
  const [opening, setOpening] = useState(true);
  const [introduced, setIntroduced] = useState(false);
  const [status, setStatus] = useState("Opening private wallet action…");
  const [signature, setSignature] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const webApp = (
      window as unknown as {
        Telegram?: { WebApp?: { ready?: () => void; expand?: () => void; close?: () => void } };
      }
    ).Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
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
      const onboarding = id
        ? null
        : await readWalletOnboardingFn({
            data: { session: result.session, initData: rawInitData() },
          });
      if (cancelled) return;
      setSession(result.session);
      setIntentId(id);
      setTip(record);
      setWallet(onboarding?.wallet ?? null);
      setPasswordSet(onboarding?.passwordSet ?? false);
      setEnrolling(!id && !!onboarding?.wallet && !onboarding.passwordSet);
      setSignature(record?.signature ?? null);
      setStatus(
        record
          ? `Tip state: ${record.state}`
          : !onboarding?.wallet
            ? "Generate your internal BRUH Wallet to get started."
            : onboarding.passwordSet
              ? "Your internal BRUH Wallet and Action Password are ready."
              : "Create a new separate Action Password for menu execution.",
      );
    })()
      .catch((error) => {
        if (!cancelled)
          setStatus(error instanceof Error ? error.message : "Wallet action unavailable.");
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
          setOpening(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function generateWallet() {
    if (!session || busy || !introduced) return;
    setBusy(true);
    setStatus("Generating your internal BRUH Wallet…");
    try {
      const result = await generateWalletOnboardingFn({
        data: { session, initData: rawInitData() },
      });
      if (!result.wallet) throw new Error("Wallet unavailable.");
      setWallet(result.wallet);
      setPasswordSet(result.passwordSet);
      setEnrolling(!result.passwordSet);
      setStatus(
        result.passwordSet
          ? "Your existing wallet and Action Password are ready."
          : "Your wallet is ready. Create a new separate Action Password for menu execution.",
      );
    } catch {
      setStatus(
        "Wallet generation or setup status could not complete. Close this app, run /start in your private bot chat and reopen its button. If a wallet was created, the same wallet will be recovered; no funds moved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function act(action: "enroll" | "send" | "check") {
    if (!session || busy || !introduced) return;
    if (action !== "check") {
      const error = (
        action === "enroll" ? newSecureActionPasswordError : secureActionPasswordError
      )(password, action === "enroll" ? confirmation : undefined);
      if (error) {
        setStatus(error);
        return;
      }
    }
    setBusy(true);
    const supplied = password;
    setShowPassword(false);
    setShowConfirmation(false);
    setPassword("");
    setConfirmation("");
    try {
      const context = { session, initData: rawInitData() };
      if (action === "enroll") {
        const result = await enrollSecureActionFn({
          data: { ...context, password: supplied, confirmation },
        });
        if (!result.enrolled) {
          setStatus(result.message);
          return;
        }
        setEnrolling(false);
        setPasswordSet(true);
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
        action === "enroll"
          ? "Password setup could not reach the service. Close this app, run /security in your private bot chat, and open the new button."
          : "Tip authorization or confirmation could not complete. The cause may be an expired private session, an incorrect password, a temporary lockout, or a transaction/service issue. This is not a request to add special characters.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (opening)
    return (
      <main
        className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4 p-6"
        role="status"
        aria-live="polite"
      >
        <img src="/bruh_wallet_transparent.webp" alt="BRUH wallet" className="w-20 h-auto" />
        <div
          className="size-10 rounded-full border-4 border-secondary border-t-gold motion-safe:animate-spin"
          aria-hidden="true"
        />
        <p className="text-lg">Loading…</p>
        <p className="text-sm text-muted-foreground">Opening your private BRUH Mini App.</p>
      </main>
    );
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg p-6 space-y-4">
        <Dialog open={!!session && !introduced} onOpenChange={() => {}}>
          <DialogContent
            className="max-w-[calc(100%-2rem)] sm:max-w-md border-imperial [&>button]:hidden"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <DialogTitle className="font-sans font-medium">BRUH Mini App</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This is BRUH’s private wallet interface, opened inside Telegram from @BRUHLegendsBot.
              Your separate Action Password authorizes your internal BRUH Wallet menu actions. It is
              not your Telegram password. Never enter a seed phrase or the private key of an
              external wallet here.
            </DialogDescription>
            <p className="text-sm text-muted-foreground">
              Review the{" "}
              <a href="/terms" target="_blank" rel="noreferrer" className="text-gold underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-gold underline">
                Privacy information
              </a>{" "}
              before continuing. Opening this screen does not send funds.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded border border-imperial px-4 py-2"
                onClick={() => {
                  const app = (
                    window as unknown as { Telegram?: { WebApp?: { close?: () => void } } }
                  ).Telegram?.WebApp;
                  if (app?.close) app.close();
                  else {
                    setSession(null);
                    setStatus("Mini App cancelled. Return to your private bot chat when ready.");
                  }
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border border-imperial bg-gold text-black px-4 py-2"
                onClick={() => setIntroduced(true)}
              >
                Continue
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <header className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 flex-1 text-xl font-sans font-medium normal-case">
            Private Wallet Authorization
          </h1>
          <img
            src="/bruh_wallet_transparent.webp"
            alt="BRUH wallet"
            width={80}
            height={67}
            className="h-auto w-16 shrink-0 object-contain sm:w-20"
          />
        </header>
        <p role="status">{status}</p>
        {session && !intentId && !wallet && (
          <section className="space-y-3">
            <h2 className="font-sans text-lg font-medium normal-case">Your internal BRUH Wallet</h2>
            <p className="text-sm text-muted-foreground">
              Generate a separate wallet for your Telegram account. It follows you across BRUH
              groups. BRUH stores its signing key encrypted; never import an external wallet key or
              seed phrase here.
            </p>
            <button
              type="button"
              disabled={busy || !introduced}
              onClick={() => void generateWallet()}
              className="rounded border border-imperial bg-gold text-black px-4 py-2 disabled:opacity-50"
            >
              {busy ? "Generating…" : "Generate BRUH Wallet"}
            </button>
          </section>
        )}
        {wallet && !intentId && (
          <section className="space-y-3">
            <h2 className="font-sans text-lg font-medium normal-case">Your BRUH Wallet address</h2>
            <code className="block break-all rounded bg-secondary p-3 text-white">
              {wallet.address}
            </code>
            <p className="text-xs text-muted-foreground">
              Solana {wallet.network}. Use this address on the matching network.
            </p>
            <button
              type="button"
              className="rounded border border-imperial px-4 py-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(wallet.address);
                  setStatus("Wallet address copied.");
                } catch {
                  setStatus("Copy unavailable on this device. Select and copy the address above.");
                }
              }}
            >
              Copy Address
            </button>
            {passwordSet && (
              <p className="text-sm text-muted-foreground">
                Action Password is set. Return to your group to initiate a tip and review its
                private authorization screen.
              </p>
            )}
          </section>
        )}
        {(enrolling || intentId) && (
          <p id="password-rules" className="text-xs text-muted-foreground">
            {enrolling
              ? secureActionPasswordRules
              : "Enter your existing Action Password. Previously created passwords still work."}
          </p>
        )}
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
                    aria-describedby="password-rules"
                    type={showPassword ? "text" : "password"}
                    autoComplete={enrolling ? "new-password" : "current-password"}
                    minLength={15}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="block w-full border border-imperial bg-secondary text-white rounded p-2 pr-12 focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  <button
                    type="button"
                    aria-controls="secure-action-password"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-sm"
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" aria-hidden="true" />
                    ) : (
                      <Eye className="size-5" aria-hidden="true" />
                    )}
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
                    className="block w-full border border-imperial bg-secondary text-white rounded p-2 pr-12 focus:outline-none focus:ring-2 focus:ring-gold"
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
                    {showConfirmation ? (
                      <EyeOff className="size-5" aria-hidden="true" />
                    ) : (
                      <Eye className="size-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>
            )}
            {(enrolling || intentId) && (
              <button
                disabled={busy || !introduced}
                type="submit"
                className="border border-imperial bg-gold text-black font-medium rounded px-4 py-2 disabled:opacity-50"
              >
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
      </div>
    </main>
  );
}
