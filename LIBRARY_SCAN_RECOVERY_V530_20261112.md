# Library Manager v5.30 — Interrupted photo scan and inventory-saving recovery

## Confirmed root cause

The live connected Supabase project had 111 photo hashes marked `processing` with no associated `library_books` row and no pending `library_review_queue` record. The earlier uploader inserted all hashes before scanning, but it never reclaimed abandoned claims after a tab closed, failed, or connection was lost. Selecting the same 117 photos was therefore wrongly reported as "already uploaded," leaving zero recognized results and disabled save/selection controls.

## Corrections

- Recovers only **old, owned, unfinished** scan claims (at least 10 minutes idle), and only after verifying there is no matching saved inventory copy by hash OR record ID and no pending Review row. Recovery is server-atomic with a conditional timestamp filter. Retains the original physical-copy record ID on recovery, preventing duplicate records if two devices retry.
- Performs recovery in chunks of 40 (three batch updates for 111 stuck records) rather than sending hundreds of sequential mobile requests.
- Keeps already-saved photos and pending Review books protected from duplicate scanning.
- Backs up completed scan rows during long-running jobs, then updates their hashes to `pending` after confirmed cloud sync, minimizing abandoned work on mobile.
- Keeps the selected file batch ready for **Retry selected upload** when the app encounters a recoverable network failure or all files are currently blocked. After 10 minutes, interrupted files can be retried safely.
- Enables **Mark all ready**, **Save all ready books**, and **Save selected books** when idle. If no title is recognized, clicking tells the user what is missing rather than appearing broken.
- Fixes AI-only cover recognition (AI ON + OCR OFF) so it actually runs, and preserves OCR fallback when enabled.
- Corrects the empty-state and duplicate-status wording. Marked books can now include completed items already sent to Review.
- Limits mobile/tablet scanning to one OCR worker to reduce memory pressure and adds responsive scan-button layout with 46–50 px touch targets, wrapping and no narrow-screen clipping.

## How to use

1. Deploy the ZIP's **root contents** to the existing Vercel `librarymanger` project, retaining your environment variables and Supabase configuration. The JavaScript duplicate verifier is cache-busted to v5.30.0.
2. Sign in to Library Manager. Open **Scan books → Choose photos**, **Choose folder**, or **Choose ZIP** and select the previously interrupted files again. The app will reclaim qualifying hashes and scan them; it will not duplicate photos already in Inventory or existing pending Review books.
3. Review the results. Click **Mark all ready**, then **Save selected books**, or click **Save all ready books**. Books lacking recognized titles go to **Review books** for correction; **no title can be safely invented solely to force an inventory save**.
4. After saving, click **Refresh from cloud** and confirm each book appears in Inventory. Retrying saved photo bytes will not duplicate the book.
5. On mobile, use **Choose photos** when folder selection is unsupported; for large, memory-heavy 117-photo sets consider batches of 20–30 photos to avoid browser tab termination.

No Supabase schema change, data deletion, or additional service credential is required for this fix. The ZIP is source code; deployment and a real-device scan are required before claiming the live site is fully repaired.
