# Library Manager — Table readability update (3 November 2026)

- Inventory table width increased to at least 1850px so ISBN, copy counts, shelf, status, and action buttons stay on one line. Long book titles remain allowed to wrap.
- Loan History table width increased to at least 1380px; long book titles may wrap, while dates, borrowers, statuses, and actions stay on one line.
- Scanned Books table width increased to at least 1520px; title is the only field that wraps.
- On mobile, tables scroll horizontally instead of being converted to stacked record cards. Scroll hints and keyboard-focusable, labelled scrolling regions are included.
- This change is CSS/HTML only: it does not alter any Supabase data, policies, or authentication.

Deploy the files in `librarymanger-main` to your existing Vercel project. No additional SQL is required.
