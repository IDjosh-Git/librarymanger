# RC33 recognition mismatch audit

## Corrected
- Per-book history now filters completed jobs by the review UUID, or by the current session job ID for unsaved reviews. The API includes `review_key` in history results.
- A cancellation arriving during photo upload is followed by a server-side cancellation after the queued job ID becomes available.
- Cancelled jobs cannot be retried because their source photographs are deleted; failed jobs retain photos until cleanup.
- Worker completion and failure updates include `attempt_count` to prevent stale workers overwriting a subsequent retry. A stale worker cannot remove the newer attempt's photographs.

## Checks
- `npm test`: 268/268 passed.
- Supabase recognition queue has owner-scoped read-only access for authenticated users; server writes use the server-side key.
- The private storage bucket and atomic claim function were verified in the preceding release.

## Not verified
- Real provider recognition, photo benchmark, authenticated end-to-end browser journey, and Vercel deployment. These require a live preview environment, provider credentials and representative book photographs.
- This release does not guarantee defect-free behaviour across the entire application.

## Deployment
- Use the Vercel environment variables and schedule limitations described in `RECOGNITION_RC32_DEPLOYMENT.md`.
- Deploy first to Preview, verify login, Review, Inventory, AI recognition, cancellation, history, cron, and approval before promoting to production.
