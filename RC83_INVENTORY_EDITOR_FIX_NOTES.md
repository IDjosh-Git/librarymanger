# RC83 — Inventory edit popup Save fix

- Fixed a JavaScript ReferenceError (`latest is not defined`) that prevented every inventory popup save from reaching the database.
- Compares the record's stored `updated_at` timestamp when present, to avoid overwriting newer edits.
- Treats a zero-row update as a failure instead of reporting a false success (concurrent change or database permissions).
- Adds visible save progress, error feedback, title validation, and submit-button re-enablement.
- Keeps the previous RC82 Review page stabilization and mobile layout changes.

Validation: all existing tests and two new regression tests pass; live Supabase permission/RLS behavior requires deployment and a real account to verify.
