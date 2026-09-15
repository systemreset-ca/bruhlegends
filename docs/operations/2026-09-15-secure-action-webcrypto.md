# Secure Action Password native WebCrypto fix

Date: 2026-09-15 (America/Toronto)

## Problem

After the enrollment lease was moved behind password derivation, a real private Telegram Mini App
attempt still ended in the generic service error. A bounded read-only runtime diagnosis found no new
setup lease, enrollment call, credential or audit row. The request terminated during the
600,000-iteration PBKDF2 derivation because the deployed Worker used the JavaScript compatibility
implementation behind `node:crypto`.

## Change

`secureActionHash` now uses the runtime-native WebCrypto `PBKDF2` implementation. The password,
account-bound salt construction, SHA-256 digest, 600,000 iteration count and 256-bit result are
unchanged. A fixed compatibility vector proves that the new implementation produces the established
verifier bytes. The same helper serves enrollment and tip authorization.

Temporary password and salt byte arrays are zeroed after derivation. No password, verifier, salt,
private key, ciphertext, session token or Telegram identifier is logged or returned.

## Scope and limitations

This is a code-only Worker compatibility fix. It changes no schema, migration, database privilege,
wallet record, secret, website copy, mainnet gate, reward or token behavior. Production acceptance
still requires publishing the reviewed commit and completing one fresh private `/security`
enrollment. A successful enrollment does not itself prove a funded tip; the two-account devnet tip
remains the following acceptance step.
