# Telegram button callback delivery correction

The owner reported a Generate BRUH Wallet button pulsing without a reply. Original-project read-only Telegram getWebhookInfo inspection found allowed_updates configured as message and edited_message, excluding callback_query. Therefore inline-button callback handlers could not receive button presses. Local command-handler tests do not verify Telegram webhook subscription settings.

The operational correction adds callback_query to the existing message/edited_message subscription. Preserve the existing webhook URL, secret authentication and queued updates; do not drop pending updates or change credentials, network gates, schema or application source. Verify the subscription with getWebhookInfo after applying it, then accept a real private button press and its generated-wallet response before declaring onboarding end-to-end verified.

No password, private key, token, session value or user identifier belongs in this public record. This is an operational registration fix, not a new wallet or a separate project. Previous code publication remains the application deployment; no application republish is needed for the Telegram subscription setting.

Applied and verified in original project: setWebhook accepted; subsequent getWebhookInfo confirmed message, edited_message and callback_query on the unchanged https://bruh.tips/api/public/telegram/webhook URL, zero pending updates and no recorded webhook error. Existing derived secret authentication was preserved and pending updates were not dropped. Owner real-button acceptance remains pending.
