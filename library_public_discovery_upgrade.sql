-- Library Manager public discovery upgrade, 3 November 2026.
-- RUN ONCE IN SUPABASE SQL EDITOR after library_roles_and_circulation.sql
-- and library_book_of_the_week.sql (back up your project first).
-- This is additive; it does not change inventory, loans, review records or existing book policies.
-- Public callers only receive a small, explicitly listed set of book metadata.
BEGIN;

-- A one-row public contact directory, editable only by verified database administrators.
CREATE TABLE IF NOT EXISTS public.library_public_contact (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  library_name text NOT NULL DEFAULT '' CHECK (length(library_name)<=120),
  email text NOT NULL DEFAULT '' CHECK (length(email)<=250),
  phone text NOT NULL DEFAULT '' CHECK (length(phone)<=40),
  location text NOT NULL DEFAULT '' CHECK (length(location)<=180),
  hours text NOT NULL DEFAULT '' CHECK (length(hours)<=180),
  website text NOT NULL DEFAULT '' CHECK (length(website)<=450),
  whatsapp text NOT NULL DEFAULT '' CHECK (length(whatsapp)<=450),
  facebook text NOT NULL DEFAULT '' CHECK (length(facebook)<=450),
  instagram text NOT NULL DEFAULT '' CHECK (length(instagram)<=450),
  youtube text NOT NULL DEFAULT '' CHECK (length(youtube)<=450),
  tiktok text NOT NULL DEFAULT '' CHECK (length(tiktok)<=450),
  x_url text NOT NULL DEFAULT '' CHECK (length(x_url)<=450),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.library_public_contact ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_public_contact FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,library_name,email,phone,location,hours,website,whatsapp,facebook,instagram,youtube,tiktok,x_url)
  ON public.library_public_contact TO anon, authenticated;
GRANT INSERT, UPDATE ON public.library_public_contact TO authenticated;
DROP POLICY IF EXISTS library_contact_public_read ON public.library_public_contact;
CREATE POLICY library_contact_public_read ON public.library_public_contact
  FOR SELECT TO anon,authenticated USING (id=1);
DROP POLICY IF EXISTS library_contact_admin_insert ON public.library_public_contact;
CREATE POLICY library_contact_admin_insert ON public.library_public_contact
  FOR INSERT TO authenticated WITH CHECK (
    id=1 AND updated_by=(SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.library_member_roles r
      WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin'
    )
  );
DROP POLICY IF EXISTS library_contact_admin_update ON public.library_public_contact;
CREATE POLICY library_contact_admin_update ON public.library_public_contact
  FOR UPDATE TO authenticated USING (
    id=1 AND EXISTS (SELECT 1 FROM public.library_member_roles r
      WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin')
  ) WITH CHECK (
    id=1 AND updated_by=(SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.library_member_roles r
      WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin'
    )
  );

-- Permit a verified administrator to clear a manual feature to restore weekly rotation.
-- Existing Admin-only INSERT/UPDATE policies remain unchanged.
GRANT DELETE ON public.library_featured_books TO authenticated;
DROP POLICY IF EXISTS library_featured_books_admin_delete ON public.library_featured_books;
CREATE POLICY library_featured_books_admin_delete ON public.library_featured_books
  FOR DELETE TO authenticated USING (
    id=1 AND EXISTS (SELECT 1 FROM public.library_member_roles r
      WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin')
  );

-- Public, read-only recommendation endpoint. SECURITY DEFINER is used deliberately
-- to READ FROM private-inventory RLS, never to write it. It returns only whitelisted
-- bibliographic fields, never borrower, loan, account, contact or internal IDs.
-- The automatic candidate is stable for the ISO week and rotates as the week changes.
-- Manual admin selection takes precedence until an admin clears it.
CREATE OR REPLACE FUNCTION public.library_public_featured_book()
RETURNS TABLE (
 title text, authors text, isbn text, description text, cover_url text,
 shelf text, published_at timestamptz, selection_source text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $featured$
 WITH manual AS (
  SELECT f.title, f.authors, f.isbn, f.description, f.cover_url,
    f.shelf, f.published_at, 'manual'::text AS selection_source
  FROM public.library_featured_books f WHERE f.id=1
 ), candidate AS (
  SELECT b.title,
    COALESCE(NULLIF(b.authors,''),'Unknown author') AS authors,
    COALESCE(b.barcode,'') AS raw_isbn,
    COALESCE(b.shelf_location,'') AS shelf,
    COALESCE(NULLIF((to_jsonb(b)->>'subject'),''),'') AS subject
  FROM public.library_books b
  WHERE nullif(btrim(coalesce(b.title,'')),'') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM manual)
  ORDER BY md5(coalesce(b.record_id::text,'') ||
    to_char(now() AT TIME ZONE 'UTC','IYYY-IW')) ASC
  LIMIT 1
 ), automatic AS (
  SELECT c.title::text,
    c.authors::text,
    CASE WHEN regexp_replace(c.raw_isbn,'[^0-9Xx]','','g') ~
        '^(97[89][0-9]{10}|[0-9]{9}[0-9Xx])$'
      THEN upper(regexp_replace(c.raw_isbn,'[^0-9Xx]','','g')) ELSE '' END AS isbn,
    CASE WHEN c.subject<>'' THEN left('Explore ' || c.subject || '. A featured title from our library collection.',500)
      ELSE 'Discover this weekly pick from our library collection. Ask the team about its availability.' END AS description,
    ''::text AS cover_url,
    c.shelf::text,
    date_trunc('week',now()) AS published_at,
    'automatic'::text AS selection_source
  FROM candidate c
 )
 SELECT m.title,m.authors,m.isbn,m.description,m.cover_url,m.shelf,m.published_at,m.selection_source FROM manual m
 UNION ALL
 SELECT a.title,a.authors,a.isbn,a.description,
    CASE WHEN a.isbn<>'' THEN 'https://covers.openlibrary.org/b/isbn/' || a.isbn || '-L.jpg?default=false'
      ELSE '' END AS cover_url,
    a.shelf,a.published_at,a.selection_source
 FROM automatic a;
$featured$;
REVOKE ALL ON FUNCTION public.library_public_featured_book() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_public_featured_book() TO anon,authenticated;

COMMIT;

-- Read-only verification (execute separately):
-- SELECT to_regclass('public.library_public_contact') AS contact_table;
-- SELECT * FROM public.library_public_featured_book();
-- SELECT policyname,cmd,roles FROM pg_policies
--   WHERE schemaname='public' AND tablename IN ('library_public_contact','library_featured_books');
