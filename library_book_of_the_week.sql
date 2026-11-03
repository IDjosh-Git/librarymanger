-- Library Manager: public Book of the Week advert, securely selected by admins.
-- Run once in your existing Supabase project SQL Editor. Requires
-- public.library_member_roles from the existing role migration.
-- This migration does not change existing books, loans, or review records.
BEGIN;
CREATE TABLE IF NOT EXISTS public.library_featured_books (
  id smallint PRIMARY KEY CHECK (id = 1),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 350),
  authors text NOT NULL DEFAULT 'Unknown author',
  isbn text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  shelf text NOT NULL DEFAULT '',
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.library_featured_books ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_featured_books FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, title, authors, isbn, description, cover_url, shelf, published_at)
 ON public.library_featured_books TO anon, authenticated;
GRANT INSERT, UPDATE ON public.library_featured_books TO authenticated;
-- The public may read only this curated book recommendation, never inventory,
-- private loan records, email addresses or the administrator role table.
DROP POLICY IF EXISTS library_featured_books_public_read ON public.library_featured_books;
CREATE POLICY library_featured_books_public_read ON public.library_featured_books
 FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS library_featured_books_admin_insert ON public.library_featured_books;
CREATE POLICY library_featured_books_admin_insert ON public.library_featured_books
 FOR INSERT TO authenticated
 WITH CHECK (id=1 AND published_by=(SELECT auth.uid())
   AND EXISTS (SELECT 1 FROM public.library_member_roles r
               WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin'));
DROP POLICY IF EXISTS library_featured_books_admin_update ON public.library_featured_books;
CREATE POLICY library_featured_books_admin_update ON public.library_featured_books
 FOR UPDATE TO authenticated
 USING (id=1 AND EXISTS (SELECT 1 FROM public.library_member_roles r
                          WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin'))
 WITH CHECK (id=1 AND published_by=(SELECT auth.uid())
   AND EXISTS (SELECT 1 FROM public.library_member_roles r
               WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin'));
COMMIT;
-- Verification in Supabase SQL Editor (read-only):
-- SELECT to_regclass('public.library_featured_books') AS spotlight_table;
-- SELECT policyname,cmd,roles FROM pg_policies WHERE schemaname='public' AND tablename='library_featured_books';
