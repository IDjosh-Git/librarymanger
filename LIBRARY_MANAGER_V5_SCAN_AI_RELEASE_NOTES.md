# Library Manager V5 — Scanning Reliability, Inventory Sync & Book Guide Formatting

**Date:** 4 November 2026  
**Source baseline:** `Library_Manager_Quick_Add_Book_Guide_Header_V4_20261104.zip`  
**Release status:** Locally verified source package; NOT deployed to production.

## What changed

### 1. More reliable Shelf Scan & Review

- Photos that finish processing enter the visible review queue **immediately**, not only when the whole batch finishes.
- In-progress scans are checkpointed (throttled for performance), with a final flush when the batch completes or is stopped. The review queue continues to use browser IndexedDB and, when connected, `library_review_queue` in Supabase.
- Each photo has a persistent `saveRecordId`. If a database response is lost, retry logic first checks that exact record ID; **matching ISBNs never act as a uniqueness key for physical copies**.
- After a completed copy is confirmed saved, the full image file and object URL are released from memory. Only unfinished rows remain in the durable review backup.
- When a full-resolution photo was lost after refreshing the page, a preserved compressed thumbnail can be used for another OCR/cover-reading attempt. Replacing it with a sharp original remains the best option.
- Browser barcode fallback scans are serialized to avoid collisions between simultaneous calls sharing a hidden barcode-reader element. Supported barcode formats are cached once per session. OCR recognition workers remain reusable with at most two lanes on capable devices.

### 2. Inventory and Scanned Books consistency

All new approved copies are inserted into **`public.library_books`**. The Inventory uses a grouped view of these same records, while Scanned Books is a separate **screen**, not a separate database table. Saved copies appear in both:

- Inventory groups copies with the same title/ISBN but preserves each physical copy's `record_id` and generated `book_id`.
- Scanned Books now includes **all saved scanned copies**, including incomplete metadata. The new **Details** filter offers All, Complete, and Needs Attention.
- Books that have not yet been approved remain in the Review queue, not the live inventory.
- Saving re-fetches current Supabase books and refreshes both Inventory and Scanned Books. The Book of the Week choices and Lending picker are also sourced from that shared inventory state.
- Quick Add now accepts a barcode **or** a title. Books without ISBNs can be added with an empty barcode while receiving their own permanent Book ID.

### 3. Readable and safe Book Guide answers

- Added `assets/book-guide-format.js`, a small dependency-free Markdown renderer used on Inventory/Lending and public Book of the Week.
- Book Guide now displays paragraphs, headings, **bold text**, *italics*, bullet/numbered lists, links to HTTP(S) destinations, short code spans, and Unicode symbols such as ✓ and →.
- Responses are created from DOM text nodes, not unsafe `innerHTML`. Any model-supplied HTML appears as text rather than executing.
- The optional Gemini endpoint now invites concise formatted answers; no change to the no-key, catalogue-based fallback.
- Scoped styles are maintained in `assets/book-guide.css`; the saved-scans quality indicators are in `assets/library-ui.css`. These rules come last in their respective maintained files to override conflicting legacy appearances.

## Checks performed

| Check | Result |
| --- | --- |
| Existing + new Python regression tests | 56 passed |
| JavaScript syntax: inline, assets and API routes | Passed |
| CSS parse: all app stylesheets | Passed |
| Database-mock save integration: same ISBN, two copies | Passed |
| Database-mock second save: no duplicate copies | Passed |
| Database-mock Inventory grouping and scanned register | Passed |
| Interruptible bulk scan: completed rows visible early, durable checkpoint | Passed |
| Chromium: Shelf Scan at 320, 390, 768, 1440px in both themes | 8 states passed, no horizontal overflow |
| Chromium: Book Guide at 320, 390, 768, 1440px | 4 states passed, no horizontal overflow |
| Browser rendering: Markdown, symbols, headings, bullet/numbered lists and HTML injection escaping | Passed |
| Live Supabase schema read-only check | Compatible: `library_books` copy IDs and `library_review_queue` exist, RLS enabled |
| Live Supabase data read-only snapshot | 664 saved books, 664 distinct nonempty Book IDs; 67 pending Review records |

**Not verified end-to-end:** A signed-in scan with a physical camera, Tesseract OCR performance on real devices, live Supabase INSERT/UPDATE under an administrator session, optional Gemini replies with an active API key, and Vercel preview. We deliberately made **no writes to your live database** and did **not deploy**. Speed depends on device hardware, image quality and network availability for library metadata.

## Deployment steps

1. Replace the current project files with the contents of the V5 ZIP, preserving `index.html`, `book-of-the-week.html`, `assets/`, `api/`, and `vercel.json` in the project root.
2. Use a **Vercel preview deployment** first. Confirm an administrator can sign in, upload 2–3 sample images, interrupt and resume the batch, edit a book and approve/save it.
3. Confirm the saved books appear in Inventory, the Scanned Books register, and the Lending picker. Where available, check the generated Book IDs in Supabase. Verify the Book of the Week picker can find them.
4. Open Book Guide on Inventory, Lending and Book of the Week. Check formatted answers and that the panel scrolls on phones.
5. If the Review panel reports a cloud backup error, verify the existing `persistent_review_queue.sql` migration and account policies. Do not rerun migrations blindly on production; inspect the existing schema first.

No SQL migration is required for the V5 frontend changes against the database schema inspected on 4 November 2026.
