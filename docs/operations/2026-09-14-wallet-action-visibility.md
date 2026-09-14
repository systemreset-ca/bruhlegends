# Wallet authorization visibility and header image

Owner-requested private Mini App UI update only. Both password fields now have independent, accessible Show/Hide controls, initially masked and reset to masked when an action begins. Buttons never submit the form. Password values remain local component state and follow the existing direct server authorization flow.

The owner-supplied bruh_wallet.png is copied unchanged to public/bruh_wallet.png (690x584). It appears to the right of the Private Wallet Authorization heading, 64px wide on small screens and 80px on larger screens, preserving aspect ratio and allowing the heading to wrap. The supplied file's corner is opaque white, not transparent; no image generation or transformation was used.

Scope: src/routes/wallet-action.tsx plus supplied public asset and this engineering record. No landing-page marketing, bot commands, schema, secrets, fees, network gates or transaction behavior changed. Typecheck and targeted lint passed; public CI validates tests/build and fetched history before merge.

Owner asset correction: the header now uses the supplied bruh_wallet_transparent.webp (768x640), copied unchanged. The original PNG remains in revision history. Display sizing and password controls are unchanged.

Owner usability correction: display the full 15–128 character / 256 UTF-8 byte policy, explicitly state no uppercase/numeric/symbol requirement, and validate exact confirmation locally before submitting. Enrollment returns allowlisted public failure messages separating authentication, setup state and service failures from password format. Unknown errors do not expose internal exception details. Apply byte validation before acquiring an enrollment lease. No signing or authentication protections were removed. Policy boundary tests and public CI validate this change.

Owner policy/presentation revision: new enrollment requires 15–128 printable ASCII characters, at least one uppercase A–Z and one non-alphanumeric punctuation character; no whitespace, emoji or non-ASCII. Digits are allowed, not mandatory. Apply the same policy in client, request validation and server before the setup lease. Previously enrolled passwords remain valid for authentication, preserving account access.

Private wallet UI only: exact owner instruction/rule copy, smaller grey rules, sans medium heading, existing obsidian/purple/gold design tokens, purple/white fields, eye/eye-off controls and gold/black/purple action button. Immediate animated loading indicator (respects reduced motion) replaces the form until initialization finishes. Existing accessible dialog primitives provide a BRUH introduction with existing Terms/Privacy links, Cancel and Continue; Continue does not authorize funds or serve as a stored legal acceptance record. Telegram owns its native launch agreement. Its pre-WebView loading customization is a BotFather setting; this source supplies the in-app loader and invokes ready/expand, with no artificial delay or new network polling.

Owner popup-copy correction: clarify internal BRUH Wallet menu actions and remove the secondary maximum/keyboard/confirmation explanatory line. Validation policy is unchanged. Recent enrollment failure is being diagnosed read-only against original managed backend; no password contents are required or logged.
