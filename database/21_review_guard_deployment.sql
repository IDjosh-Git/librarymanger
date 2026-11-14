-- Deploy only after RC7 frontend is live and verified with two administrator accounts.
-- SECURITY DEFINER is necessary because clients cannot SELECT private lock rows.
CREATE OR REPLACE FUNCTION public.library_guard_review_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.status='pending' AND NEW.status='pending' AND NEW.data IS DISTINCT FROM OLD.data THEN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.library_review_edit_locks l
    WHERE l.review_key=OLD.review_key AND l.editor_id=auth.uid() AND l.expires_at>now()
  ) THEN
   RAISE EXCEPTION 'Review editing lock required or expired' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.library_guard_review_edit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS library_review_edit_guard ON public.library_review_queue;
CREATE TRIGGER library_review_edit_guard BEFORE UPDATE ON public.library_review_queue
 FOR EACH ROW EXECUTE FUNCTION public.library_guard_review_edit();
