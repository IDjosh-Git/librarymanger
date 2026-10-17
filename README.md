# Library Manager — Responsive Review & Excel Fix (v5.2)

This build preserves the modern dashboard, real library photographs, matching ISBN book covers,
OCR scan workflows, grouped Inventory copy counts, lending/returns, and previous fixes.

## Review versus saved Inventory

- **Export review · Excel** exports *unsaved* scanned or imported review rows. It is
  intentionally disabled if the unsaved count is zero; the status panel now tells you that.
- **Export saved needs attention · Excel** exports copies *already saved* in Supabase
  that have missing title, author, publisher, year, barcode or shelf information. This
  button is enabled when any such saved books exist, even if the Review list is empty.
- Keep the Review_Key on existing records. `Import_Action=UPDATE` corrects an existing
  physical copy. `Import_Action=SAVE` inserts another physical copy. `SKIP` omits a row.
- After importing a corrected file, click **Save selected to Supabase**. For UPDATE rows
  this performs an update matched by immutable record ID (it never inserts that row),
  while SAVE rows create new records with distinct Book IDs. User authentication and
  existing Supabase Row Level Security continue to apply.
- The app remembers **review metadata** per signed-in account in browser IndexedDB
  when storage is available. The original full-size photos are not stored in IndexedDB.
  You may need to reselect photos after a page reload for OCR, but exported metadata
  and corrections can be recovered from this browser if storage is available.
- Data that was **previously unsaved and lost before this version** cannot be
  retroactively recovered; exported or saved records remain retrievable.
- XLSX import/export uses the existing SheetJS library from the CDN. If the Excel
  library is unavailable, the export buttons download an **Excel-compatible CSV**
  instead; `.csv` import is also supported. Format ISBN/barcode columns as **Text** in
  Excel to preserve leading zeros, and keep Review_Key unchanged.
- Photos are **not embedded** in the exported workbook or CSV file.

## Responsive layout

- Wider desktop workspace and narrower fixed sidebar to avoid excessive blank space.
- Tables remain inside their own horizontal scrolling area on desktop; mobile tables
  use stacked cards. Filters, buttons, review cards and inputs wrap to viewport width.
- Mobile bottom navigation, Dashboard, Inventory, Lending, Returns and Loan History
  were checked in browser tests at widths 320, 360, 390, 430, 768, 820, 1024, 1366
  and 1680 pixels.

## Validation

- `npm test` — 48 automated JavaScript tests passed, including UPDATE key protection.
- `python tests/test_review_responsive.py` — passed in mocked Chromium across nine
  viewport widths, including an existing-copy Excel UPDATE (no duplicate database
  insertion), unsaved review export, and CSV fallback import/export.
- `python tests/test_review_excel.py`, `python tests/test_inventory_quantities.py`,
  `python tests/test_duplicate_save.py` and `python tests/test_dashboard_ui.py` passed
  with in-memory Supabase data.
- Some legacy browser tests can timeout in this sandbox and **live production Supabase,
  browser persistence and external OCR/ISBN API behavior are not fully validated**.
- No live Supabase records or Vercel deployment were changed by these modifications.

---

# Grouped Inventory — Copies Available (October 2026)

**New column name: Available Copies.** Each distinct book is displayed as **one line** in Inventory, with these counts:

- **Available Copies** — copies currently on the shelf, not loaned out.
- **Total Copies** — all physical copies owned, including those borrowed.
- **On Loan** — number currently borrowed (Total Copies minus Available Copies).

For example, scanning five physical copies of the same ISBN produces one visible Inventory book entry: **Total Copies 5**, **Available Copies 5**. Lending two reduces **Available Copies to 3** and raises **On Loan to 2**, while the Total Copies count remains 5. These quantities are also shown in card view and in the **Export all · Excel** inventory workbook.

The application **preserves individual physical-copy records in Supabase** for correct Book IDs, shelving, borrowing, returns, deletion, audit history, and stable Excel Review Keys. The app automatically consolidates these into one visible Inventory entry using the identifier: valid equivalent ISBN-10/ISBN-13 values are grouped, other matching barcodes are grouped, and genuinely unnumbered books are grouped only if title, author, publisher, publication year and language match. Unidentified photographs are not silently grouped. Separate ISBN editions remain separate books. This approach avoids destructive database merging and requires **no SQL migration**.

**Manage individual copies:** Use **View and manage N individual copies** beneath a grouped item to access each copy’s unique Book ID, shelf location, lending/return, edit, and delete actions. When selecting a group to lend or return, the app chooses an eligible individual copy; use the expanded list or circulation picker to select an exact copy. Inventory search and filters apply to the grouped items; a book can appear in both Available and On Loan if it has copies in both states. Quality/attention filtering includes a group if any underlying copy needs bibliographic correction.

**No production database modification was performed.** 43 automated JavaScript tests (including six quantity aggregation checks), and a grouped-Inventory browser smoke test passed with mocked book and loan records. Duplicate-save browser smoke tests also passed using simulated database responses. Re-test live lending/returns and Excel exports after deployment.

---

## Version 4.6.0 — save duplicate copies as scanned (October 16, 2026)

**Fix:** In **Inventory → Import an entire shelf**, click **Select duplicates**, then **Save selected to Supabase**. All selected photos are inserted as **separate physical copies**, even if they have the same ISBN/barcode or missing title, author, shelf, or failed catalog/OCR lookup. They are saved with the details currently shown — no forced corrections and no extra duplicate-confirmation dialog. Existing books are not merged, updated or deleted.

Each selected row receives a **distinct, stable `record_id`**; Supabase assigns the next unique immutable `book_id`. New rows are inserted, never upserted by ISBN/barcode. Repeating Save after a network interruption reuses the row's record ID and checks for a previously inserted copy, reducing accidental extra copies. An unsuccessful save keeps its checkbox selected, shows the database error on that photo card, and can be retried. Editing incomplete duplicate details no longer unticks an already selected row. Successfully saved books are still available through **Inventory → Needs attention** for later completion.

**Database compatibility:** The linked DataLearning Supabase `library_books` schema was checked. `barcode` is **NOT NULL** but is **not unique**; `title` and `shelf_location` permit NULL; each copy gets a unique Book ID via the existing trigger. The app therefore saves an image with no readable code as an empty barcode string (not SQL `NULL`), and uses SQL `NULL` for empty optional details. **No SQL migration or changes to existing Supabase data were necessary.** Do **not** run `allow_duplicate_isbn.sql` for this linked project; it already permits duplicate barcodes.

**Testing:** `npm test` passed all 32 automated tests; `python tests/test_duplicate_save.py` passed browser tests with simulated Supabase for repeated ISBNs, missing titles/shelves, photos without barcodes, preserved selection, separate permanent book IDs, and no duplicate-confirmation dialog. The deployed website and real account writes have **not** been tested. A pre-existing metadata browser test asserting retry behavior for rate-limited requests did not pass in this environment; it does not cover duplicate saving.

To deploy, extract the ZIP, commit the contents of the `librarymanger` folder into the root of your existing GitHub/Vercel project, deploy, and hard refresh. After signing in, try **Select duplicates → Save selected to Supabase** on two known physical copies before a large batch. If a save still fails, copy the exact database error shown on that photo's card.

---

## ISBN and barcode lookup fix (October 2026)

**The Inventory → Find missing details action no longer stops with “This barcode is not a valid ISBN-10 or ISBN-13.”** It now:

1. Recognizes valid printed ISBN-10 (including X), ISBN-13 with 978/979 prefixes, ISBN labels with spaces/hyphens, scanner symbology prefixes, 2- or 5-digit price add-ons, zero-padded GTIN-14 book identifiers, and historical nine-digit SBNs.
2. Tries the existing multi-source book catalogs for a verified ISBN. It only merges bibliographic details when the provider identifies the same edition/ISBN.
3. Tries Google Books for **other barcodes** using an exact matching industry identifier. It does not treat an arbitrary UPC, EAN or internal library barcode as an ISBN or accept a loosely matching title.
4. If no trustworthy match exists, opens the selected book in Inventory's editor. Use **Search by title & author**, choose a title suggestion, or manually fill the missing fields. The original barcode, shelf, copy ID and circulation status are preserved.
5. Uses the same general identifier lookup for the top ISBN/Barcode box, batch Needs Attention cards and the book editor. ISBN check-digit corrections are only suggested, not silently applied.

**Why some identifiers still need manual work:** ISBNs have *only two standardized lengths* (10 and 13 digits). UPC/EAN/GTIN, ISSN, and library accession numbers are different identifiers. Book catalogs may not index them, so no API can guarantee metadata from every barcode. Do not replace a non-ISBN code with a guessed ISBN. When a scan includes an unreadable identifier, use the title-page OCR and title search features added in the previous release.

No additional Supabase migration is required for these lookup changes. Existing database uniqueness restrictions on duplicate ISBNs still require the earlier `allow_duplicate_isbn.sql` migration if that restriction applies to your project.

# Library Manager 4.3 — Vercel edition

## October 2026 update — inventory detail filters and title-page scanner

**Inventory completeness filters:** Inventory now has a separate **Book details** filter bar with **All details**, **Needs attention**, **Without title**, and **Full details**. These combine with the original available/on-loan/overdue filters, sorting and search. Counts are calculated from the records already in Supabase. “Full details” means a populated barcode/ISBN, title, authors, publisher, publication year and shelf. A title and shelf are sufficient to save a title-page scan that has no ISBN; such a record correctly remains in **Needs attention** until its ISBN and other missing fields are supplied.

**Repair an existing book without scrolling:** Click the pencil icon on an inventory card or table row. The edit dialog shows all core bibliographic fields including **ISBN/barcode**, **title**, **author**, **publisher**, **year**, and **shelf**. **Find using ISBN** enriches only blank metadata fields after exact ISBN matching. **Search title & author** uses five catalogs and shows choices for a human to verify. **Save book changes** updates the existing physical copy only, preserving the unique Book ID and loan history.

**Title-page and cover OCR:** In Inventory, **Scan a book** accepts a picture of a barcode, cover, or interior title page and adds a review card beside the original photo; it no longer blindly writes a record with an unknown title. Shelf batch imports work similarly. Barcode recognition is attempted first (including rotation), then, when needed and enabled, client-side [Tesseract.js](https://github.com/naptha/tesseract.js/) reads printed text. The app verifies ISBN-10/13 check digits extracted from text; with no valid ISBN, it extracts plausible titles and authors, queries the title catalogs, and shows possible matches with a **Use these details** button. Printed title-page matches are work-level suggestions, **not proof of the particular ISBN or edition**. They are not silently assigned ISBNs. Every image can be reviewed and corrected directly beside the image with **Search by title & author**, **Read text from photo**, or manual entry. A book with a confirmed title but no ISBN can be saved with a blank barcode. Unrecognized images remain in review for correction; they are not automatically deleted or marked as an unrecoverable scanner error.

**Additional title catalogs:** `/api/title-search` searches Open Library, Google Books, Internet Archive, Library of Congress, and Gutendex concurrently with per-provider timeouts and matching/ranking. These complement the existing ISBN-matched APIs in `/api/book-lookup`. Google Books can use the same optional server-side `GOOGLE_BOOKS_API_KEY`; title search otherwise uses public sources. Catalog downtime is handled gracefully, falling back to direct Open Library when possible, or manual data entry. Do not paste paid API keys into JavaScript or HTML.

**Performance and limitations:** Title-page OCR loads an English recognition engine from a CDN the first time it is needed; the files need an internet connection, but images are processed locally in the browser and are not sent to an OCR server. OCR can be slow on thousands of high-resolution photos. The **Read title pages and covers** checkbox can be disabled for a large barcode-only batch and individual images can still be retried with the **Read text from photo** button. Some formats (especially HEIC/HEIF or unusual TIFFs) depend on browser image-decoding support; no image scanner can guarantee perfect recognition from unreadable or obscured text. Every output should be checked before saving.

**Database compatibility:** If the database `barcode` column disallows NULL, saving a photo without an ISBN will fail until an administrator reviews and (if appropriate) runs the optional `allow_books_without_isbn.sql`. Previous support for duplicate physical copies is unchanged; see `allow_duplicate_isbn.sql` only if the database specifically blocks duplicate barcodes with a unique constraint. Neither migration is automatically executed by Vercel. Test your live schema with one ISBN-free book and one repeated ISBN after deployment.

**Deploying the ZIP:** Extract the archive, copy the app files to the connected Git repository, commit and push, and redeploy that commit from Vercel (or create a fresh deployment if Git integration is unavailable). Do not remove the current Supabase project. The package includes new files in `lib/`, `api/`, `tests/`, and `assets/`, so upload the full project rather than only `index.html`.


The app is a static HTML/CSS/JavaScript website with a Vercel ISBN metadata function. The current edition includes icon-only light/dark controls, top/bottom floating buttons, a Ctrl+K quick-action menu, card/table inventory views, five sorts, adjustable pagination with first/last buttons, due-soon loan filtering, and responsive toast feedback. These design features do not require database schema changes. The permanent Book ID migration has already been applied to the connected Supabase project. It uses the existing Supabase project in `index.html` and optionally the already-deployed Google Sheets Apps Script. No server build, OpenAI key, or Netlify account is required. On a different Supabase project, apply the included Book ID migration once.

## Option A: GitHub + Vercel (recommended)

1. Extract this ZIP on your computer. The **repository root** must directly contain `index.html`, `vercel.json`, `assets/`, `api/`, `lib/`, and `package.json`; `README.md` and `Code.gs` are included. Do not upload the ZIP as a GitHub repository file or nest these inside a second folder.
2. Create a new GitHub repository for the library site. Use **GitHub Desktop** (File > Add local repository / create repository from the extracted folder) or Git to commit and push the extracted site's contents. GitHub web upload is also possible, but verify `assets/app.css`, `assets/icons.svg`, and `assets/favicon.svg` keep their folder paths.
3. Open https://vercel.com/new, choose **Import Git Repository**, select the library repository, and set **Framework Preset: Other**; **Root Directory: `./`**; no Build Command; output directory `.` or the default for a root-level static site.
4. Click **Deploy**, open the URL ending in `.vercel.app`, and check the homepage and CSS.
5. In your existing **Supabase** project: Authentication > URL Configuration > **Redirect URLs**, ADD the new production URL, for example `https://your-library.vercel.app/`. Keep the existing Site URL and redirect entries because the same Supabase project serves your other apps. Signup/reset links use the deployed origin and page path.
6. Sign in on the new address, verify that your original books and loans are present, then test barcode scanning on HTTPS and lending/returning with a test record.

## Option B: Vercel CLI (no GitHub required)

Install Node.js on your computer, open a terminal inside the extracted folder (the one containing `index.html`), then run:

```sh
npx vercel login
npx vercel --prod
```

When prompted, create a new project, use the current directory (`./`) and choose the **Other** framework. After deployment, add the deployed URL to the same Supabase Redirect URLs as in step 5 above. You must log in to your own Vercel account; this package does not publish the site automatically.

## Keeping your existing data and Google Sheets mirror

The original website's Supabase project URL and browser **publishable** key, `library_books` / `library_loans` tables and authentication flow are retained. The ZIP does NOT run SQL or alter any database records or Supabase settings. The same account should show the same shared records if your project permissions allow it. Do not create a second Supabase project or paste a service-role key into the browser.

Your existing Google Apps Script `/exec` URL can continue working. Users may need to re-enter their Google Sheet, connector URL, and connector token on the Vercel domain: **browser localStorage is isolated by website origin**, so preferences and saved per-device connector settings do not move automatically from Netlify. Reuse your existing token privately rather than committing it into the website. The included `Code.gs` is an *optional template* for a new connector; do NOT replace your working script just to move hosting.

If confirmation/reset emails don't arrive, check Supabase Authentication email settings, logs, and SMTP. Deploying to Vercel cannot solve an email delivery problem by itself.

## Checks / limitations

The Vercel package includes the latest searchable lending and returns update while preserving the existing Supabase and optional Google Sheets integrations. Its browser checks use **mock Supabase data**, not real logins or live database writes. Deploy and verify sign-in, camera scanning, lending/returning, and Google Sheets writes before relying on it for real inventory.

## New controls

- **Appearance:** Click the moon or sun icon in the header. The theme is remembered per browser and does not affect other users.
- **Quick actions:** Click the command icon or use Ctrl+K (Cmd+K on macOS). Use Esc to dismiss it. `/` focuses inventory search when you're signed in.
- **Inventory:** Switch between table and card layouts; choose sort order and 25, 50 or 100 items per page. Book IDs are automatically generated by Supabase and read-only; editing shelf location is available in table view. The card **Edit** icon switches back to the table. First/previous/next/last pagination buttons operate on books and loans.
- **Page navigation:** Floating double-chevron icons jump to the top and bottom of the page. They become disabled when you're at an endpoint.
- **Loan alerts:** The loan-history filter now has **Due soon** for active loans due within seven days, separate from **Overdue**.
- **Feedback:** Status updates also appear briefly as a small notice on mobile and desktop; the permanent result remains in the workspace status panel.

These updates keep the existing Supabase URL, publishable key, database tables and Google Sheets integration. **Do not rerun Supabase SQL or replace a working Apps Script solely for the UI update.** Validate real sign-in and real Supabase/Google writes on the deployed site before relying on it for live circulation. The Google Sheets mirror is an optional best-effort integration, not a confirmed transactional sync. The barcode scanner uses the image/photo upload; an always-on camera preview is not part of this release.

## Bulk duplicate selection (new in 3.1)

In **Inventory → Import an entire shelf**, scan a folder, ZIP or photos and review the vertical list. **Select all** selects every unsaved row, including flagged duplicates and incomplete rows. **Select duplicates** selects all unsaved rows flagged as repeated barcodes/ISBNs (including records already in the library). **Select non-duplicates** selects complete rows that are not flagged; **Clear selection** unticks everything. The checkbox above the vertical list selects all unsaved rows, too.

To remove unwanted duplicate photos, click **Select duplicates → Remove selected from review** and confirm. This removes only the unsaved photos in that batch, **not any existing Supabase records or Google Sheets rows**. If duplicates are legitimate separate physical copies, use **Save selected to Supabase**, which inserts independent copies without a further dialog. If two photos show the same *single* physical copy, avoid saving both. Incomplete rows can be saved as they are and edited later under Inventory → Needs attention. Saved rows cannot be removed from the review list individually.

This update is frontend-only. Keep your existing Supabase tables and Google Apps Script. Sign in and verify the workflow on your deployed Vercel address before bulk importing real books.

## Scanned books in a vertical list (3.2)

**Inventory → Import an entire shelf** now displays every scanned photo/book as a separate, full-width card arranged **top to bottom**, instead of a horizontally scrolling review table. Each card includes its own selection checkbox, photo name/path, editable shelf, barcode/ISBN, title and author, plus a status or duplicate warning. The select-all checkbox remains above the list, and all bulk duplicate/select/save/remove actions are unchanged. The saved inventory opens in a single-column card list by default; you can still switch to the table to edit book IDs and shelves. This change does **not** require database SQL or a Google Apps Script update.


## Searchable lending, returns and reliability improvements (3.4)

**Lending:** Open **Lend a book**, type a title, author, barcode/ISBN, shelf, Book ID or exact copy reference in the search box, and choose the copy in the dropdown. Only available copies are offered. The selected book and its ID fill automatically; use **Clear chosen book** to start over or **Refresh available copies** to retrieve changes made by another librarian. The **Lend** button on each inventory card/table row now directly selects its *unique record ID*, so it works even when several copies share an ISBN or lack a Book ID. The due date must not precede the borrowed date, and the borrowed date cannot be in the future.

**Returns:** Search among borrowed copies by title, borrower, ISBN, Book ID or shelf, and select a copy to fill its ID, borrower and due date automatically. Inventory **Return** and active-loan-history **Return** actions also open this form with the exact copy selected. Check the return date and press **Confirm return**; a future return date is rejected. A borrowed inventory record with no matching active loan will show an actionable error instead of pretending a return succeeded.

**Existing Book IDs:** Older inventory records may have no assigned `book_id`. In that case, the Book ID box shows the unique `record_id` copy reference for reliable selection; this is **not** silently written as a new Book ID. The live project has already assigned permanent Book IDs to existing copies, and new copies receive one automatically when saved. Never try to enter or change a Book ID manually.

**Multiple users / saving:** Lending uses a conditional status update to reserve a currently available copy *before* creating its loan. If the copy has been lent by someone else, this prevents a second loan being inserted. If loan creation fails after reservation, the app attempts to reverse the reservation and warns when manual reconciliation is needed. Returns use a conditional loan-status update. The browser makes separate Supabase requests: these safeguards **do not provide a fully atomic multi-table transaction**. For strict transactional circulation across many librarians, a separately reviewed server-side PostgreSQL RPC/transaction would be necessary. No database schema or RLS changes are performed by this package.

**Testing:** Local Chromium tests with an in-memory fake database cover the inventory actions, duplicate ISBNs, missing Book IDs, searching and automatic ID filling, lending/returning, the active-loan-history button, stale competing loans, a simulated failed loan with successful reversal, date checks, and searching in a 233-book collection. Tests run at 1440, 390, and 360 pixel widths. These tests do not prove permissions or writes against the real project; after deployment, make a *test* loan and return before relying on it for real lending.


## ISBN lookup from multiple catalogs (4.0)

**What it does:** Scanning or entering a valid ISBN-10 or ISBN-13 first asks the same-origin Vercel function `/api/book-lookup?isbn=...` for a matching edition. The backend consults **nine different catalogs** through **eleven ISBN lookup routes**, subject to provider availability: Google Books; Open Library Edition, Search and Books API (three routes in one catalog); HathiTrust; Crossref; DataCite; Internet Archive; Wikidata; Library of Congress digitized books; and ISBNdb (an optional paid catalog). Crossref mainly indexes registered publications, and no catalog covers every printed book. Common EAN scanner symbology prefixes and the optional 2- or 5-digit EAN supplement are removed before ISBN check-digit validation. If an ISBN appears to have only a mistyped check digit, the app suggests a check-digit-only correction for confirmation; it never silently changes the barcode. It verifies ISBNs and rejects mismatched catalog records rather than assigning an unrelated title. It continues checking catalogs when metadata fields are missing, filling empty fields without replacing values already found. A non-ISBN barcode can still be saved and manually edited. No service can guarantee complete metadata for every ISBN.

**User controls:** In **Inventory → Add by barcode or ISBN**, enter an ISBN and click **Find details** to preview the catalog result *without saving anything*. Click **Add book** to save to your existing shared Supabase library. On an existing book card (or table row), click the **refresh/details** icon to look up and fill only empty metadata fields after your confirmation. It never intentionally overwrites existing Book ID, shelf, borrower, loan status, or populated fields. A substantially different returned title is blocked and should be checked manually. Shelf-folder imports use the same lookup as individual scans.

**Publish to your existing Vercel project:** Extract the ZIP and update the existing Library Manager GitHub repository with **all files and folders**. Do not omit `api/book-lookup.js` or `lib/book-metadata.cjs`, and make sure these directories are at the repository root next to `index.html` and `vercel.json`. Redeploy the production site in Vercel. Framework preset **Other**; no build command. The endpoint is a Node.js serverless function and is unavailable if you deploy only `index.html` or host the site as a static HTML file. No Supabase SQL or Google Apps Script updates are required.

**Optional Vercel environment variables** (Settings → Environment Variables → Production, then redeploy):

- `GOOGLE_BOOKS_API_KEY`: a Google Books API key if you have one; otherwise the app tries public access where supported. Keep the server key out of the HTML, repository and screenshots; restrict the key appropriately in Google Cloud.
- `ISBNDB_API_KEY`: only if you have a compatible **paid ISBNdb API subscription**. Without it, the other public catalogs still work; do not purchase anything just to try the app.
- `BOOK_API_CONTACT`: a library-admin contact email to identify requests politely to Open Library. This is a server-side identifying contact and must not be a personal secret.

Open `https://YOUR-LIBRARY.vercel.app/api/book-lookup` to check that the function deployed and lists the supported sources. To check an individual book, visit `https://YOUR-LIBRARY.vercel.app/api/book-lookup?isbn=9780140328721` and inspect `found`, `metadata`, `sources`, and `checked`. No API key values are returned. A missing or unavailable catalog is reported as `no_match` or `unavailable`, and the app can still save a book with manually entered details. Third-party providers may rate-limit requests. This function applies per-instance request limits and short-lived caching; it is **not** a globally distributed quota or guaranteed availability service.

**Testing boundary:** The package includes mock-driven metadata lookup and interface tests, not proof that every third-party catalog is reachable from the deployed Vercel region. Test several ISBNs on your own deployment and verify existing books, user sign-in, and test lend/return actions before relying on it for real circulation.


## 4.2 — Title-only dropdowns

The **Lend** and **Return** book dropdowns show only book titles; the search boxes can still match title, ISBN, Book ID, shelf, author, and (for returns) borrower. The dropdown uses the inventory record UUID internally, so identical titles never cause the wrong physical copy to be written by accident. Selecting a title fills the permanent Book ID field and shows its shelf/ISBN/borrower separately below the selection. Where two copies have the same title, narrow the search by Book ID or shelf before selecting. The Book ID is generated by Supabase, not the browser.


## 4.3 — Automatic IDs and title-only selection (current release)

The connected **DataLearning** Supabase project already has a permanent Book ID sequence and insertion trigger. A read-only verification confirmed **218 existing books**, **218 unique IDs**, and **zero missing Book IDs** (`LIB-000001` to `LIB-000218`) when this release was prepared. The database, not JavaScript, assigns a new ID to every newly saved physical copy, including duplicate ISBNs and shelf photo batches. The ID is immutable and must not be edited in the inventory. Do **not** rerun the included migration on that project; it is supplied only for separate projects that do not yet have automatic IDs.

Both **Lend a book** and **Return a book** dropdowns show **book titles only**. Search still accepts Book ID, shelf, author, ISBN, or borrower; after choosing the desired copy, the permanent Book ID fills automatically and the selected copy's identifying details appear separately below the dropdown. For titles shared by multiple copies, search its Book ID or shelf first. Each option uses the unique inventory record internally, so matching titles do not by themselves identify or merge copies.

Batch-import cards show the assigned Book ID as soon as Supabase confirms each saved row. Multi-row insert responses are matched using the unique `record_id` rather than assuming the backend returns rows in the same order as the request. Single-book saves confirm the database-generated Book ID in the status message. The site package does **not** change any real database records.

## Duplicate ISBNs and in-card manual ISBN lookup (October 2026)

Each separate physical book can be saved using the **same ISBN/barcode**. Import review shows potential duplicates for verification; complete duplicate rows may be selected and saved as new physical copies, with independent server-generated Book IDs. Use **Select duplicates** to bulk-select those copies. Saving never overwrites existing copies. If the backend reports PostgreSQL error `23505` for a *barcode/ISBN* unique index, the UI alone cannot override that database restriction: after inspecting database constraints, a Supabase administrator may run the supplied `allow_duplicate_isbn.sql` in SQL Editor to remove only barcode-related unique constraints/indexes while retaining the unique book/copy IDs. Do not run this migration if the duplicate error names a different column, or unless multiple physical copies should be permitted.

On every photo card, type or correct the ISBN in **Barcode / ISBN** and press **Find book details** (or Enter) right there in **Needs Attention**. Matching catalog details fill available empty fields on that same card. If no match exists, type the title in the adjacent field; then select and save. No scrolling back to the top ISBN form is required. An ISBN is never guaranteed to resolve in third-party catalogs.


## 4.4 — More catalogs, ISBN correction, shelf at top (October 2026)

**Single-book entry:** In **Inventory → Book barcode or ISBN**, the top form now includes **Shelf number / location** and **Title (optional if lookup fails)**. A shelf typed here is saved to `shelf_location` when you click **Add book**, including for duplicate physical copies. A single-photo scan pre-fills its review card from this shelf field; folder/ZIP imports keep their own folder-derived shelf assignments. **Clear** resets all three fields. If the catalog cannot resolve an ISBN, the optional title lets you add a usable book entry and finish missing metadata in the **Needs attention** inventory filter.

**Additional sources:** ISBN lookup now includes **DataCite** (free, DOI bibliographic metadata, exact ISBN identifiers required; limited coverage of general trade books). Title-page searches now additionally query **Crossref** and **OpenAlex** for scholarly book suggestions. Existing Google Books, Open Library, HathiTrust, Internet Archive, Wikidata, Library of Congress, Gutendex and optional paid ISBNdb sources remain. Crossref/OpenAlex **title suggestions do not guess an ISBN**; verify the correct work or edition before choosing one. Some providers may be slow, limited, blocked or return no record for a particular book. OpenAlex may impose a daily API budget.

**Lookup accuracy fixes:** The backend now retries an equivalent ISBN-10 when Google Books finds no exact edition under the supplied ISBN-13 (and vice versa); rejects Google responses without matching identifiers; and prefers the most complete Google edition when multiple exact matches exist. Open Library's general **work-level** search results no longer supply edition-specific publisher/page/language values that could be wrong. Data from different catalog titles is not mixed without a reasonable title match. DataCite also requires a verifiable exact ISBN identifier — a text-only search hit cannot establish an edition. The ISBN-13 check-digit suggestion in the browser was corrected.

**Retryability:** Unsuccessful catalog results expire more quickly on the server; browser-side no-match results are no longer retained for the whole session, so another attempt can succeed when provider availability changes. The per-instance rate ceiling was increased for ordinary scanning workloads, though public sources still apply their own limits. ISBN/title mismatches are highlighted instead of silently combining unrelated book details. Existing Supabase book IDs, loan status and duplicate-copy workflow remain unchanged.

**Deployment:** Replace the files in the existing GitHub repository and deploy on Vercel with repository root containing `index.html`, `assets/`, `lib/` and `api/`. The public APIs require **no new environment variables**. Optionally set `GOOGLE_BOOKS_API_KEY`, `ISBNDB_API_KEY` (paid), `BOOK_API_CONTACT` per earlier instructions. No SQL change is needed for the shelf field in the existing schema; it uses the existing `shelf_location` column. No Supabase records are modified merely by deploying the ZIP.

**Verification:** Run `npm test` or `node --test tests/*.test.cjs`; tests use mocked provider responses and do not establish real provider uptime. `python tests/test_metadata_ui.py` and `python tests/test_circulation.py` exercise the UI against an in-memory mock, not production Supabase. After deployment, test an ISBN known to be in your catalog, a rare ISBN, an unrecognized barcode with manually entered title and shelf, and two physical copies sharing the same ISBN. Recheck lookup API diagnostics using `/api/book-lookup?isbn=...`.

## 4.7 — Excel round-trip for scanned books in Review (October 2026)

The **Inventory → Import an entire shelf → Review** area now includes **Export review · Excel** and **Import corrected Excel**. This supports bringing a scanned batch into Excel for proofreading, adding missing ISBNs, titles, authors, publication details or shelves, and then saving corrected rows back to the same Supabase `library_books` inventory. You can also add additional physical copies by adding rows to the exported workbook, or by using the included `Library_Manager_Review_Excel_Template.xlsx` for a fresh spreadsheet-only batch.

### Workflow

1. Scan books using **Upload folder**, **Upload ZIP**, or **Select photos**. The review cards retain the original images in the current browser session.
2. Choose **Export review · Excel**. This downloads an `.xlsx` workbook containing **every not-yet-saved book in the batch review** (not just currently selected books, so no missing-titles are excluded). A separate Instructions sheet explains each column.
3. Open **Books to Review** in Excel, correct `ISBN_Barcode`, `Title`, `Authors`, `Publisher`, `Publication_Year`, `Language`, `Pages`, `Subject`, and `Shelf_Number` as required. Keep headers unchanged. Keep ISBN_Barcode cells as **Text**, especially ISBN-10s with leading zeros. Excel numeric formatting can permanently destroy leading zeroes, so do not rely on Excel to restore them.
4. **Do not change `Review_Key`** for an exported row. It is a stable, unique physical-copy key, not a barcode. Rows may share an identical ISBN but must have different Review Keys. To add another physical copy, append another row and leave its `Review_Key` empty. To ignore a row, write `SKIP` in `Import_Action`; otherwise choose `SAVE`.
5. Back in the same app choose **Import corrected Excel**. Existing review cards are updated (and keep their photographs in the current session). A new keyed row is created for each newly entered physical copy. Imported unsaved rows are selected automatically. The status line shows corrected, added and already-saved counts, but **importing alone does not write to Supabase**.
6. Click **Save selected to Supabase**. Each row is inserted with its own record UUID and a database-assigned `book_id`. Duplicate ISBN/barcodes, missing titles and shelves are permitted; rows that fail to save remain selected for retry. Refresh the inventory to see the new total.

### Duplicate protection and limitations

- The same `Review_Key` imported again is matched against the open review and the already-loaded shared database. If a matching physical copy has already been saved, it will be **skipped**, not inserted again. Network retry logic also checks unique record IDs in Supabase before treating an insert timeout as a new copy. No `upsert` is performed by ISBN.
- **Blank `Review_Key` means new physical copy each import.** If you add Excel rows with blank keys and subsequently re-import the *same* unkeyed sheet, those rows will be treated as additional new copies. To keep a stable key, import once and then use **Export review · Excel** again before saving or leaving the page.
- The exported workbook contains bibliographic text and filenames, **not the images themselves**. Pictures remain in the current browser review session; a re-import after refresh can still save the spreadsheet's book details but cannot restore original photographs from the workbook alone.
- The Excel uploader accepts `.xlsx`/`.xls` files up to **25 MB** and validates the expected **Books to Review** sheet, headers, actions, duplicate keys and maximum row count. Wrong templates or damaged Review Keys stop import before the review list is modified. Importing a workbook does not automatically alter or delete Supabase records; saving requires the explicit **Save selected** action.
- The new Excel round-trip is for **not-yet-saved scanned review rows and spreadsheet-added copies**. Existing books already stored in Supabase, including Inventory → Needs Attention, can still be corrected in place using **Edit details**; this review importer does not overwrite their saved records.
- Excel operations depend on the existing SheetJS client library from jsDelivr. If offline, the library may not load; make sure the browser can reach it.

**Tests:** `node --test tests/*.test.cjs` includes round-trip key validation, leading zero preservation (for cells stored as Text), duplicate-ISBN separation, `SKIP`, invalid key detection and template checks. `python tests/test_review_excel.py` performs mocked browser testing for exporting, correcting, adding new copies, importing, bulk Supabase saving and re-importing already-saved keys; no production records are inserted. `python tests/test_duplicate_save.py` verifies the existing duplicate-saving flow.

## Modern library dashboard (v5 design)

After signing in, Dashboard is the first workspace page. It reads the same
Supabase-backed inventory and lending/return records as Inventory and Loan History;
all charts and counts recalculate after data reloads and after successful saves.

- **Collection:** distinct grouped catalog entries, physical copies, available
  copies and copies currently on loan.
- **Performance:** complete catalog percentage, availability percentage, new
  physical copies in the last 30 days and recorded loans in that interval.
- **Circulation:** lending and returns by day for the last 7 days, a watchlist of
  active loans sorted by due date, and historically most borrowed books.
- **Catalog:** mutually exclusive complete/partial/untitled catalog categories,
  and shelf-location distribution calculated from individual physical copies.
- **Actions:** direct links to scanning, shelf import, loan, return, Inventory,
  Needs Attention, overdue records and loan history.

Distinct books are grouped using the same inventory identity rules as the main
Inventory page; **Total Copies** counts each physical record. Historical loans
are transactions rather than unique physical copies. The due-date watchlist
shows at most six active loans with recorded due dates, and the shelf chart shows
up to six shelf labels. The dashboard has responsive layouts and dark mode.

---

## v5.1 — Real library photography, edition covers and UI fixes (October 2026)

**Photographs instead of illustrations:** The dashboard, inventory hero, feature illustration and book-shelf image now use real Unsplash library and stacked-book photography. The user interface includes local JPEG fallbacks, so a failed connection to Unsplash does not leave an empty decorative panel. Source attribution is documented in `PHOTO_CREDITS.md`. Online photos require an internet connection to load.

**Actual book-cover artwork:** The Inventory table and cards fetch artwork by *validated edition ISBN* from Open Library Covers. If the ISBN is missing, invalid, or a cover is unavailable, the app shows a neutral book icon, rather than displaying a cover for an unrelated book. Stock photos are used only for the dashboard and decorative app images, not as fake book covers.

**Corrections:** Removed an accidental duplicated CSS class on the inventory hero photo, added loading-error handling and lightweight local fallback images, improved decorative panel spacing, and corrected the ISBN lookup rate-limit handling: missing or blank `Retry-After` headers no longer get parsed as an immediate retry. `Retry-After: 0` is still honored.

**Verification:** The JavaScript unit suite passes (47 tests). Browser smoke tests pass for the dashboard at desktop/mobile sizes, exact-copy circulation at 1440/390/360px, grouped inventory, duplicate saving, Excel review round trips, and real-photo/ISBN-cover fallbacks. Some older scripts (`test_title_recovery.py`, `test_metadata_ui.py`) reference superseded controls or API mock assumptions and should not be treated as current acceptance tests. Catalog availability, external photography hosting, and live Supabase permissions cannot be guaranteed by a local mock test.

**Deployment:** Extract the ZIP, commit the contents of its `librarymanger/` folder at the repository root, push to GitHub, then deploy that commit to Vercel. No database migration is required for this visual release. Your current Supabase data remains unchanged until you use the deployed app.

## v5.3 — Persistent Review queue for unfinished book scans

**Important:** The new server-side queue is available in the connected Supabase project (`library_review_queue`, deployed with row-level security). If deploying to a different Supabase project, run the included `persistent_review_queue.sql` in the Supabase SQL Editor before using Review. The app shows a **cloud sync status** message. If offline or the table is unavailable, it falls back to browser IndexedDB, but those rows will not transfer between devices until cloud sync succeeds.

### Review behavior

1. Scan a folder, ZIP or photos. Every scanned copy is appended to Review rather than replacing an earlier batch. Images that could not be identified remain editable.
2. Review rows (including missing-title books and other incomplete metadata) sync to Supabase with their original Review_Key. Browser IndexedDB remains an offline backup.
3. Small compressed book-photo previews are kept in the queue. Full-resolution photos are **not** backed up. Reopen Review later on the same account, on another device, or after reloading and select **Refresh review** if necessary.
4. Use **Export review · Excel** to export all unsaved rows, even if only a page of 40 is displayed. Correct the workbook, preserving Review_Key, then **Import corrected Excel** and **Save selected to Supabase**.
5. Incomplete copies already saved to the database appear in **Saved books needing attention**, below the unsaved queue. They can be exported separately with **Export saved needs attention · Excel**; importing their UPDATE rows modifies the *same* book copy rather than inserting a duplicate.
6. After successful save, an unsaved review item is removed from the cloud pending queue. If that saved copy still has missing fields, the saved Inventory copy appears in the saved Needs Attention section until its details are complete.
7. **Clear scan selection** only clears the file picker and scan queue; it does not erase review records. **Remove selected from review** deliberately removes selected *unsaved* pending rows from the cloud queue after confirmation; it never deletes Inventory books.

The queue is scoped to the signed-in user. Different library accounts can see the shared Inventory but only their own unfinished Review scans. Page controls show 40 Review entries at a time to avoid freezing the browser during large reviews. Local browser storage and cloud connectivity are subject to their respective quotas and availability; the sync status visibly reports failures instead of claiming that an unsynced item is safely stored.


## Inventory column filters — v5.4

In **Inventory → Search, filter and manage books**, select **Table view**, then use the small filter button next to any data column heading. This opens the persistent **Column filters** panel and focuses that field. The panel is also available from the **Column filters** button in **Card view and on mobile devices**, where table column headings are hidden for readability.

- **ISBN / Barcode, Title, Authors and Shelf** support case-insensitive, partial-text searches. Shelf checks all shelves attached to a grouped book, not just the representative copy.
- **Available Copies, Total Copies and On Loan** support inclusive **Min** and **Max** numeric filters. Counts are for physical copies, even though the Inventory displays one row per book.
- **Status** supports at least one available, at least one on loan, overdue copies, all available, all on loan, and mixed groups.
- **Details** supports full details, needs attention and without title.
- Filters are combined with each other and with the existing general search, status and completeness tabs. The filtered result count is computed before pagination. The book's individual physical copies and Book IDs are unchanged.
- **Clear column filters** clears only these per-column filters; **Clear filters** clears every Inventory search/status/completeness/column filter together. Data rows are never modified by filtering.

The **No.** field is a display position, not stored book information, and **Actions** contains controls, so neither has a data filter. Excel export retains the previous **Export all** behavior rather than silently exporting only currently visible rows.

No database migration or new environment variable is necessary for this version. For a quick check after deployment, select Table view, filter by a title, enter `2` under Available Copies minimum, and verify that the table shows only books with at least two available copies. Return to Card view to confirm the same results, and click Clear filters to restore the full catalog.


## Click-to-select inventory column filters — v5.5

Open **Inventory → Table view**, then click the filter icon next to a column such as **Title**, **ISBN / Barcode**, **Authors**, **Available Copies**, **Total Copies**, **On Loan**, **Status**, **Details**, or **Shelf**. The **Column filters** panel opens with a searchable, Excel-style checklist containing the distinct values actually found in that column, with counts of distinct book entries. On mobile or in Card view, open **Column filters** and tap the column name. Values are taken from the entire inventory, not only the current page.

- Tick **one or several values**. Several values within a column act as **OR**; filters from different columns, global search, and availability filters act as **AND**.
- Each option shows the count of distinct book entries with that value. Counts account for grouped copies and consider other filters, not the current column's own selections. For example, the Shelf picker includes the shelves of **all physical copies** in a grouped entry.
- **Search values** narrows the list without changing the selected books. Very large lists show the first 150 options and can be searched to find any remaining value.
- **Select all shown** selects the values currently listed; **Clear selected values** clears just that column. **Clear column filters** clears all column criteria; **Clear filters** also resets the general Inventory search and status controls.
- The original text search, numeric minimum/maximum fields, and advanced status criteria remain available under **Advanced filters**; there is no database migration or query needed.

This is a read-only UI feature: filtering never changes the underlying books, grouped copy counts, circulation status, persistent Review queue, or Excel exports.


## Unified theme and appearance — v5.6

- Light and dark modes now use consistent foreground, background, field, feedback, and heading colors throughout Dashboard, Inventory, Review, Lending, Returns and History.
- Replaced remaining fixed light surfaces in inventory cards, review tools, bulk import panels, search fields, metrics and filter menus with theme-aware tokens. In dark mode headings now use a readable light color rather than the dark button background color.
- Theme switch is accessible (`aria-pressed` and updated action label), updates native controls and the browser theme color, and persists the chosen mode in the current browser using `library_manager_theme_v2`.
- Dark/light modes were checked at 1440, 800, 390, and 320 pixels using an isolated browser test with mocked database records.
- This update is visual only: it does not modify book records, scanning, cloud review, export/import, circulation, database schema, or Supabase policies. No SQL migration is required.
