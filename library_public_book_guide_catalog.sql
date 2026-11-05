-- Library Manager: Public Book Guide catalogue (metadata only), November 2026.
-- Run in the same Supabase project as Library Manager. Additive and read-only.
-- The library explicitly publishes title/author/edition/shelf metadata for discovery;
-- personal, borrower, loan, account, and internal book IDs are never returned.
BEGIN;
CREATE OR REPLACE FUNCTION public.library_public_guide_books(
 p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000
)
RETURNS TABLE (
 title text, authors text, isbn text, shelf text, publisher text,
 year text, subject text, pages text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $guide$
 WITH catalogue AS (
  SELECT DISTINCT ON (lower(btrim(b.title)), lower(btrim(coalesce(b.authors,''))), lower(btrim(coalesce(b.barcode,''))))
   left(btrim(b.title),350)::text AS title,
   left(btrim(coalesce(b.authors,'')),350)::text AS authors,
   CASE WHEN regexp_replace(coalesce(b.barcode,''),'[^0-9Xx]','','g') ~ '^(97[89][0-9]{10}|[0-9]{9}[0-9Xx])$'
     THEN upper(regexp_replace(b.barcode,'[^0-9Xx]','','g')) ELSE '' END::text AS isbn,
   left(btrim(coalesce(b.shelf_location,'')),250)::text AS shelf,
   left(btrim(coalesce(b.publisher,'')),250)::text AS publisher,
   left(btrim(coalesce(b.publication_year,'')),50)::text AS year,
   left(btrim(coalesce(b.subject,'')),350)::text AS subject,
   left(btrim(coalesce(b.pages,'')),40)::text AS pages
  FROM public.library_books b
  WHERE nullif(btrim(coalesce(b.title,'')),'') IS NOT NULL
  ORDER BY lower(btrim(b.title)),lower(btrim(coalesce(b.authors,''))),
           lower(btrim(coalesce(b.barcode,''))),b.record_id
 )
 SELECT c.title,c.authors,c.isbn,c.shelf,c.publisher,c.year,c.subject,c.pages
 FROM catalogue c
 ORDER BY lower(c.title),lower(c.authors),c.isbn
 LIMIT least(greatest(coalesce(p_limit,1000),1),1000)
 OFFSET least(greatest(coalesce(p_offset,0),0),20000);
$guide$;
REVOKE ALL ON FUNCTION public.library_public_guide_books(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.library_public_guide_books(integer,integer) TO anon,authenticated;
COMMENT ON FUNCTION public.library_public_guide_books(integer,integer) IS
 'Read-only public titles and book metadata for Book Guide. Excludes readers, accounts, circulation, and internal IDs.';
COMMIT;
