# Library Manager v5.51 — Resumable scans, independent Review approvals, recent scan history
**Release:** 13 November 2026

## 1. Scan recovery across network outages and refresh

- A new account-scoped IndexedDB journal stores the original selected image files or compressed ZIP, each photo's original `saveRecordId`, an ordered set of confirmed photo indexes, and Inventory/Review/skipped counts. The journal is committed before processing begins; insufficient browser storage cancels the new batch instead of falsely promising recovery.
- A network interruption does not reset the journal to 0%. The progress meter restores the previously confirmed count and resumes only unconfirmed photos after reconnection or when the user reloads/signs in on the **same device and browser profile**.
- Reconnection triggers a quick automatic retry followed by bounded backoff if the service remains unavailable. The user can also select **Resume scan**. New photo selection asks before discarding an interrupted batch.
- Cloud Inventory and Review are checked before retrying. A retained record ID can immediately reclaim its own interrupted photo lease (without the old ten-minute delay), but an unrelated copy/owner cannot use that fast recovery path. Previously saved physical copies are not inserted again.
- Pending scans are not represented as a completed 100% result; final history is recorded only after the required cloud confirmations succeed.
- A same-origin service worker caches static app-shell resources after a successful load, permitting best-effort reload when offline; cloud operations remain offline until connectivity returns. API/auth requests and account information are **not** cached by the service worker.

**Browser limitation:** Recovery depends on persistent site storage and the original selected files remaining available in that browser. Private/incognito sessions, browser data deletion, user clearing site data, storage eviction, disabled IndexedDB, or switching devices can prevent recovery. A cache cannot guarantee offline app startup before the service worker has installed successfully.

## 2. Review cards save independently

- Each **Approve & Save** submission uses an independent per-card job and button state; another book can be edited or approved while the first is saving.
- Long-running cloud saves no longer dim or lock the entire Review list. An individual error remains on that specific card, with edited fields preserved for retry.
- Double submission of the same card is ignored. Record IDs—not mutable list indices—bind each action to its original physical book. Cloud synchronization defers reordering while approvals are active.
- Original title-only approval (ISBN optional), publisher/shelf edits, mobile-friendly forms, and Supabase idempotent save lookup are preserved.

## 3. Recent completed scan history

- A compact **Last completed scan** card displays how many photos were checked and the final Inventory, Review, and skipped counts, with a completion timestamp.
- The card persists for **six hours** in the same user's local browser, or is replaced immediately when a new scan is started.
- Unfinished scans are shown separately in the **Resume scan** panel, never masquerading as completed.

## Validation

- **184 automated Node tests pass**, including original Scan, Review, Inventory, recognition, and access checks, plus new simulated IndexedDB refresh recovery, same-job claim recovery, six-hour expiry, independent concurrent Review saves, failed-save isolation, record-ID binding, and offline service-worker exclusion tests.
- Static browser responsive checks at **320, 390, 768, 1024, and 1440px** showed no horizontal overflow in the new Scan recovery/history panels. Visual preview is static; real authenticated browser/device behavior requires post-deployment acceptance testing.
- Inline application JavaScript, new JS modules and service worker pass syntax checking; original document/stylesheet parsing validated.
- No Supabase schema migration or production-data mutations are required. **The code is not deployed to Vercel.**

## Recommended deployment verification

1. Deploy the ZIP's root files to the existing `librarymanger` Vercel project over HTTPS.
2. On a signed-in device, select a small batch of known book covers. Disable connectivity after at least one is cloud-confirmed; confirm the Resume panel shows saved progress, reconnect, and check the remainder resumes without a new file selection.
3. Repeat with a refresh while offline after the service worker has had time to install; then reconnect. Ensure a recovered original photo is not saved twice.
4. Start two Review approvals concurrently. Confirm only each selected card enters its own Saving state; verify distinct Inventory record IDs and retry behavior for one deliberate failed request.
5. Complete a batch. Confirm the 6-hour history appears on the Scan page, persists through refresh, and is cleared when a new scan begins.
