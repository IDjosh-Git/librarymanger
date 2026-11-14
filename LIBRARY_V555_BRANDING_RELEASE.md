# Library Manager v5.55 — shared appearance settings (incremental release)

## Implemented
- Admin-only settings for app name, primary and secondary palette, gradient/solid buttons, and logo upload/removal.
- Branding is shared through `public.library_app_settings` with Supabase row-level security, and logo files through the `library-branding` storage bucket.
- Header, sign-in logo, page title, core action colors, and navigation use the shared palette; compacted Book Recognition controls.
- Existing Review, Inventory, and Lending records are unchanged.

## Required setup
1. Run `database/13_shared_branding.sql` in the **correct Supabase project**.
2. Deploy the app files to Vercel and hard refresh once.
3. Sign in as an administrator, expand Account settings > App appearance & branding, save a palette and optionally upload a logo.
4. Open a second device/account and confirm branding persists.

## Limitations / next phases
The other requested automation features (automatic review assignment and locks, inventory reconciliation, metadata completion, lending reminders, reservations, AI recommendations, scheduled reporting, inventory audits, health monitoring, backup recovery) are **not implemented in this incremental release**. They require separate database migrations, job orchestration, and end-to-end testing. Existing features may already provide portions of these workflows. No database migration or Vercel deployment was performed automatically.
