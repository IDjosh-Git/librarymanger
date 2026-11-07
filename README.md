# Library Manager v5.19 — AI Book of the Week

This clean release builds on v5.18 without changing the existing library colors, inventory IDs, authentication, Scan, Review, OCR or chat.

## What's new

- **Real-inventory weekly recommendations.** The server retrieves only allowed catalogue columns, deduplicates physical copies by title/author, prefers available books, samples eligible books by week, avoids recently featured titles, and asks an AI provider to choose ONE exact catalogue record ID. The AI cannot submit an invented title.
- **Explain the selection.** The AI returns a concise reason, a reading invitation, who may enjoy it, and a discussion question. These public-safe details are saved with the selected week and displayed on `book-of-the-week.html`.
- **Premium editorial design.** A navy/gold featured-book hero, clear cover, week indicator, a dedicated "Why this book, this week?" section, short reading notes, accessible buttons, and responsive desktop/mobile layouts.
- **Administrator control.** Book of the Week has **Choose this week's book**. A verified admin can generate/re-generate the recommendation. The previously supported manual featured book still takes priority until the admin enables an automatic pick.
- **Weekly scheduling.** A Vercel Cron Job runs every Monday at 02:00 UTC. It creates a stable weekly pick without a person signing in. If a manual feature exists, it leaves it alone. If the pick for the current week exists, it does not generate a duplicate.
- **Honest fallback.** When Gemini, OpenRouter and Groq are missing/unavailable or reject a response, the system selects a real catalogue title deterministically and labels the result **Weekly catalogue pick**, NOT AI selected. It never invents a book, reason or fake provider success.

## Deployment — required steps

1. **Back up Supabase.** In your existing Supabase project, run `database/04_ai_weekly_spotlight.sql` in **SQL Editor** once (after your existing Featured Book / Public Discovery tables and functions have been installed). This creates a RLS-protected weekly recommendations table and a restricted public read function. It does **not** edit inventory or loan records. Run the read-only verification queries at the bottom of that SQL script after applying. Do not rerun old numbered migrations already installed.
2. **Deploy the ZIP contents** to your existing Vercel project, preserving `index.html`, `book-of-the-week.html`, `assets/`, `lib/`, `api/`, `database/`, and `vercel.json` at project root. The new API endpoint is `/api/weekly-pick`.
3. **AI connection (required for AI to choose):** In Vercel Settings → Environment Variables → Production, configure at least one *valid* provider key: `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, or `GROQ_API_KEY`. Existing provider keys may be reused. These are free-tier services with quota limits; configure more than one for redundancy. The model can be set using `GEMINI_CHAT_MODEL`, `GEMINI_MODEL`, or `GROQ_CHAT_MODEL`. Do not paste secret keys into HTML, GitHub, or the chat. Redeploy after modifying environment variables.
4. **True unattended weekly updates (required for Cron):** In the same Vercel Production settings, add server-only `SUPABASE_SERVICE_ROLE_KEY` from your Supabase API keys and a random, long `CRON_SECRET` (at least 16 characters; 32+ recommended). Both are private secrets and MUST never appear in frontend code. These are needed for Vercel's protected Monday Cron Job to read inventory and write a weekly recommendation without a signed-in administrator. Redeploy after adding them. If not configured, the administrator's **Choose this week's book** button still works, but *unattended Monday updates will not*.
5. **First pick:** Sign in as an admin → Book of the Week → **Choose this week's book**. Open the public `book-of-the-week.html` and check the featured title and explanation. Clicking **Publish chosen book** manually overrides AI. Clicking **Choose this week's book** or **Use automatic weekly pick** clears the manual override after the weekly pick has been saved.

## Data and authorization

- The `/api/weekly-pick` POST route verifies a real Supabase Auth token and an administrator's role before accessing inventory. The scheduled GET route requires Vercel's `CRON_SECRET` and the server-only Supabase service role key. Public users cannot request AI generation through that endpoint.
- The weekly table is **not** readable by anonymous clients. Only a public-safe RPC exposes title, author, ISBN, shelf and editorial text. No borrower names, account information, loan histories, or private inventory record IDs are returned to public users.
- Do not let AI edit, delete or add inventory. Only a selected public-facing snapshot is published. The same physical book remains identified by its existing unique record ID; books with the same ISBN are not deleted or merged.
- The weekly choice is fixed for each UTC Monday–Sunday, unless an admin deliberately regenerates it. The feature prefers not to repeat titles selected in the previous eight weekly AI editions.

## Troubleshooting

- **AI did not pick / "Weekly catalogue pick":** An AI provider was unavailable, not configured, out of quota, or gave an invalid book ID. Check Production environment keys, redeploy, then use **Choose this week's book** again.
- **Unable to save / database missing:** Install `database/04_ai_weekly_spotlight.sql` first. If anonymous users can view the old Book of the Week but never see the AI explanation, confirm the new `library_public_weekly_spotlight_v2()` RPC exists and is callable by `anon`.
- **No automatic Monday update:** Verify `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are present in Production and that the new Cron Job appears in Vercel Settings → Cron Jobs. A manual administrator feature intentionally suspends automatic publishing.
- **No cover:** The page uses the ISBN-based Open Library cover when available, or its built-in book-stack image.
- **Provider is slow:** One provider is attempted, then another starts after a short delay. Free model availability and quotas are outside the application's control.

## Validation (local)

- JavaScript syntax check passed for the new public script, selection engine, admin inline code and endpoint.
- Mocked Node API tests passed for authenticated administrator generation, unauthorized calls, protected Cron requests, deterministic fallback and database save payloads.
- Pure selection checks passed for duplicate-copy grouping, eligibility, stable UTC week, previous-pick avoidance, rejecting nonexistent AI-selected inventory IDs, and public-safe fields.
- Headless Chromium layout checks passed at 320, 390, 768 and 1440 pixels in light and dark modes, with no horizontal overflow. Screenshots used illustrative *demo data*, not the user's real book records.
- **Not live-verified:** This ZIP has not been deployed, its SQL has not been applied, and third-party AI keys have not been tested against the live project. Do these steps before claiming the AI feature is live.

**Other database scripts** (`01`–`03` and `optional_*`) are retained for existing deployments. Apply only if your environment is missing their prerequisite changes; do not apply them blindly to an existing database.
