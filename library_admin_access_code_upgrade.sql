-- Library Manager: secure Admin/User self-service registration (one-time installation).
-- Prerequisite: public.library_member_roles exists and at least one trusted admin is assigned.
-- This migration does NOT change existing book, loan, or role RLS policies.
-- Apply the full file in Supabase SQL Editor. Then use the in-app admin panel
-- Account & access settings > Administrator registration code to generate a code.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.library_admin_access_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE private.library_admin_access_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.library_admin_access_config FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.library_admin_access_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS library_admin_access_attempt_lookup
  ON private.library_admin_access_attempts(user_id, attempted_at DESC);
ALTER TABLE private.library_admin_access_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.library_admin_access_attempts FROM PUBLIC, anon, authenticated;

-- Only an existing Admin can generate or rotate the code. Return plaintext once.
CREATE OR REPLACE FUNCTION public.library_rotate_admin_access_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_rotate$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_code text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.library_member_roles
      WHERE user_id = v_uid AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only an administrator can rotate the access code'
      USING ERRCODE = '42501';
  END IF;

  -- Two random UUIDs provide 244+ random bits without external extensions.
  v_code := replace(pg_catalog.gen_random_uuid()::text, '-', '')
         || replace(pg_catalog.gen_random_uuid()::text, '-', '');
  INSERT INTO private.library_admin_access_config (id, code_hash, rotated_by, created_at)
    VALUES (1, encode(pg_catalog.sha256(convert_to(v_code, 'UTF8')), 'hex'), v_uid, now())
    ON CONFLICT (id) DO UPDATE SET
      code_hash = EXCLUDED.code_hash,
      rotated_by = EXCLUDED.rotated_by,
      created_at = EXCLUDED.created_at;
  RETURN v_code;
END;
$admin_rotate$;

-- Authenticated, email-verified users can promote *only their own* account
-- when they provide the exact private code. Rate-limit failed attempts.
CREATE OR REPLACE FUNCTION public.library_claim_admin_access_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_claim$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_verified timestamptz;
  v_valid boolean := false;
  v_attempt_count bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT email_confirmed_at INTO v_verified
  FROM auth.users WHERE id = v_uid;
  IF v_verified IS NULL THEN RETURN false; END IF;

  SELECT count(*) INTO v_attempt_count
  FROM private.library_admin_access_attempts
  WHERE user_id = v_uid
    AND attempted_at > now() - interval '1 hour'
    AND succeeded = false;
  IF v_attempt_count >= 5 THEN RETURN false; END IF;

  IF p_code IS NOT NULL AND p_code ~ '^[0-9a-fA-F]{64}$' THEN
    SELECT EXISTS (
      SELECT 1 FROM private.library_admin_access_config
      WHERE id = 1
        AND code_hash = encode(pg_catalog.sha256(convert_to(lower(p_code), 'UTF8')), 'hex')
    ) INTO v_valid;
  END IF;

  INSERT INTO private.library_admin_access_attempts(user_id, succeeded)
    VALUES (v_uid, v_valid);

  IF NOT v_valid THEN RETURN false; END IF;

  INSERT INTO public.library_member_roles(user_id, role)
    VALUES (v_uid, 'admin')
    ON CONFLICT(user_id) DO UPDATE SET role = 'admin';
  RETURN true;
END;
$admin_claim$;

REVOKE ALL ON FUNCTION public.library_rotate_admin_access_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_claim_admin_access_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_rotate_admin_access_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_claim_admin_access_code(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
