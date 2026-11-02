-- ONE-TIME UPGRADE for Library Manager role setup.
-- Prerequisite: library_roles_and_circulation.sql already installed and at
-- least one trusted administrator was assigned. Review and back up before use.
-- No client-side secret, service-role key or public self-appointment is used.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.library_admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id),
  CONSTRAINT admin_invite_email_normalized CHECK (invited_email = lower(btrim(invited_email)))
);
ALTER TABLE private.library_admin_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.library_admin_invitations FROM PUBLIC, anon, authenticated;

-- Authenticated administrators can create a private, email-bound, one-time code.
-- Only a hash is persisted, and the plaintext code is returned once to creator.
CREATE OR REPLACE FUNCTION public.library_create_admin_invite(p_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_code text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.library_member_roles
    WHERE user_id=v_uid AND role='admin'
  ) THEN
    RAISE EXCEPTION 'Only an administrator can create invitations' USING ERRCODE='42501';
  END IF;
  IF length(v_email)>254 OR length(v_email)<5 OR
    v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid administrator email address';
  END IF;
  IF (SELECT count(*) FROM private.library_admin_invitations
      WHERE created_by=v_uid AND created_at>now()-interval '1 hour')>=20 THEN
    RAISE EXCEPTION 'Too many invitations. Try again later';
  END IF;
  -- A replacement invalidates any earlier unredeemed invitation for this email.
  UPDATE private.library_admin_invitations SET expires_at=now()
   WHERE invited_email=v_email AND used_at IS NULL AND expires_at>now();
  v_code := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  INSERT INTO private.library_admin_invitations(invited_email,token_hash,created_by,expires_at)
    VALUES (v_email,encode(pg_catalog.sha256(convert_to(v_code,'UTF8')),'hex'),v_uid,now()+interval '48 hours');
  RETURN v_code;
END;
$$;

-- Only the logged-in, email-confirmed, invited account can activate that code.
-- The token is marked used transactionally before upgrading the current user's
-- own role; it cannot be reused to promote another account.
CREATE OR REPLACE FUNCTION public.library_redeem_admin_invite(p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_email text;
  v_confirmed timestamptz;
  v_invite uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in before activating an invitation' USING ERRCODE='42501';
  END IF;
  SELECT lower(btrim(email)),email_confirmed_at
    INTO v_email,v_confirmed FROM auth.users WHERE id=v_uid;
  IF v_email IS NULL OR v_confirmed IS NULL THEN
    RAISE EXCEPTION 'Confirm the email address before activating admin access' USING ERRCODE='42501';
  END IF;
  IF p_code IS NULL OR length(p_code) <> 64 OR p_code !~ '^[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'Invitation code is invalid, expired, or intended for another email';
  END IF;
  UPDATE private.library_admin_invitations
    SET used_at=now(),used_by=v_uid
   WHERE token_hash=encode(pg_catalog.sha256(convert_to(p_code,'UTF8')),'hex')
     AND invited_email=v_email AND used_at IS NULL AND expires_at>now()
   RETURNING id INTO v_invite;
  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invitation code is invalid, expired, or intended for another email';
  END IF;
  INSERT INTO public.library_member_roles(user_id,role)
    VALUES(v_uid,'admin')
    ON CONFLICT(user_id) DO UPDATE SET role='admin';
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.library_create_admin_invite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.library_redeem_admin_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_create_admin_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_redeem_admin_invite(text) TO authenticated;
COMMIT;

-- Reminder: also verify public.library_member_roles RLS and library_books/
-- library_loans policies from the previous role migration before deployment.
