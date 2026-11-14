# RC9 — Server-side metadata verification

## Implemented
- Administrator-authenticated POST `/api/verify-review-metadata` (limit 1–25).
- Independent ISBN lookup via existing catalog integrations, strict ISBN/title/author comparison, rejection on conflicts and missing primary edition evidence.
- Server-only writes to `library_auto_review_verified_sources`; no browser write permission.
- Admin automation centre button to verify pending queue before previewing or running approval.
- Automated strict-verifier tests. Full test suite: 240/240 passing.

## Required deployment configuration
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; optional `GOOGLE_BOOKS_API_KEY`, `BOOK_API_CONTACT`.
Keep service-role key in Vercel server environment only, never expose to browser. Deploy this package to the matching Vercel project.

## Production status
Database registry and strict auto-review functions were installed previously. This release's server endpoint and browser changes are packaged locally, NOT deployed to Vercel. No live external provider-to-database test was run. Auto-approval remains disabled. Before enabling, verify provider results against a controlled set of actual books, test role authorization, and execute a small dry-run and a controlled approval batch.

## Limitations
The existing catalog lookup merges bibliographic data from providers. This verifier requires a primary exact-edition provider in its evidence and rejects provider conflicts, but individual field-level provenance is not retained by that existing lookup. For unattended approvals, strengthen provider-specific provenance and test the inventory approval path on a staging database first.
