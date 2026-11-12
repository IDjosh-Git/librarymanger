-- Library Manager v5.26 — daily in/out register.
-- Applied to existing DataLearning Supabase project (library member roles); run once per project.
-- A web-app sign-in alone does not create a visit. Only an explicit Check in does.
-- Times are stamped by PostgreSQL; the UI displays them in Africa/Lagos (WAT).

create table if not exists public.library_daily_visits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 visitor_name text not null check (char_length(btrim(visitor_name)) between 2 and 120),
 visitor_email text not null check (char_length(visitor_email) between 3 and 255),
 visit_purpose text not null default 'Reading / study' check (char_length(visit_purpose) between 2 and 160),
 checked_in_at timestamptz not null default clock_timestamp(),
 completed boolean not null default false,
 checked_out_at timestamptz,
 check_out_notes text not null default '' check (char_length(check_out_notes) <= 1000),
 created_at timestamptz not null default clock_timestamp(),
 constraint library_visit_completion_pair check ((not completed and checked_out_at is null) or (completed and checked_out_at is not null)),
 constraint library_visit_checkout_after_in check (checked_out_at is null or checked_out_at >= checked_in_at)
);
create unique index if not exists library_daily_visits_one_open_per_member on public.library_daily_visits(user_id) where completed=false;
create index if not exists library_daily_visits_checkin_idx on public.library_daily_visits(checked_in_at desc);
create index if not exists library_daily_visits_user_checkin_idx on public.library_daily_visits(user_id,checked_in_at desc);

create table if not exists public.library_visit_books (
 id uuid primary key default gen_random_uuid(),
 visit_id uuid not null references public.library_daily_visits(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 book_title text not null check (char_length(btrim(book_title)) between 2 and 240),
 recorded_at timestamptz not null default clock_timestamp()
);
create unique index if not exists library_visit_books_unique_title on public.library_visit_books(visit_id,lower(btrim(book_title)));
create index if not exists library_visit_books_user_idx on public.library_visit_books(user_id,visit_id);

create or replace function public.library_daily_stamp_checkout()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.completed then
    raise exception 'A completed visit cannot be edited' using errcode='23514';
  end if;
  if not new.completed then
    raise exception 'Only check out is allowed on an open visit' using errcode='23514';
  end if;
  if new.user_id is distinct from old.user_id or new.visitor_name is distinct from old.visitor_name
     or new.visitor_email is distinct from old.visitor_email or new.visit_purpose is distinct from old.visit_purpose
     or new.checked_in_at is distinct from old.checked_in_at then
    raise exception 'Visit registration details cannot be changed' using errcode='23514';
  end if;
  new.checked_out_at := greatest(clock_timestamp(),old.checked_in_at);
  return new;
end;
$$;
revoke all on function public.library_daily_stamp_checkout() from public,anon,authenticated;
drop trigger if exists library_daily_stamped_checkout on public.library_daily_visits;
create trigger library_daily_stamped_checkout before update on public.library_daily_visits
 for each row execute function public.library_daily_stamp_checkout();

alter table public.library_daily_visits enable row level security;
alter table public.library_visit_books enable row level security;
revoke all on public.library_daily_visits from public,anon,authenticated;
revoke all on public.library_visit_books from public,anon,authenticated;
grant select on public.library_daily_visits to authenticated;
grant insert (user_id,visitor_name,visitor_email,visit_purpose) on public.library_daily_visits to authenticated;
grant update (completed,check_out_notes) on public.library_daily_visits to authenticated;
grant select,insert,delete on public.library_visit_books to authenticated;

-- Role is taken from the trusted library_member_roles table, never from user_metadata.
drop policy if exists library_daily_visits_member_read on public.library_daily_visits;
create policy library_daily_visits_member_read on public.library_daily_visits
 for select to authenticated using (
 user_id=(select auth.uid())
 or exists (select 1 from public.library_member_roles r where r.user_id=(select auth.uid()) and r.role='admin')
 );
drop policy if exists library_daily_visits_member_checkin on public.library_daily_visits;
create policy library_daily_visits_member_checkin on public.library_daily_visits
 for insert to authenticated with check (
 user_id=(select auth.uid()) and
 visitor_email=(select auth.jwt()->>'email') and
 exists (select 1 from public.library_member_roles r where r.user_id=(select auth.uid()) and r.role='user')
 );
drop policy if exists library_daily_visits_member_checkout on public.library_daily_visits;
create policy library_daily_visits_member_checkout on public.library_daily_visits
 for update to authenticated
 using (user_id=(select auth.uid()) and not completed and
 exists (select 1 from public.library_member_roles r where r.user_id=(select auth.uid()) and r.role='user'))
 with check (user_id=(select auth.uid()) and completed);

drop policy if exists library_visit_books_member_read on public.library_visit_books;
create policy library_visit_books_member_read on public.library_visit_books
 for select to authenticated using (
 user_id=(select auth.uid())
 or exists (select 1 from public.library_member_roles r where r.user_id=(select auth.uid()) and r.role='admin')
 );
drop policy if exists library_visit_books_member_add on public.library_visit_books;
create policy library_visit_books_member_add on public.library_visit_books
 for insert to authenticated with check (
 user_id=(select auth.uid()) and
 exists (select 1 from public.library_daily_visits v where v.id=visit_id and v.user_id=(select auth.uid()) and not v.completed) and
 exists (select 1 from public.library_member_roles r where r.user_id=(select auth.uid()) and r.role='user')
 );
drop policy if exists library_visit_books_member_remove on public.library_visit_books;
create policy library_visit_books_member_remove on public.library_visit_books
 for delete to authenticated using (
 user_id=(select auth.uid()) and
 exists (select 1 from public.library_daily_visits v where v.id=visit_id and v.user_id=(select auth.uid()) and not v.completed)
 );

-- Secure invoker RPCs use caller RLS privileges and never trust browser-supplied times.
create or replace function public.library_daily_check_in(p_name text,p_purpose text default 'Reading / study')
returns uuid language plpgsql security invoker set search_path='' as $$
declare
 v_user uuid := (select auth.uid());
 v_email text := (select auth.jwt()->>'email');
 v_id uuid;
begin
 if v_user is null or not exists(select 1 from public.library_member_roles r where r.user_id=v_user and r.role='user') then
  raise exception 'A signed-in library user account is required to check in' using errcode='42501';
 end if;
 if char_length(btrim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'Enter your name (2–120 characters)' using errcode='22023'; end if;
 if char_length(btrim(coalesce(p_purpose,''))) not between 2 and 160 then raise exception 'Choose a visit purpose' using errcode='22023'; end if;
 if v_email is null or char_length(v_email) < 3 then raise exception 'A verified email account is required' using errcode='22023'; end if;
 insert into public.library_daily_visits (user_id,visitor_name,visitor_email,visit_purpose)
 values (v_user,btrim(p_name),v_email,btrim(p_purpose)) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.library_daily_check_in(text,text) from public,anon;
grant execute on function public.library_daily_check_in(text,text) to authenticated;

create or replace function public.library_daily_record_books(p_visit_id uuid,p_titles text[])
returns integer language plpgsql security invoker set search_path='' as $$
declare
 v_user uuid := (select auth.uid());
 v_title text;
 v_count integer := 0;
begin
 if v_user is null or p_visit_id is null then raise exception 'Sign in and choose your active visit' using errcode='42501'; end if;
 perform 1 from public.library_daily_visits v
  where v.id=p_visit_id and v.user_id=v_user and not v.completed for update;
 if not found then raise exception 'Only your own active visit can have books added' using errcode='42501'; end if;
 if coalesce(array_length(p_titles,1),0)>12 then raise exception 'Record at most 12 books per visit' using errcode='22023'; end if;
 -- Validate all values before deleting the existing set.
 foreach v_title in array coalesce(p_titles,array[]::text[]) loop
   if char_length(btrim(coalesce(v_title,''))) not between 2 and 240 then raise exception 'Book titles must be 2–240 characters' using errcode='22023'; end if;
 end loop;
 delete from public.library_visit_books b where b.visit_id=p_visit_id and b.user_id=v_user;
 foreach v_title in array coalesce(p_titles,array[]::text[]) loop
  insert into public.library_visit_books(visit_id,user_id,book_title)
   values (p_visit_id,v_user,btrim(v_title)) on conflict do nothing;
 end loop;
 select count(*)::int into v_count from public.library_visit_books b where b.visit_id=p_visit_id and b.user_id=v_user;
 return v_count;
end;
$$;
revoke all on function public.library_daily_record_books(uuid,text[]) from public,anon;
grant execute on function public.library_daily_record_books(uuid,text[]) to authenticated;

create or replace function public.library_daily_check_out(p_visit_id uuid,p_titles text[],p_notes text default '')
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare
 v_user uuid := (select auth.uid());
 v_out timestamptz;
begin
 if v_user is null then raise exception 'Sign in to check out' using errcode='42501'; end if;
 perform 1 from public.library_daily_visits v where v.id=p_visit_id and v.user_id=v_user and not v.completed for update;
 if not found then raise exception 'This visit is no longer open' using errcode='42501'; end if;
 if char_length(coalesce(p_notes,''))>1000 then raise exception 'Notes cannot exceed 1,000 characters' using errcode='22023'; end if;
 perform public.library_daily_record_books(p_visit_id,p_titles);
 update public.library_daily_visits set completed=true,check_out_notes=coalesce(btrim(p_notes),'')
 where id=p_visit_id and user_id=v_user and not completed returning checked_out_at into v_out;
 if v_out is null then raise exception 'Unable to check out this visit' using errcode='40001'; end if;
 return v_out;
end;
$$;
revoke all on function public.library_daily_check_out(uuid,text[],text) from public,anon;
grant execute on function public.library_daily_check_out(uuid,text[],text) to authenticated;

-- Server-paginated admin report, with optional date, state and name/email/book search.
create or replace function public.library_daily_admin_report(
 p_from date default null,p_to date default null,p_status text default 'all',
 p_query text default '',p_page integer default 1,p_page_size integer default 20
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_total bigint := 0;
 v_open bigint := 0;
 v_closed bigint := 0;
 v_book_count bigint := 0;
 v_records jsonb := '[]'::jsonb;
 v_query text := btrim(coalesce(p_query,''));
 v_page integer := greatest(1,least(coalesce(p_page,1),100000));
 v_page_size integer := greatest(1,least(coalesce(p_page_size,20),100));
begin
 if not exists(select 1 from public.library_member_roles r where r.user_id=(select auth.uid()) and r.role='admin') then
  raise exception 'Administrator access is required for the visit register' using errcode='42501';
 end if;
 if p_from is not null and p_to is not null and p_from>p_to then raise exception 'Start date must precede end date' using errcode='22023'; end if;
 if coalesce(p_status,'all') not in ('all','open','completed') then raise exception 'Invalid attendance filter' using errcode='22023'; end if;
 with matching as materialized (
  select v.id,v.completed
  from public.library_daily_visits v
  where (p_from is null or v.checked_in_at >= (p_from::timestamp at time zone 'Africa/Lagos'))
    and (p_to is null or v.checked_in_at < ((p_to+1)::timestamp at time zone 'Africa/Lagos'))
    and (coalesce(p_status,'all')='all' or (p_status='open' and not v.completed) or (p_status='completed' and v.completed))
    and (v_query='' or v.visitor_name ilike '%'||v_query||'%' or v.visitor_email ilike '%'||v_query||'%' or exists(
      select 1 from public.library_visit_books b where b.visit_id=v.id and b.book_title ilike '%'||v_query||'%'))
 )
 select count(*),count(*) filter(where not completed),count(*) filter(where completed),
        coalesce((select count(*) from public.library_visit_books b join matching m on m.id=b.visit_id),0)
 into v_total,v_open,v_closed,v_book_count from matching;
 select coalesce(jsonb_agg(row_json order by checked_in_at desc,id desc),'[]'::jsonb) into v_records
 from (
  select v.id,v.checked_in_at,
    jsonb_build_object(
      'id',v.id,'user_id',v.user_id,'visitor_name',v.visitor_name,
      'visitor_email',v.visitor_email,'visit_purpose',v.visit_purpose,
      'checked_in_at',v.checked_in_at,'checked_out_at',v.checked_out_at,
      'completed',v.completed,'check_out_notes',v.check_out_notes,
      'books',coalesce((select jsonb_agg(b.book_title order by b.recorded_at,b.id)
                         from public.library_visit_books b where b.visit_id=v.id),'[]'::jsonb)
     ) as row_json
  from public.library_daily_visits v
  where (p_from is null or v.checked_in_at >= (p_from::timestamp at time zone 'Africa/Lagos'))
    and (p_to is null or v.checked_in_at < ((p_to+1)::timestamp at time zone 'Africa/Lagos'))
    and (coalesce(p_status,'all')='all' or (p_status='open' and not v.completed) or (p_status='completed' and v.completed))
    and (v_query='' or v.visitor_name ilike '%'||v_query||'%' or v.visitor_email ilike '%'||v_query||'%' or exists(
      select 1 from public.library_visit_books b where b.visit_id=v.id and b.book_title ilike '%'||v_query||'%'))
  order by v.checked_in_at desc,v.id desc
  limit v_page_size offset ((v_page-1)*v_page_size)
 ) page;
 return jsonb_build_object('rows',v_records,'total',v_total,'open',v_open,'completed',v_closed,
   'books',v_book_count,'page',v_page,'page_size',v_page_size);
end;
$$;
revoke all on function public.library_daily_admin_report(date,date,text,text,integer,integer) from public,anon;
grant execute on function public.library_daily_admin_report(date,date,text,text,integer,integer) to authenticated;
