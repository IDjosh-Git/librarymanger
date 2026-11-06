# Library Manager v5.15 — Visible Photo Headers & AI Chat Diagnostics

## What changed in v5.15

- **Visible, faded photo headers:** Scan, Review, saved scans, lending, returns, loan history, notifications, public contact and administrator directory use a single background photograph with a smooth dark-to-image fade. The background no longer disappears behind old Scan/Review rules. Existing brand colors are retained. Dashboard and inventory already have photographic faded headers.
- **AI chat diagnostics:** A failed chat now reports the problem category for each attempted AI provider (for example, invalid key, model not accessible, free quota exhausted) without showing secrets. The in-chat message no longer repeats a generic administrator warning.
- **Gemini model consistency:** Chat and ISBN enrichment honor `GEMINI_CHAT_MODEL`, then `GEMINI_MODEL`, with `gemini-3.5-flash-lite` as the default. OpenRouter and Groq remain automatic fallback providers when configured.

- **Scan books** is focused on uploading covers and folders, recognizing books, and saving completed copies. Manual entry and secondary controls are collapsible.
- **Review books** has a dedicated searchable pending queue, a consistent correction form with Save at the bottom, ISBN suggestions, saved-inventory corrections, and Advanced Tools (including Excel/CSV import and export).
- Responsive flat-card styling replaces piled gradient backgrounds in Scan/Review, with aligned inputs, accessible focus outlines, chevron dropdowns, and the **existing palette unchanged**.
- Returning between Scan and Review uses recently loaded data instead of always re-fetching. Review realtime events refresh only the review queue, and unchanged drafts no longer cause repeated cloud writes.
- Repeated identical scan image content within the active session is skipped by image-byte signature, regardless of file name. **The same ISBN is permitted for different physical copies**; each copy gets its own persistent record ID. Record IDs and a database guard prevent already saved review records reappearing as pending on another device.
- Reduced ISBN lookup waiting after provider rate limits. If metadata fetching fails, manual editing and retry remain available.

## Deploy existing app (Vercel + Supabase)

1. Back up your **existing Supabase database** before applying schema changes.
2. Upload **the contents of this ZIP at your Vercel project root**. Keep `index.html`, `assets/`, `api/`, `lib/`, and `vercel.json` together.
3. Keep using the same Supabase project and authentication settings. The client uses a **public publishable key**; never place a service-role key in the frontend.
4. Ensure Supabase's `library_books` has a `record_id` per copy and the `library_review_queue` exists. For deployments still missing these, inspect and apply `database/01_unique_physical_copy_ids.sql` then `database/02_persistent_review_queue.sql`. Run `database/03_cross_device_saved_book_guard.sql` **after both prerequisites**, if not previously applied; the previous release may already have installed it. These SQL scripts are provided for review, **not automatically executed**.
5. Existing administrator, Book of the Week, public discovery, and library-role migrations must remain installed in your existing Supabase database. This is a targeted **upgrade**, not a fresh Supabase bootstrap bundle.
6. Optional migrations: only use `database/optional_books_without_isbn.sql` if your schema rejects title-only books; `database/optional_multiple_copies_same_isbn.sql` only if a unique ISBN constraint prevents multiple physical copies. Review each SQL file before running it.
7. Configure at least one server-side AI provider key in Vercel **Settings → Environment Variables → Production**: `OPENROUTER_API_KEY`, `GROQ_API_KEY` or `GEMINI_API_KEY`. After any addition or update, **create a NEW production deployment**; earlier deployments cannot use the updated variables. Never put a provider key in `index.html` or browser JavaScript. Free providers impose quotas and cannot guarantee live web search.
8. In the inspected Vercel project `librarymanger`, `OPENROUTER_API_KEY` was added **after** the most recent Production deployment on November 6, 2026 (UTC); thus the deployed build could not yet use the new key. Redeploying the clean build is essential. A configured key may still be invalid or quota-limited; use the new provider-level error message to distinguish those cases.
9. To test chat, open AI and ask a simple question. Successful replies identify Gemini, OpenRouter or Groq. If it fails, note the provider-specific problem categories shown in the chat. For invalid API keys, replace the relevant key securely in Vercel and redeploy. For model unavailable, update `GEMINI_MODEL` and redeploy. For free quota exhaustion, retry later or configure another provider.

## Smoke-test the deployed app

Sign in on Windows and mobile with the **same Supabase account**. Scan a cover, save it to Review, fill its title/ISBN and save it. Confirm it disappears from pending review and appears exactly once in Inventory on both devices. Upload the **same image twice in one scanning session** to verify skip protection. Upload two **different physical copies** with the same ISBN and confirm they remain distinct Book IDs. Test imports, exports, offline reconnection, and permissions with your actual Supabase data. Verify OCR and AI only when configured.

## Limitations and validation

- The v5.14 base passed its previous tests. In v5.15, targeted Node API tests and the legacy scan regression passed; Chromium visually checked the new photo backgrounds at **390 px and 1440 px**, in light/dark themes, including overflow checks. These tests do not prove live provider availability.
- **No live two-device Supabase integration test was performed.** The Vercel deployment metadata and environment-variable *names* were inspected read-only, without decrypting API keys or changing the deployment. The app avoids redundant reads and writes but real network speed depends on your hosting, region, data size and client connection.
- Content-based duplicate detection currently covers **images inside the current scanning session**; it is not a guaranteed global content-hash uniqueness constraint for reuploads on all devices. It deliberately does not block different copies sharing an ISBN.
- The existing global stylesheet `assets/library-ui.css` remains because other app pages depend on it. Old extra release-note copies, patch scripts, test files, previews and the replaced Scan/Review CSS file are excluded from this deployment archive.

## Assets and attribution

The fallback library photographs are derived from Unsplash (https://unsplash.com/license): Isaac Benhesed's reading-room photograph (photo-1557818288-320deebced6c), library interior (photo-1548453282-29d422a7025a), and book-stack image (photo-1520467795206-62e33627e6ce). The app may retrieve other library photographs from Unsplash CDN and book covers from Open Library.
