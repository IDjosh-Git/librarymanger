# Library Manager — Consolidated Inventory quantities

This update affects **Inventory display only**. It does not alter Supabase tables, import records, borrowing history, or the Scan & Review saving rules.

## What changed

- Books with the same normalized title and author are displayed **once** in the Inventory table and grid, even when ISBN, physical-copy barcode, shelf, edition, publisher, year, or optional metadata differs.
- A copy with missing author can join a matching titled group **only if exactly one distinct author is known** for that title. Same-title books by different known authors stay separate. Copies without a readable title remain independently identifiable for review.
- The table now labels the grouped quantity **Total Books**, with **Available Copies** and **On Loan** shown alongside it. Each total is the number of physical Supabase records, not just distinct ISBNs.
- The old *additional table row* containing individual copies is removed. A **Manage N copies** button opens a responsive, accessible panel containing separate Book IDs, shelf information, and per-copy lending, returns, edit and delete controls (respecting account roles).
- Different editions or physical copy barcodes are identified as such in the grouped ISBN/barcode display, rather than showing a potentially misleading single barcode.
- Inventory export continues to emit one row per grouped book, with copy counts and the associated physical Book IDs.

## Important behavior

**No duplicate records are merged or deleted in Supabase.** Each physical book copy retains its unique immutable record ID, lending status, and audit history. For example, three copies of *Things Fall Apart* by Chinua Achebe display as one Inventory row with **Total Books: 3**. Individual copies are still accessible via **Manage 3 copies**.

For ambiguous titles without an author, separate groups may remain to avoid combining unrelated books. Add the correct author to consolidate them safely.

## Verification

- 72 existing Python regression tests passed.
- Five Node.js regression suites passed, including a new grouped-Inventory test for title normalization, mixed barcodes, unknown authors, preserving distinct copies, quantity counts, table/grid rendering, and the copy panel.
- HTML's inline JavaScript and both browser/Node inventory-grouping modules passed JavaScript syntax checks.
- Isolated Chromium checks at 320, 390, 768 and 1440 pixels passed: one row per group, no horizontal page overflow, modal opens/closes and body-scroll state is applied. The wide data table itself retains horizontal scrolling on small screens.
- Production Supabase rows and production website were not modified. A final test after Vercel deployment is still recommended.

## Deployment

For an existing GitHub repository, replace these four files from the **Update Only** ZIP, maintaining their relative paths:

1. `index.html`
2. `assets/library-ui.css`
3. `assets/inventory-grouping.js`
4. `lib/inventory-grouping.cjs`

Commit to the repository linked to your Library Manager Vercel project. No Supabase migration is needed.
