-- REQUIRED: apply in Supabase SQL Editor after reviewing existing access policies.
-- Admin: dashboard, inventory, scans, notifications, history, imports & exports.
-- User: lending and returns only (with read access to book and loan records needed to operate).
-- Existing wide-open RLS policies on library_books/library_loans are REPLACED deliberately.
-- BACK UP your schema and test with separate accounts before production use.

BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS public.library_member_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.library_member_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_member_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.library_member_roles TO authenticated;
DO $$ DECLARE pol record; BEGIN
 FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='library_member_roles' LOOP
   EXECUTE format('DROP POLICY %I ON public.library_member_roles',pol.policyname);
 END LOOP;
END $$;
CREATE POLICY library_member_self_read ON public.library_member_roles FOR SELECT TO authenticated
 USING (user_id=(select auth.uid()));

-- New and existing accounts default to user. ADMIN ROLES MUST BE SET MANUALLY IN SQL EDITOR.
INSERT INTO public.library_member_roles(user_id,role)
 SELECT id,'user' FROM auth.users ON CONFLICT (user_id) DO NOTHING;
CREATE OR REPLACE FUNCTION private.library_assign_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.library_member_roles(user_id,role) VALUES(NEW.id,'user') ON CONFLICT(user_id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.library_assign_user_role() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS library_member_signup_role ON auth.users;
CREATE TRIGGER library_member_signup_role AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION private.library_assign_user_role();

CREATE OR REPLACE FUNCTION private.library_has_role(requested text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.library_member_roles
  WHERE user_id=(select auth.uid()) AND role=requested AND requested IN ('admin','user'));
$$;
REVOKE ALL ON FUNCTION private.library_has_role(text) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.library_has_role(text) TO authenticated;

-- Existing permissive policies are removed, otherwise PostgreSQL OR-combines
-- them with the new policies and the role restriction can be bypassed.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('library_books','library_loans') LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 END LOOP;
END $$;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_books,public.library_loans FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.library_books,public.library_loans TO authenticated;
CREATE POLICY library_books_staff_read ON public.library_books FOR SELECT TO authenticated
 USING (private.library_has_role('admin') OR private.library_has_role('user'));
CREATE POLICY library_books_admin_insert ON public.library_books FOR INSERT TO authenticated
 WITH CHECK (private.library_has_role('admin'));
CREATE POLICY library_books_staff_update ON public.library_books FOR UPDATE TO authenticated
 USING (private.library_has_role('admin') OR private.library_has_role('user'))
 WITH CHECK (private.library_has_role('admin') OR private.library_has_role('user'));
CREATE POLICY library_books_admin_delete ON public.library_books FOR DELETE TO authenticated
 USING (private.library_has_role('admin'));
CREATE POLICY library_loans_staff_read ON public.library_loans FOR SELECT TO authenticated
 USING (private.library_has_role('admin') OR private.library_has_role('user'));
CREATE POLICY library_loans_user_insert ON public.library_loans FOR INSERT TO authenticated
 WITH CHECK (private.library_has_role('user') AND user_id=(select auth.uid()) AND status='Borrowed');
CREATE POLICY library_loans_user_update ON public.library_loans FOR UPDATE TO authenticated
 USING (private.library_has_role('user') AND status='Borrowed')
 WITH CHECK (private.library_has_role('user') AND status='Returned');
-- Loan delete is intentionally unavailable in ordinary app accounts.

-- Column-safe circulation. A library user cannot silently edit titles, ISBNs,
-- prices, shelf assignments, identifiers, or other inventory fields using REST.
CREATE OR REPLACE FUNCTION private.library_book_write_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF private.library_has_role('admin') THEN
   IF NEW.book_status IS DISTINCT FROM OLD.book_status
    OR NEW.borrower_name IS DISTINCT FROM OLD.borrower_name
    OR NEW.date_borrowed IS DISTINCT FROM OLD.date_borrowed
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.return_date IS DISTINCT FROM OLD.return_date THEN
      RAISE EXCEPTION 'Circulation fields are reserved for user accounts';
   END IF;
 ELSIF private.library_has_role('user') THEN
   IF (to_jsonb(NEW) - ARRAY['book_status','borrower_name','date_borrowed','due_date','return_date','updated_at'])
      IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['book_status','borrower_name','date_borrowed','due_date','return_date','updated_at'])
   THEN RAISE EXCEPTION 'Library users may update circulation fields only'; END IF;
   IF NOT ((OLD.book_status='Available' AND NEW.book_status='Borrowed' AND nullif(NEW.borrower_name,'') IS NOT NULL AND NEW.due_date IS NOT NULL)
           OR (OLD.book_status='Borrowed' AND NEW.book_status='Available' AND NEW.borrower_name IS NULL AND NEW.due_date IS NULL))
   THEN RAISE EXCEPTION 'Invalid book circulation transition'; END IF;
 ELSE RAISE EXCEPTION 'Library role is required'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS library_book_write_guard ON public.library_books;
CREATE TRIGGER library_book_write_guard BEFORE UPDATE ON public.library_books
 FOR EACH ROW EXECUTE FUNCTION private.library_book_write_guard();

CREATE OR REPLACE FUNCTION private.library_loan_write_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NOT private.library_has_role('user') THEN
   RAISE EXCEPTION 'Only library users may record loans and returns';
 END IF;
 IF TG_OP='INSERT' THEN
   IF NOT EXISTS(SELECT 1 FROM public.library_books b WHERE b.record_id=NEW.book_record_id
      AND b.book_status='Borrowed' AND b.borrower_name=NEW.borrower_name) THEN
      RAISE EXCEPTION 'The book must be reserved before its loan can be recorded';
   END IF;
 ELSE
   IF OLD.status<>'Borrowed' OR NEW.status<>'Returned' OR NEW.return_date IS NULL
      OR (to_jsonb(NEW) - ARRAY['status','return_date','updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','return_date','updated_at']) THEN
      RAISE EXCEPTION 'Only active-loan returns may be recorded';
   END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS library_loan_write_guard ON public.library_loans;
CREATE TRIGGER library_loan_write_guard BEFORE INSERT OR UPDATE ON public.library_loans
 FOR EACH ROW EXECUTE FUNCTION private.library_loan_write_guard();

-- Scan review entries are restricted to admins, even though each row has an owner.
DO $$ DECLARE pol record; BEGIN
 IF to_regclass('public.library_review_queue') IS NOT NULL THEN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='library_review_queue' LOOP
    EXECUTE format('DROP POLICY %I ON public.library_review_queue',pol.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.library_review_queue ENABLE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON public.library_review_queue FROM PUBLIC,anon,authenticated';
  EXECUTE 'GRANT SELECT,INSERT,UPDATE,DELETE ON public.library_review_queue TO authenticated';
  EXECUTE 'CREATE POLICY library_review_admin_read ON public.library_review_queue FOR SELECT TO authenticated USING (private.library_has_role(''admin''))';
  EXECUTE 'CREATE POLICY library_review_admin_insert ON public.library_review_queue FOR INSERT TO authenticated WITH CHECK (private.library_has_role(''admin'') AND user_id=(select auth.uid()))';
  EXECUTE 'CREATE POLICY library_review_admin_update ON public.library_review_queue FOR UPDATE TO authenticated USING (private.library_has_role(''admin'') AND user_id=(select auth.uid())) WITH CHECK (private.library_has_role(''admin'') AND user_id=(select auth.uid()))';
  EXECUTE 'CREATE POLICY library_review_admin_delete ON public.library_review_queue FOR DELETE TO authenticated USING (private.library_has_role(''admin'') AND user_id=(select auth.uid()))';
 END IF;
END $$;
COMMIT;

-- IMPORTANT: After this script runs, PROMOTE your real administrator account
-- in Supabase SQL Editor. Replace the address, do NOT put it in browser code.
-- UPDATE public.library_member_roles SET role='admin'
-- WHERE user_id=(SELECT id FROM auth.users WHERE email='ADMIN_EMAIL_HERE');
-- SELECT user_id,role FROM public.library_member_roles;
