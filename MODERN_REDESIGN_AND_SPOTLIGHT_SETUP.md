# Library Manager — Modern UI + Book of the Week (3 Nov 2026)

## Delivered

- **One maintained app stylesheet:** `assets/library-ui.css` replaces 9 separate CSS stylesheets and the original inline CSS. Legacy component rules are retained in source order inside the bundle to protect specialized workflows, with a clearly marked authoritative visual system at the end. No obsolete standalone CSS files remain.
- **Modern inventory:** Catalog is prioritized above Add Book and Bulk Review; larger search field, clearer status chips, high-contrast table headings, card/table controls, more usable column filter panel with searchable value chips, consistent native select chevrons, and quick jumps to catalog/add/import tasks.
- **Dropdown consistency:** native selects, collapsible sections, and column-filter expand/collapse use uniform custom chevrons. Labels and headings never rotate.
- **Public Book of the Week:** `/book-of-the-week.html`, cover, title, author, short recommendation, ISBN, shelf and featured date. Visitors see only the publicly curated entry, not private inventory or loan data.
- **Admin editorial publishing:** Inventory → **Book of the Week** → find/select book → optionally enter a description and custom HTTPS cover URL → **Publish Book of the Week**. ISBN covers are requested from Open Library when valid; fallback photo used if unavailable. If no book has been featured, the public page displays an honest placeholder.
- **Registration:** `Administrator access code` appears only when **Create Account → Admin** is chosen, not on Sign In or Create Account → User. Server-side role verification remains authoritative.
- **Preserved:** User and Admin authorization, Supabase inventory & circulation, scan/review workflows, Excel, optional Gemini AI, authentication, and Google Sheets mirror removal from the previous release.

## One-time Supabase setup for public Book of the Week

1. Confirm you already have `public.library_member_roles` and a verified Admin user.
2. Back up the Supabase database, review the new file `library_book_of_the_week.sql` and run it from the **Supabase SQL Editor**. This creates only the single-row, publicly readable featured-books table with **Admin-only write policies**. It does **not** alter inventory or loan tables.
3. Verify the SQL table and policies with the read-only verification queries at the bottom of the script.
4. Deploy the updated site files to Vercel. `book-of-the-week.html` is a static route; no new API key or Serverless Function is required for this page.
5. Sign in as an Admin → Inventory → Book of the Week → select a catalog title and publish. Visit `/book-of-the-week.html` in a private browser window to verify public visibility.

> **Important:** The project ZIP does not run SQL against your live Supabase. Publishing will fail until this one-time SQL setup is applied. Users can still see the design-only empty spotlight page before setup.

## Deployment and validation

1. Extract the ZIP and deploy the **contents** of `librarymanger-main` to your existing Vercel project; retain the same published Supabase key.
2. Confirm Sign In doesn't show role selection; Create Account → User hides the Admin access code; Create Account → Admin displays it.
3. Test Dashboard, Inventory, Scanned Books, Lend/Return, notifications, Excel import/export, scanner and AI metadata suggestions with real accounts on staging.
4. Check the Book of the Week page while signed out. Test unauthorized insert/update to the featured table as an ordinary User; it must fail under RLS.
5. Recheck light/dark, open/closed disclosure controls, 320–1440 px layouts and real mobile hardware.

## Security and limits

- Public book recommendations contain only the explicitly published metadata and cover URL; they do not expose borrowers, personal accounts or the full inventory. Treat the optional shelf field as public when featuring a book.
- Publishing requires an authenticated admin verified by Supabase RLS; choosing Admin in the browser alone cannot grant access.
- Existing database role/access-code upgrades still apply; no invitation code or AI changes were made.
- External book-cover artwork from Open Library or any custom HTTPS URL depends on the source service; a local image fallback is provided.
- Local HTML/browser tests do not substitute for staging verification of Supabase RLS, live accounts, or physical-device scan permissions.
