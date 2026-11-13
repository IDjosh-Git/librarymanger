## Library Manager v5.37 — Full post-fix regression audit and safety hardening (12 November 2026)

This release is based on v5.36 and performs a fresh regression review of the Scan, Inventory, Review, Book API, AI/OCR settings and duplicate-upload workflows. The previous suite passes, with new tests added for source identity and latency safety.

**Corrections:**
- A title-and-author match in Inventory is now **work-level evidence only**. It may help complete recognition, but cannot authorize automatic inventory insertion or copy edition fields unless the scanned ISBN has a valid checksum and matches the existing edition. `inventoryEditionMatched` is explicitly required by the auto-route guard.
- Work-level title-search results can supply title, author and subject, but no longer silently populate publisher, edition publication date or page count from an unverified edition.
- A bounded Book API fallback budget avoids continuing slow upstream lookups beyond the browser's lookup deadline. Open Library pacing is included in that budget rather than causing extra hidden delays.
- Automatically skipped duplicate uploads release their local image previews to reduce memory retention during large batches.
- Updated cache-busting for the changed Scan modules.

**Verified locally:** `npm test` passes **120 tests**; Chromium Scan/Review responsive smoke tests pass at 320, 360, 390, 600, 768, 1024 and 1440 px, and Recognition Settings and ISBN routing integration pass at four widths each. All JS modules pass Node syntax checking, and the app page contains no duplicate element IDs.

**Supabase read-only consistency check:** At audit time, the connected library had 842 inventory books, 70 pending Review records and zero processing upload markers; checks found zero duplicate source-photo fingerprints, zero pending Review rows already present in Inventory and zero saved upload markers lacking an Inventory match. No production data was modified.

**Not yet verified:** External catalogue provider availability and optional paid API credentials, the currently deployed Vercel website's version, performance/accuracy on the user's original book photos, and physical Android/iOS devices. These require a live deployment acceptance test, including both AI/OCR settings, valid/extended ISBNs, blurry images, API outages, saving confirmation, and cross-device Review sync. **Passing local tests is not a guarantee of defect-free production behaviour.**

**Deployment:** Deploy the ZIP's root contents to the intended existing Vercel project, preserving its current Supabase and AI environment variables. No new SQL migration is required for these changes. Prefer a preview deployment and test it with sample book photos before promoting to production.

See `LIBRARY_REGRESSION_AUDIT_V537_20261112.md` for detailed test and safety notes.

---

## Library Manager v5.36 — ISBN-13/extended barcode and Book API conflict fix (12 November 2026)

Book metadata lookup now uses a shared ISBN normalization and checksum policy across the browser, API, scanning, automatic Inventory/Review routing, and inventory title grouping. ISBN-13 codes with EAN 2/5-digit supplements and GTIN-14 padding no longer fail Review routing due to their original length. The catalogues are prioritized to avoid redundant lookups, with exact-ISBN checks, conservative field merging, conflict reporting, and specialist providers as fallbacks. Valid ISBNs with no verified title still go to Review safely. See `LIBRARY_BOOK_API_ISBN_RELIABILITY_V536_20261112.md` for details and limitations.

**Verification:** 113 automated tests passed and Chromium module integration passed at four screen sizes. External APIs were mocked for functional tests; their live production uptime, API-key configuration, and real-photo scan speeds have not been verified. **Deploy this ZIP root to the existing Vercel project** to activate the source update. No SQL migration.

---

## Library Manager v5.35 — Book API, OCR and AI in one coordinated workflow (12 November 2026)

Book API/ISBN lookup remains the first authoritative detail source. When it cannot provide sufficient bibliographic data, optional local OCR extracts ISBN/title evidence for another catalogue search and supplies text that can help optional AI read the cover. Verified sources outrank unverified suggestions, and Inventory/Review routing remains automatic. OCR and AI toggles have moved to **Account settings → Book recognition settings**, and they are absent from Scan and Review. The old v5.33 Scan-table stylesheet has been removed. See `LIBRARY_RECOGNITION_ORCHESTRATION_V535_20261112.md`.

**Tests:** 103 automated checks passed; Chromium responsive Scan/Review smoke test passed at seven widths and account-settings toggles at four. These local tests do not establish a 90% detail-fill rate or production scanning speed. **The ZIP is not yet deployed.**

---

## Library Manager v5.34 — Automatic book intake and premium Scan/Review (12 November 2026)

Scan is now fully automatic: recognized book covers with verified evidence are saved directly to Inventory while processing continues; uncertain/failed results are queued in cloud Review. The Scan results tables and manual save/selection controls have been replaced with outcome counts and confirmed success/error messages. The Scan and Review layouts were redesigned for simple responsive use, while Review retains edit/replace/delete actions. **The code release is not deployed.** See `LIBRARY_AUTO_INTAKE_PREMIUM_V534_20261112.md` for routing safeguards, 95 tests, browser checks and deployment instructions.

---

## Library Manager v5.33 — Scan / Review workflow audit (12 November 2026)

See `LIBRARY_WORKFLOW_AUDIT_V533_20261112.md` for the consolidated audit, corrected workflow, Review Delete Image behavior, test evidence, deployment instructions, and known limitations.

# Library Manager v5.32 — Streaming Scan Progress and Fast Book Identification

See `LIBRARY_SCAN_PROGRESS_AND_SPEED_V532_20261112.md` for the progress fix, automatic fast recognition, verification and deployment steps. This is a source release; it is not deployed to the live website.

# Library Manager v5.31 — Stream scans during photo upload (12 November 2026)

This release restores immediate, overlapping scanning: recognize the first few verified images **while** later photos are hashed, deduplicated, and (for ZIPs) decompressed. It prevents the former wait for the whole batch before recognition, favors local OCR before slower AI when both are enabled, reduces cloud checkpoint overhead, and preserves v5.30 duplicate protection and interrupted-scan recovery. See `LIBRARY_SCAN_SPEED_STREAMING_V531_20261112.md` for technical details, safeguards, testing and deployment steps.

**Source release only; not yet deployed.** Deploy the ZIP root contents to the existing Vercel `librarymanger` project, preserving existing configuration. No new Supabase migration or secret is needed. Local tests: **60 passed**. Layout tested at six desktop/mobile viewport widths. Full real-world upload timings and physical-device scanning require validation after deployment.

---

# Library Manager v5.30 — Photo upload recovery and responsive Save controls (12 November 2026)

This release fixes abandoned photo scan reservations that previously caused repeated uploads to be rejected as already uploaded before their book details reached Review or Inventory. The **111 old processing claims** observed in the connected Supabase project were verified to have no matching Inventory or pending Review records. The updated uploader **recovers stale, owned, orphaned claims automatically when those same files are selected again**. The database records themselves are not deleted or rewritten by installing this ZIP.

Changes: safe 10-minute stale-claim recovery across devices, bulk cloud recovery for large folders, reliable scan checkpoints to Review, an AI-only recognition fix, retryable file selections, actionable Mark all/Save buttons, clearer scan-status messages and improved mobile/tablet touch layout. See `LIBRARY_SCAN_RECOVERY_V530_20261112.md` for the root cause, validation steps, limitations and deployment instructions.

**Deploy this ZIP root to the existing Vercel `librarymanger` project and hard-refresh.** No new Supabase schema migration, credential or destructive database reset is required. 49 automated tests pass. The release was validated with a mocked browser layout at six viewport widths; actual camera/photo recognition on specific physical devices and live Vercel deployment remain to be verified.

---

# Library Manager v5.29 — Inventory-grounded AI and verified outside-book research (12 November 2026)

Floating Library AI now validates every requested inventory book against the real `library_books` records for the signed-in member, instead of relying on browser context or unverified model guesses. It reports live bibliographic/copy information and enriches it using **verified Google Books/Open Library records**. The existing **Search the web** option remains available for broader Gemini-grounded research, when configured. No private borrower records are sent to the model. See `LIBRARY_AI_INVENTORY_EXTERNAL_RESEARCH_V529_20261112.md` for exact implementation, privacy boundaries, limitations and smoke tests.

**Deployment required:** This is a complete ZIP code release for the existing Vercel `librarymanger` project, not a live deployment. Deploy the ZIP root contents, keep existing Supabase and AI keys, hard-refresh after deployment. No required SQL schema change; optional updated app-help text is in `database/09_library_ai_inventory_knowledge_update.sql`. `npm test` currently passes **41** tests.

---

# Library Manager v5.28 — Live Book of the Week in Library AI

Library AI is now connected to the **published** Book of the Week through the existing Supabase `library_public_weekly_spotlight_v2()` RPC, the same public-safe source used by the featured-book page. Direct factual questions are answered from that record instead of generic disclaimers. The assistant is also grounded in verified app workflows and relevant Supabase help articles. See `LIBRARY_AI_LIVE_SPOTLIGHT_V528_20261112.md` for changes, privacy boundaries and deployment tests.

**Release note:** This ZIP is a code release. Upload/deploy its contents to the existing Vercel `librarymanger` project to activate the updated chat endpoint. No new database migration is needed for the currently connected Supabase project. Local tests: `npm test` (25 passing).

---

# Library Manager v5.27 — Supabase floating AI chat persistence repair (12 November 2026)

- **Fixed confirmed PostgREST PGRST102 (HTTP 400):** The former bulk insert sent a user record and AI record with different JSON keys. Supabase rejected the batch. The new server saves each message with one consistent JSON shape and checks that Supabase returned the inserted record.
- **Automatic cloud history:** Opening the assistant initializes/reuses an owned conversation in Supabase. User questions are persisted **before** AI generation and AI replies are persisted separately. If the AI provider fails, the user's question remains saved. Reloading the assistant reads private history from Supabase, never from browser storage.
- **Minimal connection status:** The former text banner and its “Not saved · Check Supabase or your connection” warning are gone. Only a small status dot appears beside **Library AI**: **green** after confirmed Supabase access and **grey** when signed out, offline, loading or disconnected. The dot includes a screen-reader label and hover description.
- **Reliability:** Server-side Supabase errors now log the HTTP status and PostgREST code for diagnosis without exposing database internals to readers. Failed writes no longer falsely claim an answer was saved, and the AI reset remains account-scoped.
- **Database:** Reuses existing `library_manager_ai_*` tables and RLS in the linked Supabase project. **No database migration or credential change is needed.** A safe signed-in-role database insert test passed inside a rolled-back transaction; no production conversation content was modified.
- **Validation:** `npm test` passes all 18 checks, including save/reload, failed provider, failed user save, failed assistant save, reset isolation, and the dot-only UI. Syntax checks pass.
- **Deployment:** This ZIP is the corrected source build; it has **not** been deployed to the live Vercel `librarymanger` project. Deploy the ZIP contents (not the containing folder) to the existing project, retaining its environment variables and directory structure. Hard-refresh afterward to load the cache-busted `book-guide.js?v=5.27.0` and `book-guide.css?v=5.27.0` assets.

See `LIBRARY_AI_PERSISTENCE_FIX_V527_20261112.md` for the technical fix, smoke test and release checklist.

---


## v5.26 — Daily Usage Register (Supabase-backed)

- **For members:** New **Check in / out** page (`#dailyLog`) with a real server-stamped daily visit, an optional visit purpose, up to 12 books read, notes, check-out confirmation and private history. The logged-in user sees only their own visit records. The user is not checked into the reading room merely by signing into the website.
- **For administrators:** **Daily usage log** (`#attendance`) in **Monitor & Reports**, with server-side pagination, WAT date and time, verified member email, duration, open/finished status, purpose, reading details, date/status/book/name filters and CSV export. Accounts without a visit check-in do not appear in this report.
- **Security:** Supabase enforces RLS by `library_member_roles` and `auth.uid()`. Database-generated timestamps cannot be set by the client; only an explicit member check-in creates a record. Privileged changes to other application tables are not required. Existing Library Manager features and Library AI history remain intact.
- **Migration:** `database/08_library_daily_visit_register.sql` (already applied to the connected `DataLearning` Supabase project `hotysnqorkqbiconjskl`; run when deploying to another Supabase project).
- **Live deployment:** Not performed. Upload/deploy this updated project to the existing Vercel `librarymanger` project before expecting live users to see the two new pages.

# Library Manager v5.25 — Supabase AI assistant, Reset & app knowledge

This is the complete v5.24 Library Manager project updated with **Library AI cloud chat**, a working **Reset** button, and 30 verified app-help articles in Supabase. Read [LIBRARY_AI_SUPABASE_RELEASE_20261112.md](LIBRARY_AI_SUPABASE_RELEASE_20261112.md) for implementation, security, tests and deployment instructions. The Supabase migration is already applied to the connected project; the Vercel frontend/API deployment remains pending.

---

# Library Manager v5.24 — Add Photo preview fix

This release builds on v5.23 and fixes the broken cover-image preview when a photo is added or replaced in Review.

- A small, browser-decodable JPEG thumbnail is generated first and used for the displayed preview and synced Review drafts. Temporary `blob:` URLs are no longer preferred for cards.
- Thumbnail compression retries at lower sizes rather than dropping a large preview when the first encoded image is too big.
- Unreadable, damaged or unsupported image formats show a clear placeholder/instruction instead of a broken-image icon. The Replace photo action preserves the previous photo if the new one cannot be displayed.
- High-resolution source photos still feed OCR, AI recognition and ISBN cropping, so preview compression does not weaken recognition quality.
- Image uploads that cannot be decoded may need conversion to JPEG, PNG or WebP; some browsers cannot display HEIC/HEIF or AVIF images. The UI reports the problem rather than pretending the photo was added.
- No change to ISBN, deduplication, book inventory, cloud schema or existing library color scheme.

## Deployment

Deploy the ZIP's root files to the existing `librarymanger` Vercel project, preserving `assets/`, `api/`, `database/` and `lib/`. No new Supabase migration or environment variable is needed. Refresh the page after deployment, then use Review books → Add cover photo on an unfinished book and confirm that the thumbnail appears; refresh and confirm it remains visible. Test replacing the photo with another JPEG/PNG and verify the original remains unchanged if a corrupt image is selected.

## Local validation

The photo-preview browser tests passed at 390px and 1440px for a valid image, persistence after rehydration, and the broken-image fallback. The v5.23 OCR regression tests, application JavaScript syntax checks, and all JS asset syntax checks passed. Live production/browser-device testing has not yet been performed.

---

# Library Manager v5.23 — Fast Adaptive OCR & Premium Reading Guide

This is a full application build based on v5.22. It preserves the existing mobile navigation and floating AI orb, Supabase Review and Inventory workflows, duplicate-upload guard, book chat, and weekly-pick features.

## Faster, more accurate OCR (Scan + Review)

- **Fast first pass:** Reuses an already-warmed Tesseract.js worker and recognizes the cover once at a device-aware image size. High-confidence results finish immediately.
- **Conditional second pass:** Only low-confidence covers are retried with greater resolution and grayscale/contrast correction. Sideways retries run only when the initial results are exceptionally weak.
- **Bibliographic evidence:** A valid ISBN (using the existing ISBN checksum extractor), plausible title lines, and OCR confidence help decide whether a second pass is worthwhile. Longer output is no longer automatically considered better.
- **Constrained resource use:** Low-memory devices get smaller images and one worker; a second worker is available only on sufficiently capable devices. Worker reuse and cancellation paths are preserved.
- **Human verification:** OCR still proposes text for Review; it cannot guarantee perfect recognition, especially on blurry images, ornate fonts, or poorly photographed barcodes. AI/ISBN lookup remains optional, and book details must be verified before saving.

The OCR process runs on the device; no new OCR API key is required. Clear images normally require one pass, while difficult images can still take longer. Real-world time savings depend on phone hardware and photo quality.

## Premium Book of the Week + detailed reading guide

- The featured book card now links directly to **`reading-guide.html`** via **Explore the reading guide** and **Read the full book guide**.
- The new responsive guide offers the title/author, verified description where available, the weekly recommendation and reader value, topic chips, intended audience, discussion prompt, shelf/ISBN, and outbound catalogue references.
- The reading guide loads the existing public-safe `library_public_weekly_spotlight_v2()` Supabase RPC. It does **not** query private inventory or borrower records.
- For a book description, the page checks a matching Open Library ISBN/work entry first, then a matching search result. If no synopsis is found, it optionally checks a matching Google Books entry. It never silently substitutes a mismatched title or claims AI has read the book. The first paint does not wait for those lookups.
- If neither source has a description, it clearly says so and retains the verified weekly explanation and reading prompts. External metadata services can be slow, rate-limited, or unavailable; they do not block Book of the Week.
- The page retains light/dark mode and the existing navy and warm-gold aesthetic.

## Deployment

1. Deploy the contents of this ZIP to the **same** Vercel `librarymanger` project, preserving `assets/`, `api/`, `lib/`, `database/`, `index.html`, `book-of-the-week.html`, and **`reading-guide.html`**.
2. Keep the Supabase configuration and AI provider environment variables from your current installation. **No new environment variable or database migration is required for v5.23.** Older migrations such as `04_ai_weekly_spotlight.sql` and `05_duplicate_upload_guard.sql` must already be installed for those earlier features.
3. After redeploying, hard-refresh your browser. Scan one clear photo and one difficult photo, check OCR suggestions in Review, then open Book of the Week → **Read the full book guide** on mobile.
4. The featured book's AI recommendation still requires the existing weekly-pick server workflow. This release changes the reading experience, not the weekly scheduler.

## Verification completed locally

- Browser-rendered public pages at 320, 390, 768, and 1440 pixels: no horizontal overflow, correct book content and working guide link.
- Mocked Open Library response: the guide displays the catalogue synopsis and topic chips, with direct source links. Google Books is used only as a fallback.
- Mocked Tesseract worker: strong-cover recognition completes in one pass, poor initial recognition retries and selects the better result, and OCR resources are released. Inline application JS and new JS assets pass syntax checks.
- Browser preview images illustrate the layout with *The Secret Garden* rather than a live production selection.

**Not verified:** actual elapsed OCR performance on all phones, live third-party catalogue responses, the user's deployed weekly AI scheduler, or a new production deployment. Testing used deterministic mocks without accessing private library records.

---

# Library Manager v5.22 — Complete Mobile Navigation & AI Orb

This UI update builds on v5.21 and retains its existing colors, roles, OCR/AI, scanning, inventory, Book of the Week, and duplicate-upload protection.

## Changes

- **Fixed clipped mobile navigation:** Removes an old horizontal translation that shifted the bottom navigation off-screen. Five administrator shortcuts now fit across mobile widths; circulation users have three evenly sized shortcuts.
- **Complete More menu:** A taller, scrollable menu respects the top/bottom safe areas, keeps the header visible during scrolling, and provides access to every authorized page, quick tool, and account settings, even on short screens.
- **Compact floating Library AI:** Replaces the large text pill with a single 51px animated orb on mobile (56px on desktop). The chat opens with the existing button; the orb disappears while the chat or the mobile navigation drawer is open.
- **Accessible interaction:** The AI button retains its screen-reader label, visible focus state and keyboard activation. Animation is disabled when reduced motion is requested.
- **No brand or data changes:** This is a UI-only release. No new Supabase migration, model key or server configuration is required beyond earlier features.

## Deployment

Deploy this ZIP's root contents to the same Vercel `librarymanger` project. Do not place the entire folder inside the site root; preserve the `assets/`, `api/`, `lib/` and `database/` directories. After deployment, refresh the page (and clear cached assets if an older navigation is still shown).

The new stylesheet is `assets/mobile-navigation-ai-orb.css`, linked after the earlier navigation styles in both `index.html` and `book-of-the-week.html`.

## Validation and limits

- Static CSS browser checks at 320×568, 390×844, 768×960, and 1440×900 confirmed that the navigation stays within the viewport. The full menu can scroll on short phones.
- The actual Book Guide JavaScript was tested for opening and closing via its new orb at mobile, tablet and desktop sizes.
- Application JavaScript passed syntax checks. Signed-in production navigation and live Vercel behavior still need verification after deployment.

---

# Library Manager v5.21 — Premium Navigation, Access Controls & Compact Inventory

This release builds on **v5.20** and preserves its duplicate upload protection, OCR/AI Review workspace, Book of the Week, Supabase data persistence, authentication and loan functions.

## What improved in v5.21

- **Desktop sidebar:** Clear navigation groups, consistent icon alignment, readable light/dark text, improved active-page indicators, and refined Quick Actions.
- **Mobile navigation:** A five-item, safe-area-aware bottom dock for administrators, a compact two-column More menu, and role-specific page visibility. Buttons and labels remain reachable at phone widths.
- **Book API settings:** The optional browser Google Books key form now uses concise labels, accessible inputs and compact Save/Remove actions. Longer provider instructions are under **API setup & privacy**. Private server keys must remain in Vercel environment variables; the browser key is only an optional legacy fallback.
- **Administrator access codes:** A compact, expandable Generate access code section with a prominent Generate new code button, a one-time code display, and Copy code action. Generating a new code still revokes the previous one.
- **Inventory search & filters:** The search field is full-width on phones, with compact Filter, Sort, Per page and view controls. The Data quality tools section can expand only when needed, and Scanned books appears as a single-row shortcut rather than a large card. The filter dialog has clearer chips and dropdowns.
- **No theme replacement:** Existing light/dark colors and the established accent gradient are retained. One final stylesheet (`assets/premium-navigation-filters.css`) handles these refinements.

## Deploy

1. Keep your existing Supabase project and Vercel environment variables. No new migration is needed **for the v5.21 interface changes**.
2. **Important for v5.20 users:** the prior `database/05_duplicate_upload_guard.sql` migration must already be applied before scan uploads can use cloud duplicate protection. Similarly, the AI weekly spotlight needs its earlier migration/configuration.
3. Deploy the files from this ZIP to your existing `librarymanger` Vercel project, maintaining the file/folder structure.
4. Redeploy and verify the Inventory search/filter, mobile More menu, Book API settings, administrator code controls, and dark mode on a signed-in account.

## Verification

- Inline application JavaScript passed Node syntax validation.
- Responsive/rendered-control checks passed at 320, 390, 768 and 1440 pixels, including opening Data quality tools, role-specific mobile navigation, and checking form IDs.
- Eight upload deduplication regression tests still pass.
- Live user/account API requests and production Vercel deployment have **not** been performed in this release; the controls reuse the existing event handlers.

---

## Previous v5.20 release and database notes

This is the complete production-oriented source bundle, based on v5.19, preserving AI Book of the Week, Scan, Review, Inventory, OCR and other existing pages.

## What changed

- **Upload-once protection** across **Choose photos**, **Choose folder** and **Choose ZIP**. Every image is identified using an SHA-256 digest of **all file bytes** (not the name, path, timestamp or ISBN).
- The same exact image can appear many times in a folder, in a ZIP, or be re-uploaded later from another device: **only the first upload is admitted**; subsequent copies are skipped before OCR/AI.
- A new, access-controlled Supabase `library_scan_files` registry holds the hash across browser sessions and staff accounts. Atomic database uniqueness avoids a race if two devices upload the exact image at once.
- Once the image is saved to Inventory, `library_books.source_signature` adds another unique constraint, so duplicate photos cannot create extra saved physical copies even if a save is retried.
- **Different cover photographs** of separate physical copies with the same ISBN are still allowed. Never deduplicate library books purely by ISBN or title.
- Stopped scans release the reservations for **unprocessed** images. Recognized images remain in the durable Review queue; replaced cover photos are also checked.
- Scan status reports how many **new** photos are scanned and how many **repeated** photos were discarded, without claiming OCR/AI was run for skipped images.
- Cloud verification is **fail-closed**: if the new table is missing or Supabase cannot be reached, scanning stops with a specific message rather than risking duplicate inventory records.

## Required setup before deploying

1. In the **DataLearning** Supabase project, back up the database and run **`database/05_duplicate_upload_guard.sql`** in SQL Editor. It is additive and does not remove old inventory or history.
2. Ensure your prior database upgrades (`01` through `04` as applicable) are already in place.
3. Upload/deploy the files in this ZIP to the existing `librarymanger` Vercel application. No new API key is necessary for duplicate detection; regular Supabase user authentication is used.
4. Redeploy and sign in. Test by uploading a photograph, uploading that exact file again under a different filename, and then uploading a ZIP containing that same photo. Later attempts should show **duplicate discarded** with **no additional Review or Inventory record**.
5. Test the same photograph from a second signed-in device. Only one new record should be accepted.

## Important scope and recovery notes

- **Historical limitation:** Older saved books generally do not have the original photograph or a hash stored. The new guard cannot reconstruct fingerprints for photos already saved before this upgrade. New uploads are protected from the moment the migration is installed.
- **Exact duplicate** means same image bytes. A retaken, cropped, edited, recompressed or rotated picture is technically a different file and may not be detected as the same book. Barcode/ISBN equality is not used as proof of duplicate physical copies.
- If an upload is interrupted by closing the browser before a photo is added to Review, a temporary `processing` claim may remain. Such a claim should only be cleared by an administrator after confirming that neither Review nor Inventory contains the image. Never delete saved fingerprints to bypass this guard.
- Photo bytes are **not sent to the duplicate registry**. Only SHA-256 fingerprints, record IDs and status are sent to Supabase; OCR and cover recognition retain their existing data-handling behavior.
- The cloud table is guarded with authenticated Row Level Security policies. Do **not** expose service-role keys in browser code.
- The new migration has **not been run on your live database by this ZIP**. The app will show a setup error until it is applied.

## Verification

The new duplicate-guard module passed local automated tests for identical bytes with different names, renamed ZIP/folder files, one-byte changes, concurrent device claims, saved-record reuploads, cancellation cleanup, missing database migration, and valid different-copy photos sharing an ISBN. The application inline JavaScript and updated scripts passed syntax checks. Live production behavior needs verification after migration and deployment.

## v5.38 — AI-first weekly selection

The Book of the Week feature now tries AI before other selection methods and can generate the missing weekly pick on the first public visit. The priority is AI > manual editorial fallback > automatic catalogue rotation > legacy public catalogue recommendation. Deploy the app and apply `database/10_ai_first_weekly_spotlight.sql` to update the existing public RPC. See `LIBRARY_WEEKLY_AI_FIRST_V538_20261112.md` for setup and tests.
