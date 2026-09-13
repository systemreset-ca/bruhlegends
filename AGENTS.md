<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## BRUH coordination

- GitHub is the durable source for code, specifications and revision history. Read `docs/AI_HANDOFF.md` and `docs/PROJECT_PLAN.md` before work; follow their source links for scope.
- Codex owns engineering and integration; Lovable owns UI and presentation; Work owns research and documentation proposals. Record accepted changes in this repository.
- Use `codex/` branches and reviewable PRs. Coordinate ownership before two tools edit the same files. Fetch current `main` before integrating Lovable changes; preserve published history.
- Every material change records its purpose, relevant specification, changed behavior, validation and remaining limitations. Report exact commit SHA and PR URL in the handoff message. Never label an untested feature as verified or deployed.
- Preserve non-custodial operation, server-verified Telegram identity, per-group wallet/stat isolation, immutable call baselines and auditable invalidations. Never store seed phrases or private keys or sign user transactions server-side.
- Keep BRUH acquisition/cash-out and real-funds launch gated until implementation and the specified validation are complete. Do not infer tokenomics or deployed configuration from draft mint notes.
- Keep secret values out of commits, chat and logs. Document variable names and purpose only.

## Owner-authorized funded wallets — 2026-09-13

The owner has revised the future wallet architecture to BRUH-generated, self-managed funded wallets, with user-authorized server signing. This supersedes the no-server-signing rule only for the separately gated custody implementation. The existing external-wallet flow remains unchanged until that implementation is ready. Preserve Telegram verification, group isolation, transaction proof and auditability. Telegram two-step verification is recommended, not claimed as verified. Never import user private keys or expose generated keys in chat/logs; require isolated encrypted custody, spending controls, stronger withdrawal/export authentication and devnet validation before real-funds activation. See decision 0006.
