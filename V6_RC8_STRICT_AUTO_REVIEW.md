# Library Manager v6 RC8 — Strict Intelligent Auto-Review

## Delivered
- Admin-only strict Auto-Review controls in Automation Centre: preview, enable/disable, bounded batch size, run with confirmation.
- SQL migration `database/22_intelligent_auto_review.sql` creates settings and append-only audit records; server-side batch approval checks metadata provenance, exact title/author/ISBN matches, required fields, copy identifiers, duplicate inventory and pending queue IDs, active editor/approval/assignment leases, and scan errors.
- Transactional row locking and advisory locks prevent two batches from inserting the same physical copy ID concurrently.
- ISBN duplication by itself is permitted; only physical-copy identifiers must be unique.
- Auto-approval starts OFF and batch previews are read-only. Existing pending rows are not altered by installation.

## Important deployment and verification
1. Deploy frontend and apply migration 22 in a controlled release. Migration 22 has NOT been applied to production.
2. Preview and confirm with two admin accounts; validate actual inventory record insertion, audit trail and Review count refresh.
3. `verified_metadata` provenance must be written by a trusted book-lookup integration; legacy scan items do not have it. No legacy book is automatically approved merely because OCR recognized a title.
4. Before activating, verify inventory constraints and the existing Review-to-Inventory save workflow; this RPC intentionally handles new physical copies only, not updates to existing records.
5. Database function currently processes only the oldest N pending rows per batch. Future queue-wide processing should use a scheduler with rate limits and retry handling.
6. A source field in client-editable JSON is not a cryptographic attestation. Production automation should move provenance into server-controlled records or validate via a trusted service before allowing unattended approvals.

## Verification
235/235 Node tests passed. No live multi-account or database integration test was performed.
