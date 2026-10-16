-- BrightSteps Hub: security fixes, 16 Oct 2026
-- Run once in Supabase > SQL Editor (paste the whole file, then Run). Safe to run again.
-- It does not delete any school data or any file.
--
-- What it does:
--   1. Photos and files: parents and students can only open files that belong to
--      what they already see on the Hub (their own children's photos, portfolio,
--      assignments, documents shared with parents, published report cards), plus
--      files they uploaded themselves. Staff keep opening everything as before.
--      Until now, any signed-in account could list and open all 102 files.
--   2. Guardian links: only the admin (and each parent, for their own links) can
--      read who is linked to which child. Teachers no longer can.
--   3. Medical information table: admin only (teachers get allergies through the
--      Hub as before, but not the full medical table). Adding a student or medical
--      information always checks who is doing it.
--   4. Teachers and assistants can read the student list of THEIR grades from the
--      students table (the Gradebook and report cards need it). Before, a teacher
--      who is not the homeroom teacher saw no students there.
--   5. Signed out: nobody can read any table or run any database function, except
--      the login-screen logo.
--   6. At the end, it SHOWS (read only) how four older summary views are defined,
--      so Claude can check them next.

-- 1. Photos and files ------------------------------------------------------------------

-- Every file path that appears in what this parent or student receives from the
-- Hub, plus photos on their children's published report cards. Null for staff.
create or replace function public.hub_my_file_paths()
returns text[] language plpgsql stable security definer set search_path = public as $fn$
declare
  r text := public.hub_my_role();
  ids jsonb := public.hub_my_student_ids();
  mine text;
  reports text;
begin
  if r is null or r not in ('parent', 'student') then return null; end if;
  mine := public.hub_trim((select value::jsonb from public.app_storage
                           where key = 'brightsteps-hub-data' and shared = true))::text;
  reports := coalesce((select string_agg(content::text, ' ') from public.term_reports
                       where status = 'published' and ids ? hub_student_id), '');
  return coalesce((
    select array_agg(distinct m[1])
    from regexp_matches(coalesce(mine, '') || ' ' || reports, '"(?:path|photoPath)":\s*"([^"]+)"', 'g') m
  ), '{}');
end $fn$;

revoke all on function public.hub_my_file_paths() from public, anon;
grant execute on function public.hub_my_file_paths() to authenticated;

drop policy if exists "Authenticated can view attachments" on storage.objects;
drop policy if exists "Attachments: who can open" on storage.objects;
create policy "Attachments: who can open" on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments' and (
      public.hub_my_role() in ('admin', 'viewer', 'teacher', 'learning_assistant', 'accountant')
      or owner = auth.uid()
      or name = any (coalesce((select public.hub_my_file_paths()), '{}'::text[]))
    )
  );
-- (The leave-proof rule from leave-alerts-and-proof.sql still applies on top of this.)

-- 2. Guardian links ----------------------------------------------------------------------

drop policy if exists "Parents can see their own links" on public.student_guardians;
create policy "Parents can see their own links" on public.student_guardians for select to authenticated
  using (parent_id = auth.uid() or public.hub_my_role() = 'admin');

-- 3. Medical information and adding students --------------------------------------------

drop policy if exists "All staff can view medical info" on public.student_medical;
drop policy if exists "All staff can edit medical info" on public.student_medical;
drop policy if exists "All staff can add medical info" on public.student_medical;
drop policy if exists "Medical info: admin only" on public.student_medical;
create policy "Medical info: admin only" on public.student_medical for all to authenticated
  using (public.hub_my_role() = 'admin') with check (public.hub_my_role() = 'admin');

drop policy if exists "Teachers and admin can add students" on public.students;
create policy "Teachers and admin can add students" on public.students for insert to authenticated
  with check (public.hub_my_role() in ('teacher', 'admin'));

-- 4. Teachers and assistants: students of their grades -------------------------------------

drop policy if exists "Staff can view students of their grades" on public.students;
create policy "Staff can view students of their grades" on public.students for select to authenticated
  using (public.hub_my_role() in ('teacher', 'learning_assistant') and grade = any (public.gb_view_grades()));

-- 5. Nothing for signed-out visitors except the logo --------------------------------------------

do $do$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm') and c.relname <> 'app_storage'
  loop
    execute format('revoke all on public.%I from anon', t.relname);
  end loop;
end $do$;
revoke insert, update, delete, truncate on public.app_storage from anon;
-- Functions are open to everyone ("public") by default, which includes signed-out
-- visitors. For each function: keep exactly who may run it today among signed-in
-- users and the server, then close it to everyone else.
do $do$
declare f record;
begin
  for f in
    select p.oid, p.oid::regprocedure::text as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    if has_function_privilege('authenticated', f.oid, 'execute') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $do$;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- 6. Check (read only) ---------------------------------------------------------------------------

select 'file rule' as what, policyname as detail from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
union all
select 'signed-out can still read', table_name from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public' and privilege_type = 'SELECT'
union all
select 'signed-out can still run', p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
union all
select 'view ' || viewname, pg_get_viewdef(('public.' || viewname)::regclass, true) from pg_views
  where schemaname = 'public' and viewname in ('student_emergency', 'students_billing', 'students_roster', 'leave_requests_payroll')
order by 1, 2;
