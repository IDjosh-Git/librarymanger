# Library Manager v5.54 — Shared administrator Review queue (14 Nov 2026)

## Verified root cause

`library_review_queue` was designed as a **per-uploader** queue: SELECT and UPDATE row-level-security policies allowed only `auth.uid() = user_id`; the client queried `.eq('user_id', owner)`. As a result, each admin saw only their own uploads. The live database contained **92 pending Review records belonging to two administrator accounts** at the time of diagnosis, none of which were deleted.

## Changes

1. All authenticated **administrators** can SELECT pending Review rows from all uploader accounts and resolve/edit another admin's record. Members still only see their own permitted records. The original uploader's `user_id` is preserved; INSERT remains uploader-only.
2. The frontend loads pending records and resolved tombstones across all administrators. It carries `reviewOwnerId` through browser recovery and uses the same uploader key for updates, approvals and deletions. Foreign-owned rows are **updated**, never UPSERTed as the current admin. This prevents duplicate Review records and reactivation of resolved work.
3. A previously missed JavaScript scoping error in the cloud restore routine was fixed (`discardedKeys`, `cloudPendingKeys`), including a full-run restoration test covering 92 records whose historical `reviewStaged` flag was false.
4. Desktop Review navigation and mobile More-menu now show the shared **Pending** total; books already in Inventory but missing metadata are counted separately on the Review page. A compact 'Team scan' tag identifies a colleague's card.
5. Supabase upload-claim RLS permits verified administrators to reconcile a teammate's pending/processing scan marker upon successful approval/deletion, without changing uploader ownership.
6. Realtime listeners receive all administrators' Review changes, while focus, manual Refresh queue and the existing polling provide fallbacks.
7. Bumped CSS/script query versions and the service worker offline cache to 5.54.

## Supabase migration

`database/12_shared_admin_review_queue.sql` is included for reproducibility and repeatable deployment. The matching RLS changes were **already applied to the connected Supabase project** `hotysnqorkqbiconjskl` in this release session. Do not needlessly reapply to that project.

Verified from authenticated role simulation: two separate administrators each returned 92 pending rows from two uploader accounts; a non-admin could not see another user's Review rows. A cross-admin UPDATE was tested in a rolled-back transaction. No Inventory or Review content was modified by the checks.

## Testing and limitations

- Automated tests cover shared SELECT, member isolation, proper owner routing, cross-admin update rather than UPSERT, resolved-record safety, full 92-book restoration, count badge, and existing workflows.
- Deployment to Vercel was **not** performed. The live app will continue using any previously deployed owner-only UI until the new package is deployed.
- Tests use browser simulation and scoped SQL role tests rather than a physical multi-device browser session. Verify the deployed version by signing in as two administrators, using Review Refresh, approving one of the shared books and confirming both accounts see the updated count.
