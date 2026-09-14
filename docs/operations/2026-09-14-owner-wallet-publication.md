# Owner-reported wallet command publication

The owner confirmed **published** on 2026-09-14 in the original Crypto Companion Bot project (`e287f314-27c2-40bf-94f4-4685a95781fe`). Current GitHub main at confirmation was `fdae123f781867dddfe33b0881da09a813395c77`; the applied external-address schema and generated types were reviewed at `e84c185c88b1ce8ff381d9de5be70965fbf54d09`.

Independent public checks after confirmation:

| Request | Result |
| --- | --- |
| GET `https://bruh.tips/` | 200 |
| GET `https://bruh.tips/app` | 200 |
| Unauthenticated POST `https://bruh.tips/api/public/telegram/webhook` | 401 |

These prove route availability and the webhook authentication boundary, not successful authenticated wallet commands or an exact deployed SHA. Lovable browser control still timed out when inspecting the publication panel. The exact deployed commit therefore remains independently unverified; do not infer it solely from current GitHub main. The earlier publication-blocked status is superseded by the owner's report, with this verification limit preserved.

Next live acceptance check is private `/generate`, `/wallet show`, repeat `/generate` (same address), and `/wallet add <external-public-address>` followed by `/wallet external` (explicitly unverified). The second Telegram account must have a different internal address. External ownership verification, SAP, spending, withdrawals, export and retirement remain unfinished; public 200 responses do not establish those capabilities.
