-- ONE-TIME EMAIL DELIVERY ADD-ON. Run after library_admin_invites_upgrade.sql.
-- On delivery failure the server invalidates only the freshly generated token.
BEGIN;
CREATE OR REPLACE FUNCTION public.library_revoke_admin_invite(p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_count integer;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.library_member_roles
     WHERE user_id = v_uid AND role = 'admin'
  ) THEN RAISE EXCEPTION 'Only an administrator may revoke an invitation' USING ERRCODE='42501'; END IF;
  IF p_code IS NULL OR p_code !~ '^[0-9a-fA-F]{64}$' THEN RETURN FALSE; END IF;
  UPDATE private.library_admin_invitations SET expires_at=now()
    WHERE created_by=v_uid AND used_at IS NULL AND expires_at>now()
      AND token_hash=encode(pg_catalog.sha256(convert_to(p_code,'UTF8')),'hex');
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count=1;
END;
$$;
REVOKE ALL ON FUNCTION public.library_revoke_admin_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_revoke_admin_invite(text) TO authenticated;
COMMIT;
