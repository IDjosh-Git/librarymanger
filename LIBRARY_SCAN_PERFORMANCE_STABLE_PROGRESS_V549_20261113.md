# Library Manager v5.49 — stable premium Scan progress and faster recognition

## Fixed-size scanning card

- Rebuilt the progress-meter layout with fixed grid tracks: 166px on larger screens and 181px at 540px or below.
- Long messages are visually clamped to two lines without changing the card height. The complete text remains in the accessible live-status element.
- Added stable scan-count placement, premium navy-to-teal progress fill, and consistent light/dark colours.
- Coalesced UI updates with `requestAnimationFrame` so dozens of status changes in one batch do not trigger repeated immediate rendering.
- Corrected status logic: a 100% *scan* is not declared a completed *cloud save* until Inventory/Review confirmations arrive.

## Scan throughput changes

1. **Concurrent SHA-256 preparation:** 2 images at a time on mobile, 3 on desktop, bounded to 4. Duplicate detection still commits fingerprints in original file order, maintaining deterministic skip behaviour.
2. **Pipelined scanning:** One additional scanner task can run while another waits for catalogue or AI responses. OCR worker limits remain unchanged (one on mobile; up to two on high-capability desktops).
3. **Barcode shortcut on more browsers:** Where the native `BarcodeDetector` API is absent, the locally loaded `html5-qrcode` decoder is attempted during automatic scanning. This can avoid a much slower OCR+AI fallback for identifiable ISBN barcodes.
4. **Skip unnecessary JPEG thumbnail creation:** Confirmed Inventory books no longer generate Review thumbnails. Uncertain books and failed Inventory saves still receive durable Review images.
5. **Clear lookup timeouts:** Release timeout handles as soon as the ISBN catalogue responds; avoid accumulating unused scheduled callbacks.

## What remains unchanged

- Book API first; use OCR and AI only when needed and enabled in Settings.
- Verify exact ISBN/edition before automatic Inventory writes. Uncertain books go to Review.
- Each physical book receives an independent Book ID; exact duplicate photos are not saved twice.
- Persistent Supabase review, safe upload recovery, manual Add Book, sidebar, Lending, and Admin permissions are preserved.

## Verification

- `npm test`: 165 passing tests, 0 failures.
- Browser Scan/Review, sidebar, Lending, and recognition Settings tests pass.
- Progress card measured in Chromium at 320, 360, 390, 600, 768, 1024 and 1440px. Its height remained identical throughout six simulated progress states at each viewport; no page-wide horizontal overflow.
- Inline JavaScript syntax checks pass; compiled stylesheet parsing has no top-level syntax errors.
- Deterministic performance regression tests verify that a 3-worker preparation pool and 2-worker scanning pipeline reduce elapsed time for mocked delayed work, without changing duplicate order or the verified source policy.

## Live deployment acceptance test

The benchmarks above are simulations, **not real-photo OCR, remote AI, or provider latency measurements**. After preview deployment, test a mixed batch of front covers, ISBN backs, non-ISBN books, rotated photos, and duplicate photos. Compare real timings and automatic Inventory vs Review accuracy to the previous deployment. Test AI/OCR toggles and successful cloud saves with a signed-in account.

This release changes frontend files only; no Supabase schema or production records were modified.
