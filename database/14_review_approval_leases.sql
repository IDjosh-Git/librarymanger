-- v5.60: Atomic, short-lived approval leases. Run after 02 and 12.
-- Existing data is untouched. Only authenticated administrators may acquire leases.
CREATE TABLE IF NOT EXISTS public.library_review_approval_leases (
  review_key uuid PRIMARY KEY,
  holder uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.library_review_approval_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_review_approval_leases FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.library_claim_review_approval(p_review_key uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v_claimed uuid;
BEGIN
 IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.library_member_roles WHERE user_id=v_user AND role='admin') THEN
   RAISE EXCEPTION 'Administrator access required';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.library_review_queue WHERE review_key=p_review_key AND status='pending') THEN RETURN false; END IF;
 INSERT INTO public.library_review_approval_leases(review_key,holder,expires_at)
 VALUES (p_review_key,v_user,now()+interval '5 minutes')
 ON CONFLICT (review_key) DO UPDATE SET holder=EXCLUDED.holder,expires_at=EXCLUDED.expires_at
 WHERE public.library_review_approval_leases.holder=v_user OR public.library_review_approval_leases.expires_at<now()
 RETURNING holder INTO v_claimed;
 RETURN v_claimed=v_user;
END $$;
CREATE OR REPLACE FUNCTION public.library_release_review_approval(p_review_key uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 DELETE FROM public.library_review_approval_leases WHERE review_key=p_review_key AND holder=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.library_claim_review_approval(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.library_release_review_approval(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_claim_review_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_release_review_approval(uuid) TO authenticated;
