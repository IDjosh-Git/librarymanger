-- Library Manager v5.19: AI-assisted weekly feature, separate from private inventory.
-- Prerequisites: public.library_books, public.library_member_roles,
-- public.library_featured_books, public.library_public_featured_book().
-- Review in staging and back up the Supabase project before applying.
BEGIN;
CREATE TABLE IF NOT EXISTS public.library_ai_weekly_picks (
  week_start date PRIMARY KEY,
  inventory_record_id text NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  authors text NOT NULL DEFAULT '',
  isbn text NOT NULL DEFAULT '',
  why_selected text NOT NULL CHECK (length(why_selected) BETWEEN 30 AND 700),
  reading_hook text NOT NULL DEFAULT '',
  ideal_for text NOT NULL DEFAULT '',
  discussion_question text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  shelf text NOT NULL DEFAULT '',
  selection_source text NOT NULL CHECK (selection_source IN ('ai','automatic')),
  provider text NOT NULL DEFAULT '',
  selected_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.library_ai_weekly_picks IS 'Public-safe bibliographic snapshots chosen by AI or deterministic fallback, one per UTC week. Does not store borrower data.';

ALTER TABLE public.library_ai_weekly_picks ENABLE ROW LEVEL SECURITY;
-- Do not expose raw inventory identifiers or internal provider metadata to anonymous clients.
REVOKE ALL ON public.library_ai_weekly_picks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.library_ai_weekly_picks TO authenticated;
GRANT ALL ON public.library_ai_weekly_picks TO service_role;

DROP POLICY IF EXISTS library_ai_weekly_admin_read ON public.library_ai_weekly_picks;
CREATE POLICY library_ai_weekly_admin_read ON public.library_ai_weekly_picks
 FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.library_member_roles r WHERE r.user_id=(select auth.uid()) AND r.role='admin')
 );
DROP POLICY IF EXISTS library_ai_weekly_admin_insert ON public.library_ai_weekly_picks;
CREATE POLICY library_ai_weekly_admin_insert ON public.library_ai_weekly_picks
 FOR INSERT TO authenticated WITH CHECK (
  EXISTS(SELECT 1 FROM public.library_member_roles r WHERE r.user_id=(select auth.uid()) AND r.role='admin')
 );
DROP POLICY IF EXISTS library_ai_weekly_admin_update ON public.library_ai_weekly_picks;
CREATE POLICY library_ai_weekly_admin_update ON public.library_ai_weekly_picks
 FOR UPDATE TO authenticated
 USING (EXISTS(SELECT 1 FROM public.library_member_roles r WHERE r.user_id=(select auth.uid()) AND r.role='admin'))
 WITH CHECK (EXISTS(SELECT 1 FROM public.library_member_roles r WHERE r.user_id=(select auth.uid()) AND r.role='admin'));

-- Preserves the existing public featured-book contract and the manual override.
-- Returns ONLY public bibliographic data and the editorial reason; no internal IDs/loans.
CREATE OR REPLACE FUNCTION public.library_public_weekly_spotlight_v2()
RETURNS TABLE(
 title text, authors text, isbn text, description text, cover_url text, shelf text,
 published_at timestamptz, selection_source text, why_selected text, reading_hook text,
 ideal_for text, discussion_question text, week_start date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
WITH manual AS (
 SELECT f.title::text,f.authors::text,f.isbn::text,f.description::text,
 f.cover_url::text,f.shelf::text,f.published_at,'manual'::text,
 f.description::text AS why_selected,''::text AS reading_hook,''::text AS ideal_for,
 ''::text AS discussion_question,(date_trunc('week',f.published_at AT TIME ZONE 'UTC')::date) AS week_start
 FROM public.library_featured_books f WHERE f.id=1
), weekly AS (
 SELECT w.title::text,w.authors::text,w.isbn::text,w.why_selected::text AS description,
 w.cover_url::text,w.shelf::text,w.selected_at AS published_at,w.selection_source::text,
 w.why_selected::text,w.reading_hook::text,w.ideal_for::text,w.discussion_question::text,w.week_start
 FROM public.library_ai_weekly_picks w
 WHERE w.week_start=date_trunc('week',now() AT TIME ZONE 'UTC')::date
   AND NOT EXISTS(SELECT 1 FROM manual)
), fallback AS (
 SELECT p.title::text,p.authors::text,p.isbn::text,p.description::text,
 p.cover_url::text,p.shelf::text,p.published_at,p.selection_source::text,
 p.description::text AS why_selected,''::text,''::text,''::text,
 date_trunc('week',now() AT TIME ZONE 'UTC')::date
 FROM public.library_public_featured_book() p
 WHERE NOT EXISTS(SELECT 1 FROM manual) AND NOT EXISTS(SELECT 1 FROM weekly)
)
SELECT * FROM manual
UNION ALL SELECT * FROM weekly
UNION ALL SELECT * FROM fallback;
$function$;
REVOKE ALL ON FUNCTION public.library_public_weekly_spotlight_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_public_weekly_spotlight_v2() TO anon, authenticated;
COMMIT;

-- Read-only checks after applying:
-- SELECT week_start,title,selection_source FROM public.library_ai_weekly_picks ORDER BY week_start DESC LIMIT 2;
-- SELECT title,selection_source,why_selected,week_start FROM public.library_public_weekly_spotlight_v2();
-- SELECT tablename,policyname,roles,cmd FROM pg_policies WHERE tablename='library_ai_weekly_picks';
