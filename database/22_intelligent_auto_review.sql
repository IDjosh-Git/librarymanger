-- v6 strict Auto-Review. Disabled by default. No existing records are changed by installation.
CREATE TABLE IF NOT EXISTS public.library_auto_review_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK(id=1), enabled boolean NOT NULL DEFAULT false,
 max_batch integer NOT NULL DEFAULT 25 CHECK(max_batch BETWEEN 1 AND 100),
 updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.library_auto_review_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
ALTER TABLE public.library_auto_review_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_auto_review_settings FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.library_auto_review_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, review_key uuid, actor_id uuid,
 decision text NOT NULL, reasons text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS library_auto_review_audit_recent ON public.library_auto_review_audit(created_at DESC);
ALTER TABLE public.library_auto_review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_auto_review_audit FROM PUBLIC,anon,authenticated;
-- Only trusted server-side services may populate this evidence registry.
-- A client-provided JSON verified_metadata object alone is not proof.
CREATE TABLE IF NOT EXISTS public.library_auto_review_verified_sources (
 review_key uuid PRIMARY KEY, isbn text NOT NULL, title text NOT NULL,
 authors text NOT NULL, source text NOT NULL CHECK(source IN ('open_library','google_books','crossref')),
 verified_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.library_auto_review_verified_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_auto_review_verified_sources FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.library_auto_review_config(p_enabled boolean DEFAULT NULL, p_batch integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.library_auto_review_settings%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.library_member_roles WHERE user_id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_batch IS NOT NULL AND (p_batch<1 OR p_batch>100) THEN RAISE EXCEPTION 'Batch size must be 1 to 100'; END IF;
 IF p_enabled IS NOT NULL OR p_batch IS NOT NULL THEN
 UPDATE public.library_auto_review_settings SET enabled=coalesce(p_enabled,enabled),max_batch=coalesce(p_batch,max_batch),updated_by=auth.uid(),updated_at=now() WHERE id=1;
 END IF;
 SELECT * INTO s FROM public.library_auto_review_settings WHERE id=1;
 RETURN jsonb_build_object('enabled',s.enabled,'max_batch',s.max_batch,'updated_at',s.updated_at);
END $$;
-- Atomic transaction: rows are locked, checked, inserted into Inventory, then resolved.
-- Strictly requires independently verified bibliographic evidence in a structured provenance field.
CREATE OR REPLACE FUNCTION public.library_run_strict_auto_review(p_limit integer DEFAULT 25, p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; v_data jsonb; v_copy text; v_isbn text; v_source text; v_reasons text[];
 v_approved int:=0; v_flagged int:=0; v_seen int:=0; v_log jsonb:='[]'::jsonb; v_enabled boolean; v_max integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.library_member_roles WHERE user_id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Administrator required'; END IF;
 SELECT enabled,max_batch INTO v_enabled,v_max FROM public.library_auto_review_settings WHERE id=1;
 IF NOT p_dry_run AND NOT v_enabled THEN RAISE EXCEPTION 'Automatic approval is disabled. Enable it explicitly in administrator settings.'; END IF;
 IF p_limit<1 OR p_limit>v_max THEN RAISE EXCEPTION 'Batch limit outside configured range'; END IF;
 FOR r IN SELECT q.review_key,q.user_id,q.data FROM public.library_review_queue q
 WHERE q.status='pending' ORDER BY q.created_at,q.review_key LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  v_seen:=v_seen+1; v_data:=r.data; v_reasons:=ARRAY[]::text[];
  v_copy:=btrim(coalesce(v_data->>'saveRecordId',v_data->>'book_id',''));
  v_isbn:=regexp_replace(coalesce(v_data->>'barcode',''),'[^0-9Xx]','','g');
  v_source:=coalesce(v_data#>>'{verified_metadata,source}','');
  IF btrim(coalesce(v_data->>'title',''))='' THEN v_reasons:=array_append(v_reasons,'missing_title'); END IF;
  IF btrim(coalesce(v_data->>'authors',''))='' THEN v_reasons:=array_append(v_reasons,'missing_author'); END IF;
  IF btrim(coalesce(v_data->>'shelf',''))='' THEN v_reasons:=array_append(v_reasons,'missing_shelf'); END IF;
  IF v_copy='' THEN v_reasons:=array_append(v_reasons,'missing_copy_id'); END IF;
  IF length(v_isbn) NOT IN (10,13) THEN v_reasons:=array_append(v_reasons,'unverified_isbn'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.library_auto_review_verified_sources s
   WHERE s.review_key=r.review_key AND s.isbn=v_isbn
   AND lower(btrim(s.title))=lower(btrim(v_data->>'title'))
   AND lower(btrim(s.authors))=lower(btrim(v_data->>'authors'))) THEN
   v_reasons:=array_append(v_reasons,'no_server_verified_metadata');
  END IF;
  IF coalesce(v_data->>'duplicate','false') NOT IN ('false','','null') THEN v_reasons:=array_append(v_reasons,'duplicate_flag'); END IF;
  IF coalesce(v_data->>'error','')<>'' OR coalesce(v_data->>'saveError','')<>'' THEN v_reasons:=array_append(v_reasons,'scan_error'); END IF;
  IF coalesce(v_data->>'updateTargetId','')<>'' THEN v_reasons:=array_append(v_reasons,'existing_record_update'); END IF;
  IF EXISTS(SELECT 1 FROM public.library_review_edit_locks l WHERE l.review_key=r.review_key AND l.expires_at>now()) OR
     EXISTS(SELECT 1 FROM public.library_review_assignments a WHERE a.review_key=r.review_key AND a.expires_at>now()) THEN
     v_reasons:=array_append(v_reasons,'in_use_by_reviewer'); END IF;
  IF v_copy<>'' AND (EXISTS(SELECT 1 FROM public.library_books b WHERE b.record_id=v_copy OR b.book_id=v_copy)
      OR EXISTS(SELECT 1 FROM public.library_review_queue q WHERE q.review_key<>r.review_key AND q.status='pending' AND
          coalesce(q.data->>'saveRecordId',q.data->>'book_id','')=v_copy)) THEN
     v_reasons:=array_append(v_reasons,'duplicate_physical_copy_id'); END IF;
  IF cardinality(v_reasons)=0 THEN
    IF NOT p_dry_run THEN
      -- Serialize approval of identical physical-copy IDs across concurrent batches.
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_copy,0));
      IF EXISTS(SELECT 1 FROM public.library_books b WHERE b.record_id=v_copy OR b.book_id=v_copy) THEN
        v_reasons:=array_append(v_reasons,'duplicate_physical_copy_id');
      ELSE
        INSERT INTO public.library_books(user_id,record_id,book_id,barcode,title,authors,publisher,publication_year,shelf_location,subject,language,pages,lookup_status)
        VALUES(r.user_id,v_copy,v_copy,coalesce(v_data->>'barcode',''),v_data->>'title',v_data->>'authors',coalesce(v_data->>'publisher',''),coalesce(v_data->>'publication_year',''),v_data->>'shelf',coalesce(v_data->>'subject',''),coalesce(v_data->>'language',''),coalesce(v_data->>'pages',''),'auto_review_verified');
        UPDATE public.library_review_queue SET status='approved',data=jsonb_set(v_data,'{saved}','true'::jsonb,true),updated_at=now() WHERE review_key=r.review_key AND status='pending';
        v_approved:=v_approved+1;
      END IF;
    ELSE v_approved:=v_approved+1; END IF;
  END IF;
  IF cardinality(v_reasons)>0 THEN v_flagged:=v_flagged+1; END IF;
  v_log:=v_log||jsonb_build_array(jsonb_build_object('review_key',r.review_key,'decision',CASE WHEN cardinality(v_reasons)=0 THEN 'eligible' ELSE 'manual_review' END,'reasons',v_reasons));
  IF NOT p_dry_run THEN INSERT INTO public.library_auto_review_audit(review_key,actor_id,decision,reasons)
    VALUES(r.review_key,auth.uid(),CASE WHEN cardinality(v_reasons)=0 THEN 'auto_approved' ELSE 'manual_review' END,v_reasons); END IF;
 END LOOP;
 RETURN jsonb_build_object('dry_run',p_dry_run,'processed',v_seen,'eligible_or_approved',v_approved,'manual_review',v_flagged,'items',v_log);
END $$;
REVOKE ALL ON FUNCTION public.library_auto_review_config(boolean,integer),public.library_run_strict_auto_review(integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.library_auto_review_config(boolean,integer),public.library_run_strict_auto_review(integer,boolean) TO authenticated;
