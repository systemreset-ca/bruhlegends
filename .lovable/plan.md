# Remove devnet-beta messaging from the website

## Changes
- Remove customer-facing references to “devnet beta,” “test network,” and “no real funds” from the homepage, token page, Mini App, privacy page, terms page, and their search/social descriptions.
- Replace those passages with product-focused descriptions of call tracking, group reputation, wallet creation, and community recognition.
- Remove the homepage beta badge and operational limitation tagline.
- Keep necessary in-context safety warnings where a transaction screen could otherwise cause someone to send funds on the wrong network; do not market those warnings elsewhere.
- Keep the factual statement that `$BRUH` is not minted yet and is not currently offered for sale.

## Scope
- Customer-facing presentation and wording only.
- No bot/server logic, wallet behavior, database, configuration, secrets, or deployment changes.
- Historical operation records remain unchanged.

## Validation
- Search all customer-facing source for remaining beta/status wording.
- Check the homepage, token page, Mini App, privacy page, and terms page in the preview.
- Run the production build. Do not publish.
