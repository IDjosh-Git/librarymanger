# Library Manager 3.2 — Vercel edition

The app is a static HTML/CSS/JavaScript website. Version 3 adds icon-only light/dark controls, top/bottom floating buttons, a Ctrl+K quick-action menu, card/table inventory views, five sorts, adjustable pagination with first/last buttons, due-soon loan filtering, and responsive toast feedback. These features require no database schema changes.  It uses the existing Supabase project in `index.html` and optionally the already-deployed Google Sheets Apps Script. No server build, additional database SQL, OpenAI key, or Netlify account is required.

## Option A: GitHub + Vercel (recommended)

1. Extract this ZIP on your computer. The **repository root** must directly contain `index.html`, `vercel.json`, `assets/`, and optionally `README.md` and `Code.gs`. Do not upload the ZIP as a GitHub repository file or nest these inside a second folder.
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

The HTML/CSS/JS and optional Apps Script are the same versions as in the previously tested modern Netlify package; only hosting configuration and instructions changed. The original desktop/mobile UI tests used **mock Supabase data**, not real logins or lending. Deploy and verify actual sign-in, camera, Supabase writes, and Sheets writes before relying on the app for live inventory.

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
