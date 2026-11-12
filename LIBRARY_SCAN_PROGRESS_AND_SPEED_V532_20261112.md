# Library Manager v5.32 — Live progress and rapid book identification

**12 November 2026 — source release; not deployed to Vercel**

## Reported symptoms
- The percentage remained at 0% while a photo was hashing, being checked against Supabase, or undergoing its first OCR/AI identification.
- Large batches took too long to identify titles and retrieve catalogue metadata.

## Changes
1. **Continuous truthful progress.** Added `assets/scan-progress.js`; progress uses three measured stages—preparation (18%), Supabase duplicate checks (12%), completed recognition or deliberate duplicate skips (70%). It shows a decimal percentage below 10% to prevent 0%-until-first-scan behaviour. UI shows separate prepared, checked, scanned, and skipped counts and updates immediately per prepared photo. Progress reaches 100% only when every image completes or is identified as a duplicate. Saving selected books uses its own 0–100% stage without stale scan progress.
2. **Earlier recognition.** First uploaded image is claimed and scanned while remaining photos continue being prepared. Later mobile/desktop chunks are smaller and backpressured, retaining v5.30 protection against duplicate, abandoned, or interrupted uploads.
3. **Fast automatic barcode recognition.** Bulk scanning runs the native detector once against ISBN-relevant symbologies, not the exhaustive full-resolution rotations or QR fallback for every cover; manual retake/ISBN controls retain deep barcode detection.
4. **Fast automatic OCR.** First-pass OCR is preferred. Extra enhancement runs only for nearly empty reads and automatic sideways retries are skipped; full multi-orientation recognition remains available from manual OCR actions. When the cover has no title, optional configured AI has a shorter bounded automatic timeout, and manual AI retains the previous timeout.
5. **Fast title search.** Automatic OCR uses at most two plausible titles searched concurrently against Open Library and Google Books with shorter timeouts. The full seven-provider catalogue workflow remains for manual title searches. When confidently matching an existing inventory title/author, the scanner can immediately reuse those fields without a network request; publisher/year/other edition fields are reused only with an exactly matching ISBN.
6. **Preserved features.** Book of the Week, Floating AI, inventory validation, incomplete Review records, bulk save, duplicate protections, cloud history, and v5.30 scan recovery stay in the release.

## Verification
- `npm test`: **70 passed**; includes 117-photo stream simulation, first-photo nonzero progress, bounded percentages, safe local title reuse, exact ISBN edition safeguards, duplicate/recovery behaviour, and existing app tests.
- Chromium UI smoke test for progress at **320, 390, 768, and 1440 pixels**: 0.2% visible at the first prepared-photo milestone, 100% at full completion, appropriate scanned/duplicate counts.
- Source syntax checks on the edited JS modules.

**Not tested:** The user's actual 117 physical cover images, production Vercel runtime, Supabase authenticated end-to-end UI, real-device OCR latency, and a timed before/after production speed benchmark. Performance depends on image resolution/quality, browser CPU, OCR resources, network quality, and catalogue/AI availability. No speed guarantee is made.

## Deployment and acceptance
1. Deploy the *contents* of this ZIP to the existing Vercel project (not a parent ZIP folder). Keep existing environment variables and database schema unchanged.
2. Hard refresh to load the `?v=5.32.0` assets.
3. First test 5 clear JPEG/PNG book covers: confirm the percentage increments during preparation, the first identification appears before all photos finish, and the correct title/author are put in Review.
4. Test mixed known and new photos: duplicate count must be correct and previously saved copies must not be reinserted.
5. Test a large batch on mobile and desktop. Compare timings to v5.31. If speed remains poor, compare OCR-only versus OCR+AI to isolate provider delays. Books that cannot be identified within the automatic fast path remain editable and can be rescanned with the manual deep readers.
6. Save the ready titles, then verify Inventory and Review from a second signed-in device.
