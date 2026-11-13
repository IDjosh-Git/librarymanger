# Library Manager v5.35 — Recognition source coordination and Settings cleanup

**12 November 2026 · Full source release · Not yet deployed**

## Recognition order

The scanner automatically prepares and checks photo fingerprints while earlier photos are being scanned. For each accepted image:

1. **Book API is the authoritative first detail provider.** Decode a visible ISBN/barcode using the fast scanner and query the existing server-side multi-catalogue lookup. Exact ISBN metadata is preferred; a conflicting title does not silently overwrite the existing title.
2. **Local OCR is the source of additional search evidence when enabled under Account settings.** If exact-book data is missing or a verified record has no author, extract text from the image. OCR may recover an ISBN to run another authoritative Book API query; otherwise candidate title lines are searched in the catalogue. High-confidence matches must satisfy the existing title/author evidence safeguards. The OCR pass is fast and adaptive; prolonged rotation/enhancement is reserved for deeper Review work.
3. **AI is an optional missing-details fallback.** When enabled and a verified title/author pair is still unavailable, the cover reader can propose legible title/author/ISBN/publisher/year. The request now includes limited OCR text as untrusted supporting evidence to help with faint lettering. A new ISBN triggers exact catalogue lookup. AI never writes to Inventory by itself and cannot overwrite a conflicting verified title or ISBN.
4. **Automatic routing stays strict.** Verified ISBN/catalogue/inventory evidence goes to Inventory through the existing cloud-confirmed autosave. Unidentified, ambiguous or contradictory results go to the cloud Review queue, with normal safeguards for duplicate photos and interrupted batches. A save is not reported as successful until confirmed by Supabase.

This is intentionally a **source hierarchy**, not three mutually competing providers. Book API searches are attempted before cloud AI; OCR can extract the identifier needed to repeat the API search when a cover lacks a machine-readable barcode. More than one provider may contribute non-conflicting blank fields, but visual suggestions never override catalogue-verified edition metadata.

## Settings and UI cleanup

- AI and OCR switches live only in **Account settings → Book recognition settings**, including access through the mobile account shortcut.
- Both are on by default. Their per-device saved values from prior versions are retained; changes affect subsequent photos. Book API lookup is always enabled and is not controlled by these toggles.
- Scan and Review no longer display these switches. Review keeps one **Auto-fill books** action, individual **Auto-fill details** actions, photo replacement, approval and protected Delete Image, but removes redundant individual *Read OCR* and *Read AI* buttons.
- Obsolete `scan-workflow-v533.css` was removed from the stylesheet list and the release; it contained legacy Scan table and manual-save styling. Other component CSS is retained where still used.
- Shared `assets/scan-recognition-policy.js` consolidates the fallback rules; `assets/recognition-settings-v535.css` isolates the settings appearance.
- The AI vision server's best-effort read timeout is reduced from 19s to 9.5s, and its per-user best-effort throttle defaults to 24/min (configurable with `BOOK_VISION_RATE_LIMIT_PER_MINUTE`, bounded from 8 to 40). Provider quotas and charges still apply.

## Testing and limits

- `npm test`: **103 passed**.
- Browser: Scan and Review layout smoke tests at 320, 360, 390, 600, 768, 1024 and 1440px show no horizontal overflow.
- Browser: Account-settings controls open, independently toggle and fit at 320, 390, 768 and 1440px.
- JavaScript syntax checks passed for the API vision handler and the main inline browser script.
- All tests are **local**, using mocked book metadata and sample UI content where applicable. No real-photo throughput/accuracy benchmark, provider quota test, or live cross-device production run has been completed.
- The requested **90% detail-fill coverage is a target, not a verified outcome**. Measure it on at least 100 representative covers using per-field correctness, full-record completeness, Inventory/Review route correctness and processing time. Titles without machine-readable barcodes, rare works, blurred images, glare, and unsupported image codecs can remain in Review. OCR handles image formats the browser can decode, not literally every possible image format.

## Deploy and check

1. Deploy the ZIP **root files** to the existing Vercel `librarymanger` project, keeping current Supabase/AI provider environment variables. No SQL migration is required for this source change.
2. Hard-refresh, sign in and open **Account settings → Book recognition settings**. Confirm AI/OCR switches are absent from Scan/Review.
3. Test a clear back-cover ISBN, a cover with title but no ISBN, a blurry cover and a cover with mismatched barcode. Confirm provider order, metadata fields and automatic Inventory/Review outcomes. Repeat with OCR or AI disabled to verify independent fallbacks.
4. Run a multi-photo folder batch and verify streaming progress, confirmed cloud counts, duplicate handling and reloading on another device. Check the actual time from selection to metadata and calculate coverage of title, author, publisher and publication year.

**Deployment boundary:** The release only modifies project source files. It has **not** updated the live Vercel site or production Supabase data. Production accuracy and speed must be established after deployment.
