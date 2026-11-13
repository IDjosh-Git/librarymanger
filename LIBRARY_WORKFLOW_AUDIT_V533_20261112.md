# Library Manager v5.33 — Workflow Audit & Review Image Deletion

Release date: 12 November 2026

## Scope of the audit

Reviewed the Scan → Review → Inventory lifecycle, cloud Review persistence and reconciliation, duplicate photo guard, batch saving, metadata display, cover replacement, progress-bar integration, and responsive Scan-page controls. All changes are based on the latest v5.32 release and retain existing AI, circulation, attendance and weekly feature code.

## Findings and corrections

1. **Misleading scan-to-review step.** Unidentified photos were already stored as pending Review records, but the Scan UI required a separate Save to Review action. The redundant action has been removed. Scan now shows two automatically populated tables: **Books with details** and **Books under review**.
2. **Overloaded Scan controls.** Primary actions are now Save all ready, Save selected, Select all ready, Clear selection, and Stop scanning (visible only while active). OCR, AI, auto-save and Retry are grouped under collapsed Scan settings. Extra upload controls remain available in a small disclosure; cloud sync is collapsed unless needed.
3. **Unresponsive Save buttons.** Saving is disabled when no matching eligible books exist. Save all ready is scoped to recognized Scan books and cannot silently include books already flagged for Review. Save selected is scoped to the selected recognized books. Row-level Save allows retry after a record-specific error.
4. **Ready-book details not visible.** The ready table shows Title, Author, ISBN, Publisher/Year, Shelf, selection, Save and Edit. It paginates after 30 rows, without losing selection across pages.
5. **Review list not easy to see/hide.** Both Scan tables now have independent, keyboard-accessible Show table / Hide table buttons, with state remembered on the current device. On narrow screens, the table itself scrolls horizontally inside its card rather than forcing the whole page to overflow.
6. **No way to discard a bad image in Review.** Added Delete image to unsaved Review cards. It confirms with the user, verifies the physical copy is not already in Inventory, marks the cloud Review record resolved, removes the local draft, and attempts to release the exact pending scan-image fingerprint. It does **not** delete a saved book or loan history.
7. **Deleted Review rows could reappear on a stale device.** Cloud restoration now fetches resolved tombstone keys separately, excludes those keys from browser drafts, and avoids downloading large thumbnail JSON for resolved records. The database's existing `library_review_guard_saved_copy` trigger prevents resolved records from being revived by later stale upserts.
8. **Cover replacement left stale upload markers.** A replacement receives pending status only after its Review backup succeeds; once confirmed, the former unsaved fingerprint is released. Interrupted sync is reported clearly to the user.
9. **Unfinished vs saved states.** The revised Scan summary distinguishes Ready, Under review and Saved this session. Saved records remain authoritative in Supabase; removing a Review image does not affect them.

## Verified workflow

- Select photos, a folder or a ZIP. Streaming recognition begins while subsequent photos are prepared; v5.31/v5.32 performance optimizations remain.
- Recognized books appear in Books with details. Review their catalogue fields, use Edit to correct an identified book, and save individually, by selection, or all ready.
- Unidentified books automatically appear in Books under review. Open Review for Auto-fill, photo replacement, manual corrections or Delete image.
- Book saves write unique physical-copy IDs to Supabase Inventory. Successful saves resolve their Review entries. If a save fails, the error stays with its row so it can be retried without intentionally creating an extra copy.
- Deleted unsaved Review rows are cloud-resolved before being removed from the local queue. Other devices exclude them on the next refresh.

## Tests and limitations

- `npm test`: **82 tests passed** (70 existing scanner, cloud, AI, inventory and upload recovery tests plus 12 targeted workflow/deletion tests).
- Browser layout smoke check on Scan UI at 320, 360, 390, 768, 1024 and 1440 px: no page-wide horizontal overflow; both Show/Hide controls responded.
- Populated workflow test: 35 ready titles + one unidentified cover, including 30-row pagination, correct counters, ready/review tables and Review Delete button, checked at 320, 390, 768 and 1440 px without page-wide overflow.
- Supabase was inspected **read-only**. Inventory, pending Review and upload states were confirmed. Existing resolved-tombstone trigger was found. **No live records were deleted or modified during the audit**.
- Tests use representative mocked images/records and a Chromium browser, not the original 117 book photos or authenticated physical mobile devices. No claim of production/real-photo end-to-end verification is made.
- **Not deployed:** This ZIP is ready for deployment to the existing Vercel app. A live deployment and testing with five real photographs, including an unclear one, are required before calling the production experience fully verified.

## Deployment and acceptance test

1. Back up the current live deployment and deploy **the complete v5.33 project**, preserving Vercel environment variables and current Supabase configuration. There is no required database migration for this release.
2. Sign in as a library administrator. Scan five cover images; verify the percentage moves, identified titles populate the ready table, and incomplete covers populate the under-review table.
3. Use each Show/Hide control. Select two ready books, save them, refresh Inventory and verify the exact title, author, ISBN and shelf; confirm no duplicate physical copies on retry.
4. Open Review. Replace one unclear photo, edit its title and save it. For a separate unwanted image, choose Delete image and confirm; refresh Review on another device and confirm it is absent. Verify existing Inventory books remain.
5. Try a 100+ image batch with an interrupted connection and repeat the upload; verify recovery, correct statuses, acceptable scanning speed, and no duplicate inventory entries.
