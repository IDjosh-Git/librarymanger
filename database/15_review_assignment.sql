-- v5.61: Optional team Review assignment. Non-destructive and independent of approval leases.
-- Install after 12_shared_admin_review_queue.sql and 14_review_approval_leases.sql.
CREATE TABLE IF NOT EXISTS public.library_review_assignments (
 review_key uuid PRIMARY KEY,
 assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 assigned_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 CONSTRAINT assignment_expiry_after_start CHECK (expires_at > assigned_at)
);
CREATE INDEX IF NOT EXISTS library_review_assignments_expiry_idx ON public.library_review_assignments(expires_at);
ALTER TABLE public.library_review_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_review_assignments FROM PUBLIC,anon,authenticated;
-- Claim the oldest pending unassigned record, or return the caller's existing claim.
CREATE OR REPLACE FUNCTION public.library_claim_next_review()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v_key uuid;
BEGIN
 IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.library_member_roles WHERE user_id=v_user AND role='admin') THEN
  RAISE EXCEPTION 'Administrator access required';
 END IF;
 -- Serialize assignment decisions while allowing ordinary reads and scans.
 PERFORM pg_advisory_xact_lock(81732, 1561);
 DELETE FROM public.library_review_assignments WHERE expires_at <= now()
   OR NOT EXISTS (SELECT 1 FROM public.library_review_queue q WHERE q.review_key=library_review_assignments.review_key AND q.status='pending');
 SELECT a.review_key INTO v_key FROM public.library_review_assignments a
 JOIN public.library_review_queue q ON q.review_key=a.review_key AND q.status='pending'
 WHERE a.assigned_to=v_user ORDER BY a.assigned_at LIMIT 1;
 IF v_key IS NOT NULL THEN RETURN v_key; END IF;
 SELECT q.review_key INTO v_key FROM public.library_review_queue q
 WHERE q.status='pending' AND NOT EXISTS (SELECT 1 FROM public.library_review_assignments a WHERE a.review_key=q.review_key)
 ORDER BY q.updated_at ASC,q.review_key ASC LIMIT 1;
 IF v_key IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.library_review_assignments(review_key,assigned_to,expires_at)
 VALUES(v_key,v_user,now()+interval '15 minutes');
 RETURN v_key;
END $$;
CREATE OR REPLACE FUNCTION public.library_renew_review_assignment(p_review_key uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.library_member_roles WHERE user_id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 UPDATE public.library_review_assignments SET expires_at=now()+interval '15 minutes'
 WHERE review_key=p_review_key AND assigned_to=auth.uid() AND expires_at>now()
 AND EXISTS(SELECT 1 FROM public.library_review_queue WHERE review_key=p_review_key AND status='pending');
 GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count=1;
END $$;
CREATE OR REPLACE FUNCTION public.library_release_review_assignment(p_review_key uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
 DELETE FROM public.library_review_assignments WHERE review_key=p_review_key AND assigned_to=auth.uid();
 GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count=1;
END $$;
CREATE OR REPLACE FUNCTION public.library_my_review_assignment()
RETURNS TABLE(review_key uuid, expires_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT a.review_key,a.expires_at FROM public.library_review_assignments a
 WHERE a.assigned_to=auth.uid() AND a.expires_at>now()
 AND EXISTS(SELECT 1 FROM public.library_member_roles r WHERE r.user_id=auth.uid() AND r.role='admin')
 AND EXISTS(SELECT 1 FROM public.library_review_queue q WHERE q.review_key=a.review_key AND q.status='pending')
 ORDER BY a.assigned_at LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.library_claim_next_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.library_renew_review_assignment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.library_release_review_assignment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.library_my_review_assignment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_claim_next_review() TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_renew_review_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_release_review_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_my_review_assignment() TO authenticated;

-- Defense in depth: Supabase projects may have direct anon EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.library_claim_next_review() FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_renew_review_assignment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_release_review_assignment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_my_review_assignment() FROM anon;
