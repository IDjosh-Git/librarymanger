# Library Manager v5.53 — Percentage-only scanning and detailed scan history

## What changed

- Active Scan progress displays the percentage and progress bar rather than an `x / y photos` count. Status and hint copy now describe the phase without publishing running raw photo counts. Internal exact checkpoint counts remain unchanged for recovery and duplicate protection.
- The **Last completed scan** panel now displays a detailed report: total photos processed, exact Inventory and Review totals, skipped/duplicate count, needs-attention count, each category’s percentage, and a segmented outcome bar.
- Completed history is still browser-and-account-scoped; retained for six hours or until a new batch starts. No database migration is needed.
- Existing offline scan recovery, Review approvals, lending, and Admin controls remain unchanged.
- Offline app-shell cache identifiers and stylesheet/script versions were updated to avoid serving stale progress screens after deployment.

## Checks

- `npm test`: 193 tests passed.
- `tests/browser_scan_history_percent_v553.py`: responsive percentages, detailed counts, and stable meter height at widths 320, 360, 390, 540, 768, 1024 and 1440 pixels; light/dark history screenshots.
- This is a simulated browser display and logic check. Actual Supabase scan completion in production should be verified after deployment; no live inventory data was modified.
