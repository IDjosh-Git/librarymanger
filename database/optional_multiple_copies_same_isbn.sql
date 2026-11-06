-- Optional Supabase migration: one physical copy = one record_id/book_id.
-- Run ONLY if batch save returns SQLSTATE 23505 for a barcode/ISBN unique constraint.
-- Preserves uniqueness of book_id, record_id and primary keys.
BEGIN;
DO $migration$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid=con.conrelid
    JOIN pg_namespace ns ON ns.oid=rel.relnamespace
    WHERE ns.nspname='public' AND rel.relname='library_books'
      AND con.contype='u'
      AND EXISTS (SELECT 1 FROM unnest(con.conkey) AS col(attnum)
                  JOIN pg_attribute a ON a.attrelid=rel.oid AND a.attnum=col.attnum
                  WHERE a.attname='barcode')
  LOOP
    EXECUTE format('ALTER TABLE public.library_books DROP CONSTRAINT %I',item.conname);
    RAISE NOTICE 'Dropped ISBN/barcode uniqueness constraint %',item.conname;
  END LOOP;
  FOR item IN
    SELECT DISTINCT idx.relname AS index_name
    FROM pg_index ix
    JOIN pg_class tbl ON tbl.oid=ix.indrelid
    JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
    JOIN pg_class idx ON idx.oid=ix.indexrelid
    WHERE ns.nspname='public' AND tbl.relname='library_books'
      AND ix.indisunique AND NOT ix.indisprimary
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid=ix.indexrelid)
      AND EXISTS (SELECT 1 FROM unnest(ix.indkey::int2[]) AS col(attnum)
                  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attnum=col.attnum
                  WHERE a.attname='barcode')
  LOOP
    EXECUTE format('DROP INDEX public.%I',item.index_name);
    RAISE NOTICE 'Dropped ISBN/barcode unique index %',item.index_name;
  END LOOP;
END;
$migration$;
COMMIT;
