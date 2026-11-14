-- v6 RC3: additive, non-destructive operational automation foundation.
-- Apply only after validating existing application roles and loan flows.
CREATE TABLE IF NOT EXISTS public.library_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_user_id uuid NOT NULL REFERENCES auth.users(id),
 book_record_id text NOT NULL, status text NOT NULL DEFAULT 'waiting'
 CHECK(status IN ('waiting','notified','fulfilled','cancelled','expired')),
 created_at timestamptz NOT NULL DEFAULT now(), notified_at timestamptz,
 fulfilled_at timestamptz,
 UNIQUE(member_user_id,book_record_id,status)
);
CREATE INDEX IF NOT EXISTS library_reservations_waitlist_idx ON public.library_reservations(book_record_id,created_at) WHERE status='waiting';
ALTER TABLE public.library_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_reservations FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.library_reservations TO authenticated;
DROP POLICY IF EXISTS reservations_read_own ON public.library_reservations;
CREATE POLICY reservations_read_own ON public.library_reservations FOR SELECT TO authenticated USING(member_user_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.library_member_roles WHERE user_id=(SELECT auth.uid()) AND role='admin'));
DROP POLICY IF EXISTS reservations_create_own ON public.library_reservations;
CREATE POLICY reservations_create_own ON public.library_reservations FOR INSERT TO authenticated WITH CHECK(member_user_id=(SELECT auth.uid()) AND status='waiting' AND btrim(book_record_id)<>'');
DROP POLICY IF EXISTS reservations_cancel_own ON public.library_reservations;
CREATE POLICY reservations_cancel_own ON public.library_reservations FOR UPDATE TO authenticated USING(member_user_id=(SELECT auth.uid()) AND status='waiting') WITH CHECK(member_user_id=(SELECT auth.uid()) AND status IN ('waiting','cancelled'));

CREATE TABLE IF NOT EXISTS public.library_notification_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_key text NOT NULL UNIQUE, recipient_user_id uuid REFERENCES auth.users(id),
 kind text NOT NULL CHECK(kind IN ('due_soon','overdue','reservation_available','weekly_report','system_alert')),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','sent','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
 last_error text
);
CREATE INDEX IF NOT EXISTS library_outbox_pending_idx ON public.library_notification_outbox(next_attempt_at) WHERE state IN ('pending','failed');
ALTER TABLE public.library_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_notification_outbox FROM PUBLIC,anon,authenticated;

-- The following function queues notices; it DOES NOT send emails or SMS.
CREATE OR REPLACE FUNCTION public.library_queue_due_notices(p_today date DEFAULT current_date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.library_member_roles WHERE user_id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
 INSERT INTO public.library_notification_outbox(event_key,recipient_user_id,kind,payload)
 SELECT 'loan:'||l.id::text||':'||p_today::text||':'||(CASE WHEN l.due_date<p_today THEN 'overdue' ELSE 'due_soon' END),
 l.user_id, CASE WHEN l.due_date<p_today THEN 'overdue' ELSE 'due_soon' END,
 jsonb_build_object('loan_id',l.id,'title',l.book_title,'due_date',l.due_date)
 FROM public.library_loans l WHERE l.return_date IS NULL AND l.due_date IS NOT NULL AND l.user_id IS NOT NULL
 AND l.due_date<=p_today+3
 ON CONFLICT(event_key) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.library_queue_due_notices(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.library_queue_due_notices(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.library_admin_operations_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.library_member_roles WHERE user_id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
 RETURN jsonb_build_object(
 'inventory_total',(SELECT count(*) FROM public.library_books),
 'pending_review',(SELECT count(*) FROM public.library_review_queue WHERE status='pending'),
 'open_loans',(SELECT count(*) FROM public.library_loans WHERE return_date IS NULL),
 'overdue_loans',(SELECT count(*) FROM public.library_loans WHERE return_date IS NULL AND due_date<current_date),
 'waiting_reservations',(SELECT count(*) FROM public.library_reservations WHERE status='waiting'),
 'pending_notifications',(SELECT count(*) FROM public.library_notification_outbox WHERE state IN ('pending','failed')),
 'weekly_spotlight_current',(SELECT count(*) FROM public.library_ai_weekly_picks WHERE week_start=date_trunc('week',now())::date)
 );
END $$;
REVOKE ALL ON FUNCTION public.library_admin_operations_snapshot() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.library_admin_operations_snapshot() TO authenticated;
