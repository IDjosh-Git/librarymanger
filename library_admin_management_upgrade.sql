-- Library Manager · Active Administrator Directory
-- Review and apply ONCE in the Supabase SQL editor after library_roles_and_circulation.sql.
-- No existing accounts or records are deleted. Removing an administrator demotes their role to 'user'.
BEGIN;
CREATE TABLE IF NOT EXISTS public.library_admin_activity (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 sign_in_count bigint NOT NULL DEFAULT 1 CHECK(sign_in_count >= 1)
);
ALTER TABLE public.library_admin_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_admin_activity FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.library_admin_role_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 affected_user_id uuid NOT NULL,
 changed_by uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('revoke_admin')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.library_admin_role_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_admin_role_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.library_register_admin_visit()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := (select auth.uid());
BEGIN
 IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.library_member_roles r WHERE r.user_id=v_uid AND r.role='admin')
 THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.library_admin_activity(user_id) VALUES(v_uid)
 ON CONFLICT(user_id) DO UPDATE SET last_seen_at=now(), sign_in_count=public.library_admin_activity.sign_in_count+1;
END;
$$;

CREATE OR REPLACE FUNCTION public.library_list_active_admins()
RETURNS TABLE(user_id uuid, display_name text, email text, first_seen_at timestamptz, last_seen_at timestamptz, sign_in_count bigint, is_self boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := (select auth.uid());
BEGIN
 IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.library_member_roles r WHERE r.user_id=v_uid AND r.role='admin')
 THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT r.user_id,
   COALESCE(NULLIF(btrim(u.raw_user_meta_data->>'full_name'),''),NULLIF(split_part(u.email,'@',1),''),'Administrator')::text,
   COALESCE(u.email,'')::text,
   a.first_seen_at,a.last_seen_at,a.sign_in_count,(r.user_id=v_uid)
 FROM public.library_member_roles r
 JOIN public.library_admin_activity a ON a.user_id=r.user_id
 JOIN auth.users u ON u.id=r.user_id
 WHERE r.role='admin'
 ORDER BY a.last_seen_at DESC,r.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.library_revoke_admin(p_target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := (select auth.uid()); v_changed integer;
BEGIN
 IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.library_member_roles r WHERE r.user_id=v_uid AND r.role='admin')
 THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF p_target IS NULL THEN RAISE EXCEPTION 'An administrator must be selected' USING ERRCODE='22023'; END IF;
 IF p_target=v_uid THEN RAISE EXCEPTION 'You cannot remove your own administrator access' USING ERRCODE='42501'; END IF;
 -- Serialize concurrent admin removals and recheck membership under the same lock.
 PERFORM pg_advisory_xact_lock(7281302,317);
 IF NOT EXISTS(SELECT 1 FROM public.library_member_roles WHERE user_id=v_uid AND role='admin')
 THEN RAISE EXCEPTION 'Administrator access no longer available' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.library_member_roles WHERE role='admin')<=1
 THEN RAISE EXCEPTION 'Cannot remove the last administrator' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.library_admin_activity WHERE user_id=p_target)
 THEN RAISE EXCEPTION 'This account has no verified Library Manager administrator activity' USING ERRCODE='22023'; END IF;
 UPDATE public.library_member_roles SET role='user' WHERE user_id=p_target AND role='admin';
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>1 THEN RAISE EXCEPTION 'This account is not an administrator' USING ERRCODE='22023'; END IF;
 INSERT INTO public.library_admin_role_audit(affected_user_id,changed_by,action) VALUES (p_target,v_uid,'revoke_admin');
 RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.library_register_admin_visit() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.library_list_active_admins() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.library_revoke_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.library_register_admin_visit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_list_active_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_revoke_admin(uuid) TO authenticated;
COMMIT;
