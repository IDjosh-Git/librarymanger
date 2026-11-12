# Library Manager v5.31 — Streaming photo scanning performance repair
**12 November 2026 · Source release, not production deployment**

## Reported regression
The user reported that scans became slow after the v5.30 recovery release and that book recognition no longer started while photos were still being prepared. The v5.30 `runBatch` implementation hashed **the entire photo selection**, waited for **all** cloud duplicate claims/recoveries, and only then launched OCR/AI recognition. This introduced unnecessary first-result latency, particularly with 117 images. A second performance issue was that it invoked slower remote AI before local OCR for otherwise readable covers. Review checkpoints could also trigger repeated cloud synchronization while a batch was running.

## Repair
- **Overlapping ingestion and recognition.** Added `assets/scan-stream.js`. Scan starts as soon as a small initial group of 3 photos is fingerprinted and claimed in Supabase. Subsequent groups are fingerprinted, checked for duplicates and claimed **while previously accepted covers are being recognized**. Mobile batches remain small and use one OCR worker; capable desktops may use two. Bounded buffering limits pending work.
- **Lazy ZIP extraction.** `batchZipFiles` validates the archive and supplies ZIP entry descriptors without decompressing every image first. The streaming producer decompresses only its current small group as the scanner runs.
- **OCR-first when both options are enabled.** Local OCR now attempts identification before slower cover-image AI. The cloud AI reader remains the fallback for images where local OCR did not find a title, or when explicitly selected. When an ISBN lookup already supplies the title, scanning does not wait for OCR/AI simply to fill an optional ISBN.
- **Lighter cloud writes.** During scanning, Review checkpoints are scheduled after approximately eight new processed records or a 15-second interval, rather than repeatedly sending snapshots after about 1.4 seconds. Status updates operate on records not yet checkpointed. All processed records are still finalized into the Review queue, including if a later upload fails.
- **Clear progress.** The progress bar represents real finished scans plus skipped duplicates, not merely files already registered. Recognized books appear in Review as scanning proceeds. Mark and Save controls are enabled after the active scan finishes.
- **Preserved safety.** Existing photo-digest deduplication, stale-claim recovery, save-ready logic, authentication, inventory record IDs, and Review cloud backup remain intact. No new database migrations or credentials are required.

## Testing
- `npm test`: **60 passed, 0 failed**, including 117-photo streaming, early recognition, adaptive chunking, duplicate skipping, cancellation, error/deadlock recovery, cloud-claim-before-scan, v5.30 stale-claim recovery, and previously existing AI and book tests.
- JavaScript inline application and streaming helper: syntax checked with Node.
- Chromium responsive layout check at 320, 360, 390, 768, 1024 and 1440 pixels: no horizontal overflow of the scan page. External script execution and live authentication were not part of that layout test.
- **Not performed:** live Vercel deployment, real-world timed before/after benchmark on the original 117 photos, physical-device camera testing, or real-image OCR quality assessment. Speed depends on device CPU, photo size, network latency, public catalogue services and AI availability.

## Deployment / acceptance checklist
1. Deploy the **contents** of the ZIP (not an enclosing parent folder) to the existing Vercel `librarymanger` project, retaining its `api/`, `assets/`, `lib/`, `database/` folders and current environment configuration.
2. Hard-refresh so `scan-stream.js?v=5.31.0` and `premium-progress-upload.js?v=5.31.0` are loaded.
3. On a fresh, small batch, watch the first recognized card appear while later photos are still being checked. Check that the progress bar counts scanned/skipped photos rather than upload registrations.
4. Retry the interrupted 117-photo collection; confirm 111 orphan `processing` claims can recover when stale, without duplicating records already in Inventory or Review. Wait for the existing 10-minute recovery interval if an unfinished scan was just started.
5. Confirm saved results in Inventory, and unfinished results in Review. Test both direct photo/folder selection and ZIP selection on mobile and desktop.
6. If scanning remains slow even after early streaming starts, compare **OCR only** against **OCR + AI** for a handful of covers; cloud AI timeouts and large or difficult images can still dominate individual-image processing.
