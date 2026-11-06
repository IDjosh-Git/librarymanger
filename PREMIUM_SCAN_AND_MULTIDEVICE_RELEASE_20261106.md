# Library Manager 5.12.0 — Premium Scan & Review and multi-device consistency

## Installation (both steps are required)

1. Commit/deploy this build to **the existing Vercel project** (no API keys in source). The site must use the same Supabase project on Windows, mobile and other devices.
2. Open the **Supabase SQL Editor** for the connected project, and run `SCAN_CLOUD_CONSISTENCY_UPGRADE.sql` once. This assumes `library_books` and `library_review_queue` already exist, and that `persistent_review_queue.sql` has previously been installed. Back up your project before any database migration. The script creates idempotent triggers, resolves matching stale review rows, and enables Supabase Realtime for the two tables when supported.
3. In Vercel project environment variables, set `GEMINI_API_KEY` for Gemini image reading, ISBN suggestion fallback and the general research assistant. Optionally set `GEMINI_CHAT_MODEL` and `GEMINI_MODEL`. Redeploy to apply changes. Provider web grounding and quotas may depend on the model, region and plan.
4. Sign in with the intended account on each device; open **Scan & Review**, use **Refresh from cloud**, and verify that the **same `record_id`** saved on Windows is no longer pending on mobile. If the two devices independently scanned separate physical copies with different record IDs (even when they have the same ISBN), they are deliberately kept separate.

## New and refined behavior

- Premium scanning workbench with improved visual hierarchy, focus states, touch targets, clear review shortcuts, always-visible on-device OCR and AI cover reading, a stronger Advanced Tools toolkit and a direct **Research anything with AI** action.
- **Mark all ready**, **Save all ready books**, selected/duplicate-copy actions and a quick review search by ISBN, filename, author and shelf. **Automatic saving is off by default for fresh devices**, so you can review identified titles first. A prior per-device setting is respected.
- ISBN-first enrichment: verified book catalogues take priority. If they cannot match a valid ISBN and AI is enabled, the Gemini service may suggest title and edition details. Unverified AI suggestions are labelled, never presented as confirmed catalogue data, and must be reviewed before saving. Already-saved books with a missing title require clicking **Apply details to saved book** (and confirmation for AI-only guesses).
- Scan settings (AI/OCR/auto-save) and Advanced Tools disclosure preference stay **local to that device**; book inventory and review entries are synchronized through Supabase.
- Realtime notifications for inventory and the current account's review queue, refresh after focus/tab return, and a 30-second visible Scan & Review fallback. Saved record IDs are reconciled against the authoritative inventory.
- Database-side guard prevents saved records from returning to pending review after old/offline clients retry writes; resolved review tombstones cannot be revived. Out-of-order pending edits preserve the newer `reviewUpdatedAt` record.
- One consolidated main stylesheet (`assets/library-ui.css`); redundant original compatibility stylesheet includes are not loaded. Book Guide retains its separately maintained stylesheet. Existing non-scan styling is preserved to avoid breaking unrelated Inventory, Lending and Admin pages.

## Validation performed

- 72 Python regressions passed, all JavaScript `.cjs` tests passed including new premium scan checks.
- Browser checks for AI/OCR toggles and general Gemini chat/web-search UI passed at widths 320, 390, 768 and 1440px.
- Browser-based isolated Scan & Review layout checked light/dark themes at 320, 390, 768 and 1440px; no horizontal overflow.

## Important deployment limits

- The Supabase SQL migration has **not been run on your live project** from this workspace; the fix is not operational until you deploy code and execute the migration.
- Live multi-device sign-in, actual Supabase Realtime delivery, provider AI responses and real scanning/recognition **were not tested** against production services. Validate a book on both devices after deployment.
- Same ISBN alone never proves two scans represent the same physical copy. This avoids silently deleting legitimate duplicates.
- Browser OCR requires the Tesseract assets to load; AI research requires a configured server-side key and suitable provider quota. Search grounding is optional and may fail back to an answer without live sources.
- In-memory endpoint rate limits are not global across serverless instances; apply abuse protection for high-traffic public deployments.
