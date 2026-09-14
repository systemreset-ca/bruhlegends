# Correct leaderboard positioning across the website

## Goal
Present BRUH Legends as having two complementary ranking views:
- a community-wide leaderboard across Telegram;
- per-group leaderboards for each community.

Remove claims that reputations, rankings, or statistics exist only inside one group or never aggregate.

## Website wording changes
- Replace “Group-isolated reputation” with a global-community leaderboard message.
- Update the homepage description, feature card, wallet card, FAQ, command summary, metadata, and ticker so global and group rankings are both clear.
- Update the Mini App metadata and wallet explanation to distinguish the account-wide identity from group-specific views.
- Correct the token page, privacy policy, terms, and risk disclosure wherever they say rankings exist only within one group.
- Update the direct-access brand copy so future reused marketing text does not restore the wrong claim.

## Guardrails
- Keep group leaderboards; add the Telegram-wide community leaderboard alongside them.
- Keep group moderation, seasons, and local community views distinct.
- Do not change scoring, bot commands, database behavior, wallet behavior, or other backend code.
- Do not add live bot links or operational/devnet status language.

## Validation
- Search all customer-facing source for contradictory “group-only,” “never aggregate,” and “inside one group” claims.
- Run the relevant type and production checks.
- Inspect the homepage and affected public pages in the preview at desktop and mobile sizes.
