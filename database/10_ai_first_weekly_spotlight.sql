-- Library Manager v5.38: prefer verified AI Book of the Week; manual and catalogue are safe fallbacks.
-- Apply after database/04_ai_weekly_spotlight.sql on existing installations.
-- Only public-safe bibliographic fields are returned; no inventory or borrower identifiers.
BEGIN;
CREATE OR REPLACE FUNCTION public.library_public_weekly_spotlight_v2()
RETURNS TABLE(
 title text, authors text, isbn text, description text, cover_url text, shelf text,
 published_at timestamptz, selection_source text, why_selected text, reading_hook text,
 ideal_for text, discussion_question text, week_start date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
WITH ai AS (
 SELECT w.title::text,w.authors::text,w.isbn::text,w.why_selected::text AS description,
 w.cover_url::text,w.shelf::text,w.selected_at AS published_at,w.selection_source::text,
 w.why_selected::text,w.reading_hook::text,w.ideal_for::text,w.discussion_question::text,w.week_start
 FROM public.library_ai_weekly_picks w
 WHERE w.week_start=date_trunc('week',now() AT TIME ZONE 'UTC')::date AND w.selection_source='ai'
), manual AS (
 SELECT f.title::text,f.authors::text,f.isbn::text,f.description::text,
 f.cover_url::text,f.shelf::text,f.published_at,'manual'::text,
 f.description::text AS why_selected,''::text AS reading_hook,''::text AS ideal_for,
 ''::text AS discussion_question,(date_trunc('week',now() AT TIME ZONE 'UTC')::date) AS week_start
 FROM public.library_featured_books f WHERE f.id=1 AND NOT EXISTS(SELECT 1 FROM ai)
), rotation AS (
 SELECT w.title::text,w.authors::text,w.isbn::text,w.why_selected::text AS description,
 w.cover_url::text,w.shelf::text,w.selected_at AS published_at,w.selection_source::text,
 w.why_selected::text,w.reading_hook::text,w.ideal_for::text,w.discussion_question::text,w.week_start
 FROM public.library_ai_weekly_picks w
 WHERE w.week_start=date_trunc('week',now() AT TIME ZONE 'UTC')::date
 AND w.selection_source='automatic' AND NOT EXISTS(SELECT 1 FROM ai) AND NOT EXISTS(SELECT 1 FROM manual)
), fallback AS (
 SELECT p.title::text,p.authors::text,p.isbn::text,p.description::text,
 p.cover_url::text,p.shelf::text,p.published_at,p.selection_source::text,
 p.description::text AS why_selected,''::text,''::text,''::text,
 date_trunc('week',now() AT TIME ZONE 'UTC')::date
 FROM public.library_public_featured_book() p
 WHERE NOT EXISTS(SELECT 1 FROM ai) AND NOT EXISTS(SELECT 1 FROM manual) AND NOT EXISTS(SELECT 1 FROM rotation)
)
SELECT * FROM ai UNION ALL SELECT * FROM manual UNION ALL SELECT * FROM rotation UNION ALL SELECT * FROM fallback;
$function$;
REVOKE ALL ON FUNCTION public.library_public_weekly_spotlight_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_public_weekly_spotlight_v2() TO anon, authenticated;
COMMIT;
