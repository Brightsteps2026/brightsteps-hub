-- BrightSteps Hub: security fixes, 6 Nov 2026
-- Already applied to the live database. Safe to run again. Deletes nothing.
--
-- 1. Summary views could be WRITTEN through.
--    students_roster and students_billing are simple one-table views that run with the
--    owner's rights, so the database let signed-in users update or delete through them:
--    any teacher could change or delete any of the 46 student records via students_roster,
--    and the accountant via students_billing. Fix: these views are read-only for everyone.
--
-- 2. Three of the four views are not used by any Hub screen (students_roster,
--    students_billing, student_emergency). They now follow the normal table rules
--    (security_invoker), so they can never show more than the tables themselves allow.
--    leave_requests_payroll IS used (Leave requests > payroll, admin and accountant) and must
--    keep reading leave_requests and profiles for the accountant, so it stays as it is,
--    read-only, still limited to admin and accountant by its own condition.
--
-- 3. Internal database functions that run with extra rights could be called by anyone,
--    even signed out. Signed-out visitors no longer can; signed-in users are unchanged.
--    (Triggers keep working: the database does not check this permission for triggers.)
--
-- 4. Functions without a fixed search_path get search_path = public, so nobody can
--    trick them into using a look-alike table.

-- 1 + 2 ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on public.students_roster, public.students_billing, public.student_emergency, public.leave_requests_payroll
  from authenticated, anon, public;
revoke all on public.students_roster, public.students_billing, public.student_emergency, public.leave_requests_payroll from anon;

alter view public.students_roster   set (security_invoker = true);
alter view public.students_billing  set (security_invoker = true);
alter view public.student_emergency set (security_invoker = true);

-- 3 -------------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

-- 4 -------------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public' and p.prokind = 'f' and d.objid is null
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- 5. Trigger functions are never called directly (the database does not check this
--    permission for triggers), so nobody needs to be able to call them.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- 6. Marking school-fee payments overdue is a scheduled job, not something any
--    signed-in user should be able to trigger.
revoke execute on function public.flag_overdue_payments() from public, anon, authenticated;

-- Still open on purpose:
--   * leave_requests_payroll keeps owner rights (see 2), read-only.
--   * pg_net stays in the public schema: moving it can break the email and push triggers.
--   * Leaked password protection: Supabase dashboard > Authentication > settings (Pro plan feature).
