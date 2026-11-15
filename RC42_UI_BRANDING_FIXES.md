# RC42 — AI layout and branding fixes

- Reservation floating button icon uses white stroke against its dark branded background.
- AI chat panel is capped at 740px desktop and constrained to the available viewport; inner chat and history regions can scroll without clipping the composer.
- Web-search helper copy is shortened to one sentence and its card padding reduced.
- Added Reset chat to the AI sidebar. This creates a new conversation, retaining saved history; Delete current conversation remains separate.
- Appearance palette changes now preview immediately. Saving requests the database-returned row and verifies the stored palette and style before confirming success.
- Guards against stale asynchronous branding refreshes overwriting a successful save or preview.
- Cache-busting version strings updated for the changed assets.

Verification: npm test 268/268; node --check on edited JS modules. Production browser and permission/RLS tests are still needed.
