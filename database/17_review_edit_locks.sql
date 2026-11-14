-- v6.0 RC2: exclusive editing locks, separate from approval and assignment leases.
CREATE TABLE IF NOT EXISTS public.library_review_edit_locks (
 review_key uuid PRIMARY KEY,
 editor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 acquired_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '15 minutes')
);
ALTER TABLE public.library_review_edit_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_review_edit_locks FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.library_claim_review_edit(p_review_key uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
 IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.library_member_roles WHERE user_id=v_user AND role='admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.library_review_queue WHERE review_key=p_review_key AND status='pending') THEN RETURN false; END IF;
 INSERT INTO public.library_review_edit_locks(review_key,editor_id,expires_at)
 VALUES(p_review_key,v_user,now()+interval '15 minutes')
 ON CONFLICT(review_key) DO UPDATE SET editor_id=excluded.editor_id,acquired_at=now(),expires_at=excluded.expires_at
 WHERE library_review_edit_locks.editor_id=v_user OR library_review_edit_locks.expires_at<=now();
 RETURN EXISTS(SELECT 1 FROM public.library_review_edit_locks WHERE review_key=p_review_key AND editor_id=v_user AND expires_at>now());
END $$;
CREATE OR REPLACE FUNCTION public.library_renew_review_edit(p_review_key uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n int;
BEGIN
 UPDATE public.library_review_edit_locks SET expires_at=now()+interval '15 minutes'
 WHERE review_key=p_review_key AND editor_id=auth.uid() AND expires_at>now();
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;
END $$;
CREATE OR REPLACE FUNCTION public.library_release_review_edit(p_review_key uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n int;
BEGIN
 DELETE FROM public.library_review_edit_locks WHERE review_key=p_review_key AND editor_id=auth.uid();
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;
END $$;
-- Database-enforced guard: browser state alone is never sufficient.
CREATE OR REPLACE FUNCTION public.library_guard_review_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.status='pending' AND NEW.status='pending' AND NEW.data IS DISTINCT FROM OLD.data THEN
  IF NOT EXISTS(SELECT 1 FROM public.library_review_edit_locks l WHERE l.review_key=OLD.review_key AND l.editor_id=auth.uid() AND l.expires_at>now()) THEN
   RAISE EXCEPTION 'Review edit lock required or held by another administrator' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS library_review_edit_guard ON public.library_review_queue;
CREATE TRIGGER library_review_edit_guard BEFORE UPDATE ON public.library_review_queue FOR EACH ROW EXECUTE FUNCTION public.library_guard_review_edit();
REVOKE ALL ON FUNCTION public.library_claim_review_edit(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.library_renew_review_edit(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.library_release_review_edit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.library_claim_review_edit(uuid),public.library_renew_review_edit(uuid),public.library_release_review_edit(uuid) TO authenticated;
