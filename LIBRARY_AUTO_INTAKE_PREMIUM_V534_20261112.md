# Library Manager v5.34 — Automatic Inventory and Review intake
**12 November 2026 — source release (not deployed)**

## New scan-to-inventory workflow
1. A signed-in administrator chooses cover photographs, a folder, or a ZIP archive.
2. The existing streaming pipeline prepares, hashes, checks cloud duplicate records, and starts scanning the first accepted image while the remaining photos are prepared. Book identification uses fast barcode/ISBN matching, existing verified inventory matching, OCR, optional AI recognition, and catalogue lookup.
3. The new `assets/scan-auto-route.js` classifies each completed row **without a Save click**. Only an identified book with verified ISBN lookup, high-confidence matching title/author catalogue evidence, or confident existing inventory matching is eligible for an automatic Inventory insert. A guessed, missing, or conflicting title goes to Review, as do failed Inventory inserts.
4. Eligible books are committed to authenticated Supabase `library_books` in small overlapping batches. Individual retries reconcile by stable `record_id` and source signature to avoid creating duplicate copies after a timeout. A success count increments only after the database confirms the insert/reconciliation. The uploader then marks its corresponding photo record as `saved`.
5. Other results are checkpointed to the existing cloud-backed `library_review_queue`; the Review count increments only after cloud persistence succeeds. People may use the Review workspace to correct an image's title/details, replace its cover, and explicitly approve saving it to Inventory, or delete a bad/unwanted image (without deleting saved inventory copies).
6. A compact live progress panel, real result counters, and success/error feedback replace the two Scan tables and all manual save/selection buttons. Inventory and Review links remain immediately accessible.

## Scan and Review page design
- Premium responsive dark-navy/teal feature header, clear step-by-step language, accessible upload tiles, fewer visible controls, compact progress and confirmation sections.
- Optional recognition settings and cloud diagnostics are collapsed to keep the default screen simple; the existing manual Add Book workflow remains available.
- Review redesigned as a focused correction workspace. Existing editing, cloud drafts, cover replacement, and protected Delete Image functionality are retained.
- Responsive layout and visibility were checked at 320, 360, 390, 600, 768, 1024 and 1440px; Scan contains no visible result tables, and there was no horizontal page overflow in the browser smoke tests.

## Consistency, failure behaviour, and safety
- Cloud confirmation, not an optimistic UI update, determines whether the app reports that a book was saved to Inventory or sent to Review.
- Duplicate photo fingerprints are still protected; interrupted scans can be retried under the existing stale-claim safeguards.
- A weak OCR or AI hypothesis is **not** enough for automatic Inventory insertion. Such covers remain in Review for confirmation.
- Save failure falls back to Review; if both Inventory and Review cloud writes fail, the UI reports that the Review backup is unconfirmed. The user should retry sync before closing the page.
- No database migration, new secret, change to RLS, deletion of stored records, or modification of production deployment was performed for this source release.

## Verification
- `npm test`: **95 passed, 0 failed**, including automatic routing, confirmed cloud saves, failed-save Review fallback, duplicate prevention, Review deletion safety and prior regression tests.
- Chromium layout tests (`python tests/browser_auto_workflow.py`) passed at seven viewport widths across Scan and Review.
- The browser tests simulate a signed-in UI and mocked data. These are not real-photo OCR benchmarks and do not prove scan speed or physical-device camera behaviour on production.

## How to deploy and verify
1. Deploy the ZIP's **root contents** to the existing `librarymanger` Vercel project, retaining its existing Supabase and AI environment configuration.
2. Refresh the deployed website and sign in as an administrator.
3. Try one good ISBN-cover photo, one unclear photo, then a multi-photo batch. Verify that scanning begins before all photos are prepared, the progress increases, a verified book automatically appears in Inventory and an uncertain book automatically appears in Review.
4. Refresh on a second device to verify cloud persistence. Review a book, edit its details and save the corrected record; separately test Delete Image on an unwanted Review record. Confirm that previously saved Inventory books are unchanged.
5. Temporarily test offline/failed-network behaviour in a non-production test environment. Verify that no false success confirmation is shown, and retries do not create duplicates.

**Release boundary:** The ZIP is prepared and tested locally only. It has not been deployed to a live Vercel project, and the real cover-photo accuracy and performance have not been measured on user's devices.
