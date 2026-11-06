# Library Manager — Advanced Tools, Cloud Sync and ISBN Review

Release: 6 November 2026

## What's improved

- **Premium Advanced Tools:** Four responsive cards for ISBN/AI metadata completion, cross-device review syncing, Excel export, and Excel/CSV import. Clear labels, refined gradients, dark-mode support, accessible focus states and reduced-motion styling.
- **Cross-device saved status:** The Inventory records in Supabase are authoritative. On refresh and return to Scan & Review, pending drafts are reconciled by each physical copy's **unique `record_id`**. Saved copies no longer reappear as unsaved on another device. Mobile can tap **Refresh from cloud**, and an open Scan & Review tab refreshes periodically while visible. User edits to genuinely unsaved drafts remain intact.
- **Stale cloud queue cleanup:** Confirmed already-saved records are removed from the remote Review queue. On 6 November 2026, three confirmed stale entries were cleaned from the connected DataLearning Supabase `library_review_queue`; the other 99 pending records were preserved. No library book was removed.
- **ISBN-driven details:** For untitled review items with a valid ISBN, the app searches verified book catalogues in the background; if a catalogue cannot identify the title and the AI recognition switch is enabled, it can try Gemini cover reading when the photo is available. It displays suggested details for review, **without automatically inserting a book**. Use Save All Ready Books or select the books to save.
- **Already-saved books without titles:** When a saved book has a valid ISBN, Find Title by ISBN can prepare a verified suggestion for the user to apply to that specific existing record. Applying updates a record only after Supabase confirms; the existing title is never overwritten. Missing optional details alone do not require attention.
- **Easy bulk actions:** Mark All Ready, Save All Ready Books, Save Selected, Select Duplicate Copies, and Clear Selection. An ISBN duplicate with a **different copy ID** remains a legitimate physical copy and is not silently removed.

## Deployment

Update the Library Manager repository on GitHub with `index.html` and `assets/library-ui.css`, then deploy on Vercel. No new environment variables or Supabase migrations are needed.

## Verification

- 72 existing Python regression tests passed.
- Existing JavaScript integration tests and a new cross-device/ISBN test passed.
- Advanced Tools were rendered at 320, 390, 768 and 1440px and in dark mode, without page-wide horizontal overflow.
- The real Supabase review queue was queried; its three stale rows were removed, and zero stale exact-ID matches remained afterward.

Cloud synchronization was validated by database checks and simulated browser-level logic; a final signed-in test on separate real devices is recommended after deployment. ISBN metadata accuracy depends on online catalogue availability and optional Gemini responses.
