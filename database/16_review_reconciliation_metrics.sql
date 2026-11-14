-- v5.62: Read-only server-side Review reconciliation metrics.
-- Does not modify existing Review or Inventory records.
CREATE OR REPLACE FUNCTION public.library_review_reconciliation_metrics()
RETURNS TABLE(pending_count bigint, missing_title_count bigint, stale_count bigint, unassigned_count bigint, duplicate_review_keys bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.library_member_roles WHERE user_id=auth.uid() AND role='admin') THEN
   RAISE EXCEPTION 'Administrator access required';
 END IF;
 RETURN QUERY
 SELECT
  count(*) FILTER (WHERE q.status='pending'),
  count(*) FILTER (WHERE q.status='pending' AND nullif(btrim(coalesce(q.data->>'title','')),'') IS NULL),
  count(*) FILTER (WHERE q.status='pending' AND q.updated_at < now()-interval '24 hours'),
  count(*) FILTER (WHERE q.status='pending' AND NOT EXISTS
     (SELECT 1 FROM public.library_review_assignments a WHERE a.review_key=q.review_key AND a.expires_at>now())),
  (SELECT count(*) FROM (SELECT review_key FROM public.library_review_queue GROUP BY review_key HAVING count(*)>1) d)
 FROM public.library_review_queue q;
END $$;
REVOKE ALL ON FUNCTION public.library_review_reconciliation_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.library_review_reconciliation_metrics() TO authenticated;
-- Explicitly deny anonymous RPC access to v5.61 assignment functions.
REVOKE EXECUTE ON FUNCTION public.library_claim_next_review() FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_renew_review_assignment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_release_review_assignment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_my_review_assignment() FROM anon;
