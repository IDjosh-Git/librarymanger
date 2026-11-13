# Library Manager v5.46 — Lending, administrator tools, visual consistency

## Changes
- **Administrator access code generation** now lives exclusively on the **Administrators** workspace page, beneath the administrator access-control header. It is hidden in the UI for Library Members by both role-aware application state and CSS, and the existing server-side generator action remains restricted to validated administrators. The existing *Activate Admin Access* form remains available for members who have valid private codes.
- **Lending title picker:** displays each distinct book title once instead of one dropdown option for every physical copy. Copies are grouped case-insensitively with repeated spaces normalized; unidentified books remain independent. Searching by Book ID, barcode, author, or shelf narrows matching physical copies, so an exact identifier can still select a specific book.
- **Availability card:** displays Available Now, On Loan, and Total Copies for the selected book title, based on the currently loaded Supabase Inventory snapshot. Counts update on selection, clearing, and refreshing. The actual lending transaction still updates a single available book record using its immutable `record_id` and optimistic `book_status` condition.
- **Returns:** remain copy-specific, preserving exact borrower and loan-record matching.
- **Design:** updated main app, Book of the Week, and Reading Guide CSS to align prominent buttons, visual accents, and the floating reading assistant with the established navy/teal theme in light and dark appearance. Danger and overdue states retain meaningful warning colours.

## Tests
- Existing automated suite: 146 tests unchanged, all passing.
- New title-grouping, admin-location, and theme tests: 7, all passing (total 153).
- Browser smoke for member/admin generator visibility, 2-title picker from 3 available copies, exact-copy ID selection, on-loan counts, 6 widths from 320px–1440px: passed.

## Rollout / limits
- Deploy the source ZIP to the connected Vercel project to activate these changes. No SQL migration is required.
- Availability figures reflect the last successful inventory reload. The final lending operation checks availability again in Supabase; if two members choose the same copy concurrently, the second will receive the standard conflict handling.
- The existing production data has not been altered during this design update. Run an authenticated end-to-end lending test after deployment.
