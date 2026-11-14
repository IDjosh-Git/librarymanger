# Library Manager v5.59 — Review reconciliation export

Adds a read-only reconciliation CSV export to the shared administrator Review panel. On click it fetches the current cloud pending queue and compares each physical copy UUID against the Inventory currently loaded in the browser. It flags missing titles, repeated physical copy IDs, copies already present in Inventory, and records not updated for 24 hours. The report includes uploader and last-update metadata. ISBN is included for human review but never used as proof of duplicate physical copies.

## Limitations and deployment
This is an advisory report, not automatic correction or a complete server-side inventory audit. Inventory comparisons use the books loaded in the browser; refresh Inventory first. Requires earlier Supabase migrations, but no new migration for v5.59. Deploy application to Vercel and test with two administrators. No production deployment or database changes performed.
