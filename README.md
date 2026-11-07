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
