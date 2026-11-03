# Library Manager

Library Manager is a Supabase-backed library workspace for inventory management, book scanning and review, lending, returns, overdue notifications, Excel import/export, and optional Gemini-powered book-cover recognition.

## Current release — automatic feature, contact links and circulation refresh (3 November 2026)

This release extends the navigation and overview version with a premium public Book of the Week advert, deterministic **automatic weekly selection when no admin book is published**, clearer Lend and Return pages, and a new **Admin → Contact & social links** editor. Public and signed-in user pages display only the official contact fields and social links that an administrator has saved. The Google Sheets mirror remains absent.

**New one-time Supabase setup required:** After the existing role and Book of the Week migrations, run `library_public_discovery_upgrade.sql` from Supabase SQL Editor. The new script adds the administrator-protected public contact directory, authorizes clearing a manual feature, and creates a narrowly scoped anonymous book-recommendation RPC. Read **`PUBLIC_DISCOVERY_CONTACT_SETUP_20261103.md`** before deployment.

The public page does not require an administrator to log in and pick a book each week; its fallback selection changes by ISO week whenever a titled catalog record exists. A manual admin pick overrides it until the administrator clicks **Use automatic weekly pick**.

Offline checks: 20 Python regression tests passed, inline and asset JavaScript syntax checked, CSS parsed, dynamic public contact links were simulated, and static responsive Chromium layouts showed no horizontal overflow from 320 to 1440 px. **No SQL was executed in your production Supabase project, and no live database integration test was performed.**

## November 3, 2026 redesign and Book of the Week

- **Google Sheets mirroring has been completely removed** from the app, including its configuration panel, Apps Script file, automatic book/loan mirror requests, and legacy connector code. Book and loan writes remain in **Supabase**.
- Refreshed light/dark colours, readable navy hero cards, and consistent typography and card alignment across the public sign-in/create-account screens and the signed-in workspaces.
- Replaced the problem dropdown icons with a single chevron pattern. Only the chevron rotates—not the text. Native selects also use consistent, high-contrast chevrons.
- The Admin and User role architecture is unchanged. Sign In does not request a workspace choice. Create Account offers User or Admin, but Admin activation **requires a private access code checked by Supabase**.
- Layout was checked at 390, 768 and 1440 px in both themes using static Chromium fixtures. **Live Supabase authentication, permissions, writes, and deployment still need end-to-end testing.**

The latest redesign moves inventory search/filtering above bulk tools, consolidates CSS into one maintained app stylesheet, and adds `book-of-the-week.html` with secure Admin publishing. See `MODERN_REDESIGN_AND_SPOTLIGHT_SETUP.md` for the required Book of the Week setup.

See `RELEASE_NOTES_20261103.md` for earlier Google Sheets removal details.

## Deploy to Vercel

1. Extract this project and push the **contents of `librarymanger-main/`** to your repository root (not a nested folder unless Vercel's Root Directory points to it).
2. Deploy in Vercel using the existing project and framework setting. Keep `index.html`, `assets/`, `api/`, `lib/`, and `vercel.json` together.
3. Keep the same Supabase URL and public/publishable key already configured in `index.html`. **Never put Supabase service-role keys or Gemini secrets in browser code.**
4. Configure optional AI in **Vercel → Project → Settings → Environment Variables** using `GEMINI_API_KEY`, then redeploy. The optional `GEMINI_MODEL` is read by the AI endpoint if supported.
5. If installing the role system for the first time, back up Supabase and follow `ADMIN_USER_REGISTRATION_SETUP.md`. Do not rerun existing SQL migrations blindly. The private administrator code migration is **not** a frontend-only setting.
6. Test an Admin account and User account separately before using the app in production. Verify book creation, editing, scans, lending, returns, overdue notifications, Excel import/export, and password recovery.

**Important:** Modern styling does not require SQL changes, but the **public Book of the Week and contact features require `library_book_of_the_week.sql` and `library_public_discovery_upgrade.sql` (in that order)**. That migration adds only a separate, curated public-feature table with Admin-only writes. It does not delete or alter existing inventory and loans in Supabase.

## Application architecture

- `index.html` — user interface, authentication and browser workflows.
- `assets/library-ui.css` — a single consolidated app stylesheet with existing workflow-compatible rules and a final modern visual system (navigation, inventory, filters, dropdowns, cards and responsive layouts). The nine older standalone CSS files have been retired.
- `book-of-the-week.html`, `assets/spotlight.css`, `assets/spotlight-premium.css`, `assets/book-of-the-week.js` — public reading advert with manual/automatic curated book selection.
- `library_book_of_the_week.sql` — original Admin-only publishing migration; apply once in Supabase.
- `library_public_discovery_upgrade.sql` — public contact directory, Admin-only contact edits and automatic featured-book fallback; apply once after the original Book of the Week table exists.
- `assets/public-contact.js` — safe public contact link rendering on public, guest and signed-in pages.
- `assets/*.js` and `lib/*.cjs` — inventory, scanner, Excel, metadata and dashboard logic.
- `api/book-lookup.js`, `api/title-search.js`, `api/book-vision.js` — current Vercel functions. There is **no** `/api/admin-invite` function or Google Apps Script integration in this release.
- `vercel.json` — current deployment config. It references only an existing Serverless Function.
- `*.sql` — Supabase migrations. Apply only after inspecting your existing database state and backing it up.

The Gemini AI key is optional. Book metadata lookup, local OCR and Excel support remain separate from Gemini and Google Sheets.
