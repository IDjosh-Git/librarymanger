-- Library Manager: one permanent, unique Book ID per physical copy.
-- Run in the SAME Supabase project as the library; safe for repeated execution.
-- Only rows with a missing/blank Book ID are backfilled; existing IDs are not changed.
BEGIN;
LOCK TABLE public.library_books IN ACCESS EXCLUSIVE MODE;

CREATE SEQUENCE IF NOT EXISTS public.library_book_id_seq
    AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE CACHE 1;
REVOKE ALL ON SEQUENCE public.library_book_id_seq FROM PUBLIC, anon;
GRANT USAGE ON SEQUENCE public.library_book_id_seq TO authenticated;

-- Never reuse an ID, including after deleting a book. Respect any pre-existing LIB-n IDs.
DO $setup$
DECLARE highest_id bigint;
        sequence_current bigint;
        sequence_called boolean;
BEGIN
    SELECT COALESCE(MAX(substring(book_id FROM '^LIB-([0-9]+)$')::bigint), 0)
      INTO highest_id FROM public.library_books;
    SELECT last_value, is_called INTO sequence_current, sequence_called
      FROM public.library_book_id_seq;
    PERFORM setval('public.library_book_id_seq'::regclass,
                   GREATEST(highest_id + 1,
                            sequence_current + CASE WHEN sequence_called THEN 1 ELSE 0 END,
                            1), false);
END;
$setup$;

CREATE OR REPLACE FUNCTION public.library_assign_book_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $body$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Ignore client-supplied IDs: server assigns the next number.
        NEW.book_id := 'LIB-' || lpad(nextval('public.library_book_id_seq'::regclass)::text, 6, '0');
    ELSIF OLD.book_id IS NULL OR btrim(OLD.book_id) = '' THEN
        -- Backfill previously scanned books, even when UPDATE sets NULL to NULL.
        NEW.book_id := 'LIB-' || lpad(nextval('public.library_book_id_seq'::regclass)::text, 6, '0');
    ELSIF NEW.book_id IS DISTINCT FROM OLD.book_id THEN
        RAISE EXCEPTION 'Book ID is permanent and cannot be modified'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.library_assign_book_id() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS library_books_assign_book_id ON public.library_books;
CREATE TRIGGER library_books_assign_book_id
    BEFORE INSERT OR UPDATE OF book_id ON public.library_books
    FOR EACH ROW EXECUTE FUNCTION public.library_assign_book_id();

-- Assign older copies IDs in their original scan order. No other fields are edited.
DO $backfill$
DECLARE existing_copy record;
BEGIN
    FOR existing_copy IN
        SELECT id FROM public.library_books
        WHERE book_id IS NULL OR btrim(book_id) = ''
        ORDER BY created_at NULLS LAST, id
    LOOP
        UPDATE public.library_books
        SET book_id = NULL
        WHERE id = existing_copy.id;
    END LOOP;
END;
$backfill$;

CREATE UNIQUE INDEX IF NOT EXISTS library_books_book_id_uidx
    ON public.library_books (book_id);
DO $required$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public.library_books'::regclass
                     AND conname = 'library_books_book_id_required') THEN
        ALTER TABLE public.library_books ADD CONSTRAINT library_books_book_id_required
            CHECK (book_id IS NOT NULL AND btrim(book_id) <> '') NOT VALID;
    END IF;
END;
$required$;
ALTER TABLE public.library_books VALIDATE CONSTRAINT library_books_book_id_required;
COMMIT;

-- Read-only verification; missing and duplicate counts should be zero.
SELECT count(*) AS total_books,
       count(*) FILTER (WHERE book_id IS NULL OR btrim(book_id) = '') AS missing_book_ids,
       count(*) - count(DISTINCT book_id) AS duplicate_book_ids,
       min(book_id) AS first_book_id, max(book_id) AS last_book_id
FROM public.library_books;
