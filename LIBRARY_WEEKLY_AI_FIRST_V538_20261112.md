# Library Manager v5.38 — AI-first Book of the Week

## Selection priority

1. **AI pick:** Choose one exact, eligible physical Inventory book from a bounded and varied candidate shortlist. The selected book ID is validated against the supplied inventory candidates, preventing invented titles. AI produces a short, public-safe reading reason and prompts.
2. **Manual fallback:** If no AI pick is published for the current week, a staff-approved manual selection is used when present.
3. **Catalogue rotation:** When neither AI nor a manual title is available, the server uses the deterministic weekly inventory selection.
4. **Legacy public catalogue fallback:** If no new weekly record has been created, the existing public-safe featured book function continues to supply a verified Inventory title.

Only public bibliographic fields are shown; borrowing history and user identity are never used in the recommendation prompt or public response. An incorrect AI book ID, invalid structured response, timeout, missing provider credentials or outage triggers the deterministic fallback rather than inventing metadata.

## Automatic update

- **Scheduled:** `vercel.json` retains a protected Vercel Cron request at 02:00 UTC on Mondays, using `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` exclusively on the server.
- **Self-healing on first visit:** The public Book of the Week page and reading guide request `/api/weekly-pick?ensure=1` if the weekly record is not yet published. A missing pick is generated server-side, AI first, then fallback. A saved weekly record is reused rather than regenerated on each visit. Concurrent visitors on the same function instance share a single request; database upsert handles duplicate writes across instances.
- **No blocking:** Public pages first show any existing approved catalogue selection. When the weekly pick is ready, they refresh the displayed book. The reading guide also refreshes external metadata and discards results from older book lookups.
- **Manual selection stays intact as fallback:** Selecting an AI title no longer deletes a previous staff choice. AI priority is enforced by `library_public_weekly_spotlight_v2` after the SQL upgrade.

## Upgrade steps

1. Deploy the **entire v5.38 ZIP contents** to the existing Vercel project (not a single HTML file).
2. In the connected Supabase project, apply **`database/10_ai_first_weekly_spotlight.sql`** once using the SQL editor. This updates public display priority while preserving the existing schema and data. For a brand-new installation also apply `04_ai_weekly_spotlight.sql` in the prescribed migration order.
3. Ensure Vercel Production has the following configured: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and at least one of `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`. Keep server keys private. Their *presence* was checked in the connected Vercel project on 12 November 2026; their correctness and runtime availability are not verified here.
4. After deploying, visit **Book of the Week** and verify that a row appears in `public.library_ai_weekly_picks` for the current Monday and the public RPC reports selection_source='ai' (if an AI provider is functioning) or manual/automatic when unavailable.
5. Test in staging first if possible. Do not directly modify `library_books` or private borrower data to produce the weekly recommendation.

## Verification performed

- Existing regression suite plus dedicated selection tests: 127 passing.
- Tested first-visit AI selection, verified Inventory ID, cached weekly reuse, AI outage fallback, cron authentication, public inability to force regeneration, and public-only output.
- Checked public SQL priority and server-side environmental separation.
- **Not completed:** production deployment, executing the migration on the live DB, live Gemini/OpenRouter generation, and a full browser-to-production acceptance test. Two Chromium page checks passed (public spotlight and reading guide). No existing database rows were altered.
