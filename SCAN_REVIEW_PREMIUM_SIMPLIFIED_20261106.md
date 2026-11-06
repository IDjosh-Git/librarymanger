# Library Manager — Scan & Review: Premium Workflow Release

## What changed

**One scanning workspace:** All camera, single-book add, photo, folder and ZIP scanning controls are in **Scan & Review**. Inventory and circulation pages no longer offer separate scanning controls. **Saved Books** is a read-only register/editor, not a second scanning interface.

**Automatic import:** Choose a photo, a folder of covers, or a ZIP of cover images. Scanning starts without a separate Start step. Gemini AI cover reading and local OCR are opt-in/configurable in Scanning Preferences (both initially checked). Detected titles are automatically queued for Supabase saving by default, including separate physical copies with the same ISBN. Large imports depend on browser memory and connection quality.

**One review criterion:** Only a missing/unreadable **book title** requires review. ISBN, author, publisher, publication year, and shelf are optional; a book is never marked as requiring attention only because one of these fields is missing. Title-free copies can be named and saved from their own cover card. The grouped Inventory indicator uses a recognized title on any copy; the dashboard counts actual titleless physical copies.

**Manual Add to Library works:** Fixed a missing click listener. Enter a title or an ISBN that resolves to a title, optionally provide a shelf, and click **Add to library**. This performs a real Supabase insert, shows progress, handles failures without reporting success, and clears the form after a confirmed save.

**Selection and copies:** The visible Select All Identified / Select Duplicate Copies / Clear Selection / Save Selected controls work when recognized books are pending. **Automatically save recognized books** is enabled by default; turn it off before upload to manually select a subset or just additional physical copies. Each new photo creates a stable new record ID; a matching ISBN is not treated as a uniqueness key. A retry checks whether its record was already saved so network interruptions cannot accidentally create extra copies.

**Reliable review cards:** Fixed the filtered-card-index bug where actions could target the wrong photo after recognized and unidentified entries were separated. Saved photos disappear from pending review; failed saves retain their error and Retry Save controls. Pending review entries have durable local/cloud checkpoint support when configured.

**Premium layout:** Polished responsive hero, upload choices, progress, counters, selection toolbar, recognized cards, missing-title review cards and save controls for desktop and mobile. No extra stylesheet request added; the refinements are part of `assets/library-ui.css`.

## How to use

1. Open **Scan & Review** as an administrator.
2. Upload a folder, ZIP, or cover photos (or use Quick Scan). The scan starts automatically.
3. Leave **Automatically save recognized books** on for the simplest workflow. Turn it off **before** uploading if you want to choose books to save.
4. If titles are recognized, those books save to Supabase or appear under **Ready to Save** if manual selection is enabled / saving fails. Use **Select All Identified** or **Select Duplicate Copies**, then **Save Selected**.
5. Under **Needs a Book Title**, enter a title for each unknown cover and click **Save book**. Other fields can be filled later.
6. Open **Saved Books** or **Inventory** to view the new records and their individual Book IDs.

## Duplicate policy and safety

The connected DataLearning Supabase `public.library_books` table was inspected read-only on November 6, 2026. It uniquely identifies copies using `id` and `(user_id, record_id)`, not by ISBN/barcode. Each photo has a different `record_id`, so duplicate ISBN copies can be stored separately. No database schema change is required by this release.

Uncertain OCR/AI recognition still needs human verification. The app never invents an ISBN from a title search. An invalid or missing title cannot be saved by the simplified workflow, but a **valid-looking incorrect title** could still be extracted from a poor image; verify cover results when accuracy matters. If a database insert fails, the item remains pending for retry.

## Tests completed

- 72 Python automated project tests.
- Node integration tests: incremental scan checkpoints, retry-safe physical copy inserts, inventory grouping, saved register, Gemini cover recognition, OCR fallback, no fabricated ISBN, API error-handling.
- New isolated Node regression: title-only rules, mixed recognized/unknown batch indexes, select-all, duplicate selection, manual button wiring and ZIP restart safety.
- Browser layout checks: 320, 390, 768, 1024, 1440px and both light/dark themes for scanner; no page-wide overflow.
- Verified Supabase database constraint read-only; **no production writes or live user-upload test** were performed.

## Deploy

For your Git-connected Vercel app, replace **`index.html`** and **`assets/library-ui.css`** with the files in the update-only ZIP, commit to the repository, then let Vercel deploy. The complete ZIP contains the whole source tree.

After deployment, sign in as an administrator and test with 3–5 known book-cover photos (including duplicate ISBN copies and one unreadable title), then try a small ZIP and folder. Verify new Book IDs in Supabase / Saved Books. This live smoke test is still required to confirm your network, Gemini quota and Supabase permissions.
