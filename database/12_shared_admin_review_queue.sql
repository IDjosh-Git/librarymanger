-- Library Manager v5.54: Team-shared Review queue for verified administrators.
-- Existing rows, original uploader ownership, and all Inventory/Loan data are preserved.
-- Administrators can read/edit/resolve their colleagues' pending Review rows;
-- non-admin members remain restricted to their own records.
-- No anonymous access; only the original uploader may INSERT/DELETE.

ALTER TABLE public.library_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Review owner select" ON public.library_review_queue;
DROP POLICY IF EXISTS "Review owner or administrator select" ON public.library_review_queue;
CREATE POLICY "Review owner or administrator select"
 ON public.library_review_queue FOR SELECT TO authenticated
 USING (
  user_id = (select auth.uid())
  OR EXISTS (
   SELECT 1 FROM public.library_member_roles AS access
   WHERE access.user_id = (select auth.uid()) AND access.role = 'admin'
  )
 );

DROP POLICY IF EXISTS "Review owner update" ON public.library_review_queue;
DROP POLICY IF EXISTS "Review owner or administrator update" ON public.library_review_queue;
CREATE POLICY "Review owner or administrator update"
 ON public.library_review_queue FOR UPDATE TO authenticated
 USING (
  user_id = (select auth.uid())
  OR EXISTS (
   SELECT 1 FROM public.library_member_roles AS access
   WHERE access.user_id = (select auth.uid()) AND access.role = 'admin'
  )
 )
 WITH CHECK (
  user_id = (select auth.uid())
  OR EXISTS (
   SELECT 1 FROM public.library_member_roles AS access
   WHERE access.user_id = (select auth.uid()) AND access.role = 'admin'
  )
 );

-- Preserve the existing owner-only INSERT and DELETE policies.
-- The frontend must use UPDATE for another admin's record, never UPSERT as itself.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_review_queue TO authenticated;

-- Team reviewers may also clear a teammate's unused upload fingerprint or mark
-- a successfully approved photo as saved. Keep the original uploader column.
DROP POLICY IF EXISTS "library_scan_files_update" ON public.library_scan_files;
CREATE POLICY "library_scan_files_update" ON public.library_scan_files
 FOR UPDATE TO authenticated
 USING (
  uploaded_by=(select auth.uid()) OR EXISTS (
   SELECT 1 FROM public.library_member_roles AS access
   WHERE access.user_id=(select auth.uid()) AND access.role='admin'
  )
 )
 WITH CHECK (
  uploaded_by=(select auth.uid()) OR EXISTS (
   SELECT 1 FROM public.library_member_roles AS access
   WHERE access.user_id=(select auth.uid()) AND access.role='admin'
  )
 );

DROP POLICY IF EXISTS "library_scan_files_delete" ON public.library_scan_files;
CREATE POLICY "library_scan_files_delete" ON public.library_scan_files
 FOR DELETE TO authenticated
 USING (
  status IN ('processing','pending') AND (
   uploaded_by=(select auth.uid()) OR EXISTS (
    SELECT 1 FROM public.library_member_roles AS access
    WHERE access.user_id=(select auth.uid()) AND access.role='admin'
   )
  )
 );
