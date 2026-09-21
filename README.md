# Library Manager 4.0 — Vercel edition

The app is a static HTML/CSS/JavaScript website with a Vercel ISBN metadata function. The current edition includes icon-only light/dark controls, top/bottom floating buttons, a Ctrl+K quick-action menu, card/table inventory views, five sorts, adjustable pagination with first/last buttons, due-soon loan filtering, and responsive toast feedback. These features require no database schema changes.  It uses the existing Supabase project in `index.html` and optionally the already-deployed Google Sheets Apps Script. No server build, additional database SQL, OpenAI key, or Netlify account is required.

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
- **Inventory:** Switch between table and card layouts; choose sort order and 25, 50 or 100 items per page. Editing book ID and shelf location is available in table view. The card **Edit** icon switches back to the table. First/previous/next/last pagination buttons operate on books and loans.
- **Page navigation:** Floating double-chevron icons jump to the top and bottom of the page. They become disabled when you're at an endpoint.
- **Loan alerts:** The loan-history filter now has **Due soon** for active loans due within seven days, separate from **Overdue**.
- **Feedback:** Status updates also appear briefly as a small notice on mobile and desktop; the permanent result remains in the workspace status panel.

These updates keep the existing Supabase URL, publishable key, database tables and Google Sheets integration. **Do not rerun Supabase SQL or replace a working Apps Script solely for the UI update.** Validate real sign-in and real Supabase/Google writes on the deployed site before relying on it for live circulation. The Google Sheets mirror is an optional best-effort integration, not a confirmed transactional sync. The barcode scanner uses the image/photo upload; an always-on camera preview is not part of this release.

## Bulk duplicate selection (new in 3.1)

In **Inventory → Import an entire shelf**, scan a folder, ZIP or photos and review the vertical list. **Select all** selects every unsaved row, including flagged duplicates and incomplete rows. **Select duplicates** selects all unsaved rows flagged as repeated barcodes/ISBNs (including records already in the library). **Select non-duplicates** selects complete rows that are not flagged; **Clear selection** unticks everything. The checkbox above the vertical list selects all unsaved rows, too.

To remove unwanted duplicate photos, click **Select duplicates → Remove selected from review** and confirm. This removes only the unsaved photos in that batch, **not any existing Supabase records or Google Sheets rows**. If duplicates are legitimate separate physical copies, use **Save selected to Supabase**, which asks for explicit confirmation before creating additional records. If two photos show the same *single* physical copy, avoid saving both. Incomplete rows can be bulk-selected and removed from review, but must be corrected before saving. Saved rows cannot be removed from the review list individually.

This update is frontend-only. Keep your existing Supabase tables and Google Apps Script. Sign in and verify the workflow on your deployed Vercel address before bulk importing real books.

## Scanned books in a vertical list (3.2)

**Inventory → Import an entire shelf** now displays every scanned photo/book as a separate, full-width card arranged **top to bottom**, instead of a horizontally scrolling review table. Each card includes its own selection checkbox, photo name/path, editable shelf, barcode/ISBN, title and author, plus a status or duplicate warning. The select-all checkbox remains above the list, and all bulk duplicate/select/save/remove actions are unchanged. The saved inventory opens in a single-column card list by default; you can still switch to the table to edit book IDs and shelves. This change does **not** require database SQL or a Google Apps Script update.


## Searchable lending, returns and reliability improvements (3.4)

**Lending:** Open **Lend a book**, type a title, author, barcode/ISBN, shelf, Book ID or exact copy reference in the search box, and choose the copy in the dropdown. Only available copies are offered. The selected book and its ID fill automatically; use **Clear chosen book** to start over or **Refresh available copies** to retrieve changes made by another librarian. The **Lend** button on each inventory card/table row now directly selects its *unique record ID*, so it works even when several copies share an ISBN or lack a Book ID. The due date must not precede the borrowed date, and the borrowed date cannot be in the future.

**Returns:** Search among borrowed copies by title, borrower, ISBN, Book ID or shelf, and select a copy to fill its ID, borrower and due date automatically. Inventory **Return** and active-loan-history **Return** actions also open this form with the exact copy selected. Check the return date and press **Confirm return**; a future return date is rejected. A borrowed inventory record with no matching active loan will show an actionable error instead of pretending a return succeeded.

**Existing Book IDs:** Older inventory records may have no assigned `book_id`. In that case, the Book ID box shows the unique `record_id` copy reference for reliable selection; this is **not** silently written as a new Book ID. To assign a human-readable Book ID, switch Inventory to **Table** and edit that copy's Book ID cell. Avoid assigning the same identifier to different physical copies.

**Multiple users / saving:** Lending uses a conditional status update to reserve a currently available copy *before* creating its loan. If the copy has been lent by someone else, this prevents a second loan being inserted. If loan creation fails after reservation, the app attempts to reverse the reservation and warns when manual reconciliation is needed. Returns use a conditional loan-status update. The browser makes separate Supabase requests: these safeguards **do not provide a fully atomic multi-table transaction**. For strict transactional circulation across many librarians, a separately reviewed server-side PostgreSQL RPC/transaction would be necessary. No database schema or RLS changes are performed by this package.

**Testing:** Local Chromium tests with an in-memory fake database cover the inventory actions, duplicate ISBNs, missing Book IDs, searching and automatic ID filling, lending/returning, the active-loan-history button, stale competing loans, a simulated failed loan with successful reversal, date checks, and searching in a 233-book collection. Tests run at 1440, 390, and 360 pixel widths. These tests do not prove permissions or writes against the real project; after deployment, make a *test* loan and return before relying on it for real lending.


## ISBN lookup from multiple catalogs (4.0)

**What it does:** Scanning or entering a valid ISBN-10 or ISBN-13 first asks the same-origin Vercel function `/api/book-lookup?isbn=...` for a matching edition. The backend consults **six different catalogs** through **seven ISBN lookup routes**, subject to provider availability: Google Books; Open Library Edition and Open Library Search (two routes in one catalog); HathiTrust; Crossref; Library of Congress digitized books (last resort); and ISBNdb (an optional paid catalog). Crossref mainly indexes registered publications, and the Library of Congress endpoint does not cover every printed book. The app verifies matching ISBNs and rejects invalid check digits rather than assigning an unrelated title. It merges fields that are missing, but no service can guarantee metadata for every ISBN. A non-ISBN barcode can still be saved and manually edited.

**User controls:** In **Inventory → Add by barcode or ISBN**, enter an ISBN and click **Find details** to preview the catalog result *without saving anything*. Click **Add book** to save to your existing shared Supabase library. On an existing book card (or table row), click the **refresh/details** icon to look up and fill only empty metadata fields after your confirmation. It never intentionally overwrites existing Book ID, shelf, borrower, loan status, or populated fields. A substantially different returned title is blocked and should be checked manually. Shelf-folder imports use the same lookup as individual scans.

**Publish to your existing Vercel project:** Extract the ZIP and update the existing Library Manager GitHub repository with **all files and folders**. Do not omit `api/book-lookup.js` or `lib/book-metadata.cjs`, and make sure these directories are at the repository root next to `index.html` and `vercel.json`. Redeploy the production site in Vercel. Framework preset **Other**; no build command. The endpoint is a Node.js serverless function and is unavailable if you deploy only `index.html` or host the site as a static HTML file. No Supabase SQL or Google Apps Script updates are required.

**Optional Vercel environment variables** (Settings → Environment Variables → Production, then redeploy):

- `GOOGLE_BOOKS_API_KEY`: a Google Books API key if you have one; otherwise the app tries public access where supported. Keep the server key out of the HTML, repository and screenshots; restrict the key appropriately in Google Cloud.
- `ISBNDB_API_KEY`: only if you have a compatible **paid ISBNdb API subscription**. Without it, the other public catalogs still work; do not purchase anything just to try the app.
- `BOOK_API_CONTACT`: a library-admin contact email to identify requests politely to Open Library. This is a server-side identifying contact and must not be a personal secret.

Open `https://YOUR-LIBRARY.vercel.app/api/book-lookup` to check that the function deployed and lists the supported sources. To check an individual book, visit `https://YOUR-LIBRARY.vercel.app/api/book-lookup?isbn=9780140328721` and inspect `found`, `metadata`, `sources`, and `checked`. No API key values are returned. A missing or unavailable catalog is reported as `no_match` or `unavailable`, and the app can still save a book with manually entered details. Third-party providers may rate-limit requests. This function applies per-instance request limits and short-lived caching; it is **not** a globally distributed quota or guaranteed availability service.

**Testing boundary:** The package includes mock-driven metadata lookup and interface tests, not proof that every third-party catalog is reachable from the deployed Vercel region. Test several ISBNs on your own deployment and verify existing books, user sign-in, and test lend/return actions before relying on it for real circulation.
