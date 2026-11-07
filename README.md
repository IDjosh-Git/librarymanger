# Library Manager v5.18 — Premium Progress & Upload Controls

This release retains the v5.17 functionality and color scheme. It improves the **Scan books** file-selection tiles (folder, ZIP, individual photos) and scanning progress display without changing the scanning engine or database.

- New accessible **Choose folder**, **Choose ZIP**, **Choose photos** tiles with consistent icon alignment, short descriptions, focus states and selection feedback.
- Scanning progress now shows a measured percentage, completed/total image count and a clear status. It uses real values from the existing `batchProgress` element; it does **not** simulate progress.
- ZIP preparation, scanning, saving, completion and recoverable errors have distinct labels. Unmeasured ZIP preparation does not invent a percentage.
- The dashboard copy-availability bar and Smart Fill/Review activity messages use clearer, consistent styling.
- Mobile styling uses single-column upload selections while larger viewports use a three-column row. The existing theme colors are preserved.

Files added: `assets/premium-progress-upload.css` and `assets/premium-progress-upload.js`. They load **after** the v5.17 design assets. No Supabase migrations or AI settings need to be changed for this release.

Verification: JavaScript syntax checked; scoped browser tests at 320, 390, 768 and 1440 pixels passed; file selection, scanning counters, completion status and ZIP preparation state passed. Actual end-to-end Supabase scanning and third-party API timing were not tested here.

---

# Library Manager v5.16 — Review OCR + AI Auto-fill

This release upgrades **Review books** in the existing Library Manager application without changing your design colors, authentication model, Supabase inventory IDs or previous photographed headers.

## New review workflow

1. In navigation, open **Review books**. Use **Auto-fill missing details** to process the first 10 pending incomplete records (ISBN and/or cover image available), plus up to 5 saved inventory records with an ISBN. Run again for the remainder.
2. OCR and AI toggles are visible beside this action; their states stay synchronized with the Scan page and with each device's existing settings. With the AI toggle off, automatic cover recognition uses local OCR only. With OCR off, it uses AI only. Both off means ISBN catalog lookup only.
3. Every pending review card has **Auto-fill details**, **Read OCR**, **Read AI**, and **Replace photo / Add cover photo**. Auto-fill checks a valid ISBN first; if the title is still missing, it attempts image recognition based on the toggles. **Read OCR always uses local Tesseract OCR**, even when AI is enabled; **Read AI** explicitly requests the AI vision provider even if the global toggle is off.
4. Suggested titles, authors, publisher, and publication year remain editable on the card; review them against the physical book before clicking **Save book** or **Save all corrected**. Auto-fill never calls the inventory save function or creates a duplicate copy on its own.
5. Under **Saved books needing attention**, **Find by ISBN** creates a proposal for the existing saved copy. **Read cover photo** lets you attach a fresh photo and get an AI/OCR suggestion; select **Apply suggested details** to update the **existing** Supabase record. This action does not insert a new inventory record. A suspected cover/ISBN mismatch is flagged for manual verification.
6. If a Review record has no original image (or only a low-resolution restored thumbnail), use **Add/Replace photo** for the most accurate OCR result. A compressed photo preview persists with pending Review rows so cross-device review remains possible, but full-resolution photos are not stored there.

## Deployment

- Upload the **ZIP contents** to the existing Vercel project, keeping `index.html`, `assets/`, `lib/`, `api/`, and `vercel.json` at the project root.
- Keep your existing Supabase configuration and previous database migrations. **No new SQL migration is needed** for v5.16.
- Local OCR recognition uses Tesseract.js, loaded on demand from its CDN; a connection is required to download its engine and language data if they are not cached. The image is processed on your device.
- AI vision uses `/api/book-vision` and requires at least one valid **Production** key in Vercel (`OPENROUTER_API_KEY`, `GROQ_API_KEY`, or `GEMINI_API_KEY`) with access to a vision-capable model. Free providers can be rate-limited, unavailable, or incompatible with photos. If no AI provider works, local OCR, ISBN catalogue search and manual editing remain usable.
- Adding or changing a key requires a **new Production deployment**. Do not put API keys in public JavaScript or share them in chat.

## Validation and limitations

- Automated Node regression tests confirm mode separation (OCR-only vs AI-only), ISBN-first completion, fallback to local OCR and explicit approval before saved inventory changes. The existing provider fallback diagnostic tests passed.
- Browser layout checks passed at widths 320, 390, 768 and 1440 pixels in light/dark themes with no horizontal overflow and accessible per-book actions. These tests use representative review records.
- Actual OCR accuracy depends on lighting, language and cover resolution; AI suggestions are not verified facts. Always check edition and ISBN before saving.
- No live provider-token calls, live Vercel redeployment or two-device Supabase integration test was performed in this release.

---

## Existing release functionality

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


## v5.17 — Compact messages and recognition switches

- AI and OCR remain enabled/disabled exactly as in v5.16, but use a compact two-switch layout on mobile.
- The Scan and Review recognition explanations are behind **+ How it works**, with a **−** control to close.
- Longer informational notes on cards in Overview, Inventory, Scan, Review, circulation, and scanned-books pages display a short preview with **+ Read more / − Show less**. Statuses and editing controls are not collapsed.
- The existing accordion sections also show **+ / −** instead of ambiguous chevrons.
- No database migration or changes to provider keys are required for this visual update.
