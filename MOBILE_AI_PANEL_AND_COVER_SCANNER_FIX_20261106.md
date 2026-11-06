# Library Manager: Mobile Book Guide and Cover Scanning Fix — 6 November 2026

This release builds directly on the supplied `LibraryManager_AI_All_Books.zip` archive. No Supabase schema or data migration is required.

## Mobile floating AI / Book Guide

- On phones and tablets (below 900px), Book Guide opens as a full-viewport reading sheet, instead of a detached floating box.
- The page underneath is frozen in place while the sheet is open. Closing the sheet restores the original scroll position.
- The book selector and AI replies scroll inside the sheet; the message composer and close button remain accessible.
- A dimmed backdrop, Escape-to-close, outside-tap-to-close and keyboard focus containment improve modal behavior.
- The sheet takes account of the mobile visual viewport and software keyboard; desktop keeps the original floating panel.
- Reduced-motion preferences remain respected. Changes apply to Inventory and Book of the Week.

## Book-cover photo recognition

- Improved the optional Gemini photo-reading endpoint's extraction prompt to return **visible** book title, author, ISBN, publisher and publication year (only where legible), with longer but bounded request timeouts.
- Book photos are resized and encoded in the browser; the image processing now has a fallback for browsers that do not support `createImageBitmap` with the uploaded file.
- A new **Read cover with AI** action on each Review card explicitly opts in to sending that image to the configured Gemini API.
- The optional batch-wide AI checkbox remains **off by default** for privacy. If it is off, local OCR continues to process images without sending them to Gemini.
- After extracting a title or author, the scanner uses existing catalogue search to suggest or, for a single high-confidence match, populate additional metadata.
- OCR-only scans now fill a provisional title when there is adequate text and mark it for human checking, instead of always leaving the title empty.
- Statuses explain AI timeouts/quotas or unavailable endpoints, and local OCR is still attempted on failure.
- All scanned data stays in Review until confirmed. Title searches never invent a book's ISBN or edition.

## How to test after deployment

1. Replace the corresponding source files in your Git repository and redeploy Vercel.
2. Open the website on a phone, scroll down, launch **Ask about a book**, and try scrolling. Only the assistant should move; the underlying page should stay fixed. Close the panel and confirm the page returns to the same point.
3. Sign in as an account with book-scanning permission. Go to **Collection Studio → Quick scan** or **Select photos** and upload a clear book cover.
4. If using the private/local-only scan, leave **Fast local OCR** checked and review the suggested details.
5. For more reliable cover reading, enable **AI cover recognition (optional)** before scanning, or click **Read cover with AI** on that book's Review card. This sends the selected image to Gemini.
6. Verify the title, author, publisher, publication year and ISBN against the physical book before approving and saving. For unavailable details, use the title-page image or manual entry.

## Configuration

The connected Vercel `librarymanger` project has a Gemini API key and model variable configured for Production. The API default is `gemini-3.5-flash-lite` unless a `GEMINI_MODEL` override is set. The project also has `GOOGLE_BOOKS_API_KEY` for metadata lookup. Neither a new database table nor another key is required for these source changes.

Live cover recognition was **not tested using your account's private Gemini key**. Local tests use simulated provider responses. Free-tier quotas and the accuracy of text read from a real cover remain dependent on the provider and image quality.

## Verification

- Python unittest suite: **72 tests passed**.
- Node scanner integration test: passed.
- Node cover recognition tests: opted-in Gemini path, local OCR, direct AI action, catalogue matching and no inferred ISBN passed.
- Node Vercel vision-handler mock: authenticated request, JSON output and missing API key handling passed.
- Chromium: 320px, 390px and 768px mobile sheets, 1440px desktop popover, independent message scrolling, backdrop, Escape, background lock and restored scroll passed.
- All modified JavaScript passed syntax checks.

**Deployment status:** source files updated and packaged; no GitHub push or Vercel deployment was performed.
