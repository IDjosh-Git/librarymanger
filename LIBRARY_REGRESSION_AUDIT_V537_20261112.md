# Library Manager v5.37 — Regression audit and corrections
**Date:** 12 November 2026  
**Base:** v5.36  
**Status:** Code changes made and tested locally. Not yet deployed to the public production website.

## Review scope
- Image preparation, cloud fingerprint claims and stalled-upload recovery
- ISBN-10 / ISBN-13 / supplemental barcode normalization
- Public Book API selection, metadata precedence, conflict handling and timeout budget
- OCR, AI and Book API sequencing / Account Settings location
- Automatic Inventory saves / Review routing / deletion and cloud persistence
- Mobile/tablet/desktop layout and duplicate DOM ID checks

## Verified safety fixes
1. **Work-versus-edition distinction**: a photo matching an Inventory title and author is not enough to prove the edition. OCR/local matches without an exact valid ISBN remain in Review. Only exact ISBN edition matches carry `inventoryEditionMatched` and may be saved automatically with source `inventory`.
2. **Edition metadata**: title-only catalogue results may suggest a work identity but cannot apply an arbitrary publisher, publication year, language or page count from another edition. Verified ISBN lookups remain the source of those edition fields.
3. **API fallbacks**: catalogue requests now share a bounded time budget shorter than the browser's 6.5-second ISBN lookup timeout; Open Library pacing respects that budget. This reduces false Review outcomes caused by slow multi-tier responses, while unresponsive sources remain non-fatal.
4. **Memory release**: an already-saved duplicate photo discarded during fallback no longer retains its full image preview in the Scan session.
5. **Cache freshness**: changed browser-side scripts use v5.37 query versions to reduce stale-module problems after deployment.

## Test record
- Node tests: **120 passed, 0 failed**, including new tests of title-only/edition verification, invalid checksum matching, work-level edition metadata, and slow-provider deadline.
- Chromium interface checks: Scan and Review at 320 / 360 / 390 / 600 / 768 / 1024 / 1440 px; Settings and ISBN browser module integration at 320 / 390 / 768 / 1440 px.
- Source syntax checks: `node --check` on `assets/*.js`, `api/*.js`, `lib/*.js`, `lib/*.cjs` passed; duplicate HTML element IDs: none.
- Live Supabase was queried **read-only**: 842 Inventory records; 70 pending Review; zero stuck `processing` claims; zero duplicate photo fingerprints, pending Review items already in Inventory, or saved scan markers lacking an Inventory record.

## Production acceptance test (required)
1. Deploy preview from the ZIP root; preserve environment variables, auth, Supabase project, and access controls.
2. Sign in on desktop and a real phone. Confirm Account Settings' OCR/AI switches are remembered on that device, and none appear inside Scan/Review.
3. Scan a small batch of clear ISBN-13, ISBN-10 and ISBN-13+5 EAN supplement photos. Watch progress move during scanning; confirm books do not enter Review solely because of 13+ digits.
4. Scan a title-only book with no visible ISBN, and a mismatched-cover photo. Confirm these cannot steal edition metadata and uncertain items route to Review.
5. Test Book API availability, deliberate API outage, and OCR/AI enabled/disabled combinations. Confirm one provider's failure does not overwrite reliable details from another.
6. Confirm each Inventory success only after the Supabase write; inspect the record from another device. Confirm pending Review images are visible on another device, can be corrected or deleted without touching saved Inventory.
7. Upload the same photo again; confirm a duplicate is skipped without a duplicate Inventory copy. Interrupt a batch, resume with the same files and confirm orphaned claims recover.
8. Measure median and p95 time-to-details, metadata field completion and manual Review rate across a representative sample of real book-cover photos. The previously discussed 90% fill rate is **not verified** by these unit tests.

## Limitations
- No full browser-to-live-production write test or real-image recognition benchmark was run in this audit. No production data, settings or files were changed.
- The available web checks could not retrieve live Google Books and Open Library JSON responses, so active third-party uptime/quotas and ISBNdb credential setup have not been verified.
- Device viewport testing is not the same as physical-device testing. Some image formats depend on browser support.
