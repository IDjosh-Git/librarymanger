-- RC7: atomic delivery claims, retry recovery, safe admin reporting.
ALTER TABLE public.library_notification_outbox ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
CREATE OR REPLACE FUNCTION public.library_claim_notification_batch(p_limit integer DEFAULT 20)
RETURNS SETOF public.library_notification_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
 RETURN QUERY WITH candidates AS (
  SELECT id FROM public.library_notification_outbox
  WHERE ((state IN ('pending','failed') AND next_attempt_at<=now()) OR (state='processing' AND claimed_at<now()-interval '15 minutes'))
    AND attempts < 8
  ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),50)
 ) UPDATE public.library_notification_outbox o
 SET state='processing',attempts=o.attempts+1,claimed_at=now()
 FROM candidates c WHERE o.id=c.id RETURNING o.*;
END $$;
REVOKE ALL ON FUNCTION public.library_claim_notification_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_claim_notification_batch(integer) TO service_role;
CREATE OR REPLACE FUNCTION public.library_enqueue_daily_management_report(p_day date DEFAULT current_date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
 INSERT INTO public.library_notification_outbox(event_key,kind,payload)
 VALUES('management:'||p_day::text,'weekly_report',jsonb_build_object(
 'report_date',p_day,'inventory',(SELECT count(*) FROM public.library_books),
 'pending_review',(SELECT count(*) FROM public.library_review_queue WHERE status='pending'),
 'open_loans',(SELECT count(*) FROM public.library_loans WHERE return_date IS NULL),
 'overdue_loans',(SELECT count(*) FROM public.library_loans WHERE return_date IS NULL AND due_date<p_day),
 'waiting_reservations',(SELECT count(*) FROM public.library_reservations WHERE status='waiting')))
 ON CONFLICT(event_key) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.library_enqueue_daily_management_report(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_enqueue_daily_management_report(date) TO service_role;
