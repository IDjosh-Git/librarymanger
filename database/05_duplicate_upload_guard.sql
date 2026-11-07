-- Library Manager v5.20: exact file-content deduplication, including after books
-- leave Review and are saved to Inventory, across browsers and devices.
-- Apply AFTER database/01, /02, /03; non-destructive for existing books.
-- New uploads use full-file SHA-256. Previously saved uploads without a digest
-- cannot be retroactively recognized by content (the original images are not kept).
BEGIN;

ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS source_signature text;
CREATE UNIQUE INDEX IF NOT EXISTS library_books_source_signature_unique
  ON public.library_books (source_signature)
  WHERE source_signature IS NOT NULL AND source_signature <> '';

CREATE TABLE IF NOT EXISTS public.library_scan_files (
  fingerprint text PRIMARY KEY CHECK (fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','pending','saved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS library_scan_files_record_id_index
  ON public.library_scan_files (record_id);
CREATE INDEX IF NOT EXISTS library_scan_files_updated_index
  ON public.library_scan_files (status,updated_at);
ALTER TABLE public.library_scan_files ENABLE ROW LEVEL SECURITY;

-- Staff share a library inventory. Viewing hashes does not disclose image data.
DROP POLICY IF EXISTS library_scan_files_read ON public.library_scan_files;
CREATE POLICY library_scan_files_read ON public.library_scan_files
 FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS library_scan_files_insert ON public.library_scan_files;
CREATE POLICY library_scan_files_insert ON public.library_scan_files
 FOR INSERT TO authenticated WITH CHECK (uploaded_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS library_scan_files_update ON public.library_scan_files;
CREATE POLICY library_scan_files_update ON public.library_scan_files
 FOR UPDATE TO authenticated
 USING (uploaded_by = (SELECT auth.uid()))
 WITH CHECK (uploaded_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS library_scan_files_delete ON public.library_scan_files;
CREATE POLICY library_scan_files_delete ON public.library_scan_files
 FOR DELETE TO authenticated
 USING (uploaded_by = (SELECT auth.uid()) AND status IN ('processing','pending'));

GRANT SELECT,INSERT,UPDATE,DELETE ON public.library_scan_files TO authenticated;
REVOKE ALL ON public.library_scan_files FROM anon;
COMMIT;

-- Validation: both should return zero if this migration was applied correctly.
SELECT count(*) AS repeated_scan_digests FROM (
  SELECT fingerprint FROM public.library_scan_files GROUP BY fingerprint HAVING count(*)>1
) x;
SELECT count(*) AS repeated_saved_photo_digests FROM (
  SELECT source_signature FROM public.library_books WHERE source_signature IS NOT NULL
  GROUP BY source_signature HAVING count(*)>1
) x;
