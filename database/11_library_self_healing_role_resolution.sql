-- Library Manager v5.45: safely resolve the signed-in user's role.
-- The public signup form may select User or Admin, but that choice is NEVER
-- trusted for authorization. Administrators are promoted only by separate
-- database-validated invitation/access-code RPCs.
--
-- This function repairs old accounts missing a row (role = 'user') and
-- preserves an existing 'admin' row. It cannot promote or query other users.
create or replace function public.library_resolve_my_role()
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  verified_role text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  -- Only the authenticated user may be created as a normal library member.
  -- ON CONFLICT DO NOTHING prevents changing a pre-existing administrator.
  insert into public.library_member_roles (user_id, role)
  select u.id, 'user'
  from auth.users as u
  where u.id = current_user_id
  on conflict (user_id) do nothing;

  select r.role into verified_role
  from public.library_member_roles as r
  where r.user_id = current_user_id;

  if verified_role is null or verified_role not in ('admin', 'user') then
    raise exception 'Invalid library role. Contact the library administrator.' using errcode = '22023';
  end if;
  return verified_role;
end;
$function$;

-- A security-definer function exposed to browsers must have explicit access.
revoke all on function public.library_resolve_my_role() from public, anon;
grant execute on function public.library_resolve_my_role() to authenticated;
