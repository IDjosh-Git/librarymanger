-- OPTIONAL, only needed if Supabase reports a NOT NULL constraint on barcode.
-- Book title pages can identify works without providing a visible ISBN.
-- Review the existing column constraints in your Supabase SQL Editor before running.
-- This does NOT alter book_id or record_id, nor remove any unique copy identifier.
BEGIN;
ALTER TABLE public.library_books ALTER COLUMN barcode DROP NOT NULL;
COMMIT;
-- If another CHECK constraint explicitly requires a nonblank barcode, inspect that
-- constraint separately rather than dropping it blindly.
