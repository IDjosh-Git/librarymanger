# RC82 — Review input stability and compact mobile layout

- Preserve the currently focused review form across background rerenders; other queue counters continue updating.
- Capture edits immediately in the in-memory review row while the edit lock is being acquired; persist after the lock succeeds.
- Do not disable the focused field during an asynchronous lock request, avoiding keyboard dismissal on phones.
- Protect actively edited rows from late cloud-snapshot replacement.
- Add mobile-specific responsive layout, tighter card/section spacing, single-column fields, and comfortable 16px input font.
- No schema changes required.

Validation: `node --test tests/*.test.cjs` (20 existing tests passed). Manual mobile-device and live Supabase concurrency tests are still recommended.
