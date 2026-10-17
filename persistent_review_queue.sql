-- Library Manager v5.3 - Persistent Needs Attention / review queue
-- Non-destructive: existing library_books and loans are unchanged.
-- Review rows belong to the authenticated account that scanned/imported them.
CREATE TABLE IF NOT EXISTS public.library_review_queue (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_key uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, review_key),
  CONSTRAINT review_queue_data_object CHECK (jsonb_typeof(data)='object')
);
CREATE INDEX IF NOT EXISTS library_review_queue_owner_status_idx
 ON public.library_review_queue(user_id,status,updated_at DESC);
ALTER TABLE public.library_review_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_review_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.library_review_queue TO authenticated;
DROP POLICY IF EXISTS "Review owner select" ON public.library_review_queue;
CREATE POLICY "Review owner select" ON public.library_review_queue
 FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Review owner insert" ON public.library_review_queue;
CREATE POLICY "Review owner insert" ON public.library_review_queue
 FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Review owner update" ON public.library_review_queue;
CREATE POLICY "Review owner update" ON public.library_review_queue
 FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
 WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Review owner delete" ON public.library_review_queue;
CREATE POLICY "Review owner delete" ON public.library_review_queue
 FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
