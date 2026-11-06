-- Library Manager: prevent completed physical copies from returning to Scan & Review.
-- Run after persistent_review_queue.sql and book_id_migration.sql.
-- The permanent record_id, NOT ISBN or title, establishes copy identity.
-- Non-destructive: books and loan history are never deleted.
BEGIN;

CREATE OR REPLACE FUNCTION public.library_review_guard_saved_copy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Resolve tombstones are permanent: old offline devices may not revive a removed
  -- review entry. A newer field edit wins over a stale browser snapshot.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'resolved' THEN
      NEW.status := 'resolved';
    END IF;
    IF COALESCE(NEW.data->>'reviewUpdatedAt','') ~ '^[0-9]{1,16}$'
       AND COALESCE(OLD.data->>'reviewUpdatedAt','') ~ '^[0-9]{1,16}$'
       AND (NEW.data->>'reviewUpdatedAt')::numeric < (OLD.data->>'reviewUpdatedAt')::numeric THEN
      NEW.data := OLD.data;
      NEW.updated_at := OLD.updated_at;
    END IF;
  END IF;
  -- A delayed/offline device may retry an upsert after another device saved the copy.
  -- Keep the draft for audit if necessary, but do not allow it back in the pending queue.
  IF EXISTS (
    SELECT 1 FROM public.library_books AS b
    WHERE b.record_id::text = NEW.review_key::text
  ) THEN
    NEW.status := 'resolved';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_review_guard_saved_copy ON public.library_review_queue;
CREATE TRIGGER library_review_guard_saved_copy
BEFORE INSERT OR UPDATE ON public.library_review_queue
FOR EACH ROW EXECUTE FUNCTION public.library_review_guard_saved_copy();

CREATE OR REPLACE FUNCTION public.library_resolve_review_on_book_save()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.library_review_queue AS q
     SET status = 'resolved', updated_at = now()
   WHERE q.review_key::text = NEW.record_id::text AND q.status = 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_resolve_review_on_book_save ON public.library_books;
CREATE TRIGGER library_resolve_review_on_book_save
AFTER INSERT ON public.library_books
FOR EACH ROW EXECUTE FUNCTION public.library_resolve_review_on_book_save();

-- Resolve old stale rows without affecting pending photographs with other copy IDs.
UPDATE public.library_review_queue AS q
   SET status = 'resolved', updated_at = now()
 WHERE status = 'pending'
   AND EXISTS (SELECT 1 FROM public.library_books AS b
               WHERE b.record_id::text = q.review_key::text);

REVOKE ALL ON FUNCTION public.library_review_guard_saved_copy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_resolve_review_on_book_save() FROM PUBLIC, anon, authenticated;
COMMIT;

-- Optional: enable fast device updates if this project uses Supabase Realtime.
-- Trigger protection above works even when Realtime is disabled; periodic refresh is fallback.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                   AND schemaname = 'public' AND tablename = 'library_books') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.library_books;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                   AND schemaname = 'public' AND tablename = 'library_review_queue') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.library_review_queue;
    END IF;
  END IF;
END;
$$;

-- Check: the count should be zero.
SELECT count(*) AS stale_pending_saved_copies
FROM public.library_review_queue q
JOIN public.library_books b ON b.record_id::text = q.review_key::text
WHERE q.status = 'pending';
