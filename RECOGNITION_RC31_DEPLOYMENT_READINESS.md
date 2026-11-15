# RC31 — Recognition verification and deployment status

## Verified
- 260 automated tests pass.
- Multi-photo comparison accepts two or three distinct labelled photos, checks ISBN checksum, detects conflicting OCR values, and requires administrator confirmation before populating blank fields.
- Open Library matching now independently compares ISBN, title, author names when author records are accessible, and publication year when available. Disagreements are surfaced. A title match alone does **not** validate an edition or prove that every field is correct.
- Raw photo images are sent to configured image-recognition providers for processing but are not stored in `library_recognition_jobs`. Stored history includes metadata and evidence only.
- No automated inventory approval is enabled by this release.

## Deployment prerequisites and limitations
- Configure at least one server-side vision provider API key in Vercel; without one, photo AI returns HTTP 501.
- Deploy to the intended Vercel project with Supabase configuration and validate using administrator and member sessions.
- Existing recognition jobs are **browser-driven**, not durable server-side jobs. Closing the browser may interrupt recognition. The cancellation control aborts the active browser request, not a remote queued job.
- No calibrated statistical confidence probabilities are claimed. Field evidence indicates which photo contributed a value and whether it agrees with independent catalogue data.
- Real-photo OCR quality, live provider behavior, privacy/retention agreements and mobile browser interactions remain unverified. This is not a fully production-certified recognition pipeline.
