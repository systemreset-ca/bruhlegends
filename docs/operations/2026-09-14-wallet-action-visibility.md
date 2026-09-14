# Wallet authorization visibility and header image

Owner-requested private Mini App UI update only. Both password fields now have independent, accessible Show/Hide controls, initially masked and reset to masked when an action begins. Buttons never submit the form. Password values remain local component state and follow the existing direct server authorization flow.

The owner-supplied bruh_wallet.png is copied unchanged to public/bruh_wallet.png (690x584). It appears to the right of the Private Wallet Authorization heading, 64px wide on small screens and 80px on larger screens, preserving aspect ratio and allowing the heading to wrap. The supplied file's corner is opaque white, not transparent; no image generation or transformation was used.

Scope: src/routes/wallet-action.tsx plus supplied public asset and this engineering record. No landing-page marketing, bot commands, schema, secrets, fees, network gates or transaction behavior changed. Typecheck and targeted lint passed; public CI validates tests/build and fetched history before merge.
