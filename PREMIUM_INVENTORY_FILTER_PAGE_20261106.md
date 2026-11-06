# Library Manager — Premium Inventory Filter Screen
Release date: 6 November 2026

## What changed

- A single prominent **Filters** button sits beside Inventory search.
- Clicking Filters opens a dedicated, accessible modal filter page: full-screen on mobile and a large centered panel on desktop.
- The new screen combines availability, title/completeness, nine field selectors, and the existing advanced text/quantity filters.
- The modal has persistent **Reset all**, **Cancel**, and **Show results** controls, with the count of matching titles.
- Selecting filters previews the results; **Cancel**, Escape or the close button restores the previous filter selections and search query; **Show results** keeps changes.
- Background scrolling is locked while the screen is open, then the prior scroll position is restored.
- The number of active filters is visible on the Filters button.
- Preserves grouped inventory rows (one book title/author group with Total Books and Available Copies) and the separate Manage copies panel.
- All copy-level lending, returns, scanner, review, and database functions remain unchanged.
- Designed for light and dark modes and tested at 320px, 390px, 768px, and 1440px.

## Files changed

- `index.html` — reorganized Inventory filter UI into a native dialog; new cancel/apply/reset state handling, dynamic match counts and scroll locking.
- `assets/library-ui.css` — premium responsive filter screen styles for light and dark themes.

## How to deploy

For an existing GitHub/Vercel site, use the smaller update ZIP and replace those exact two files, maintaining the same paths. Commit to the branch deployed by Vercel and allow it to rebuild. No Supabase migration or API-key change is required.

## Verification

- Python suite: 72 passing tests.
- Existing JavaScript suites: all passing.
- Dedicated new filter-source assertions: passing.
- Isolated Chromium interaction tests (8 combinations: 4 viewport widths × 2 themes): modal open, scroll lock, responsive width, Cancel/Escape rollback, Apply, Reset, return to page scroll.
- These tests do not constitute a production browser test against your deployed Vercel site. Verify again after deployment.
