-- BrightSteps Hub: security fixes part 2, 16 Oct 2026
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
-- The student_emergency summary let EVERY teacher read every child's medical
-- conditions and emergency contacts, for the whole school. No Hub screen uses it.
-- From now on only the admin can read it (teachers still see allergies in the Hub).
-- The other three summaries were checked and are fine as they are:
--   leave_requests_payroll: admin and accountant only
--   students_billing: accountant only
--   students_roster: staff see names and grades only

create or replace view public.student_emergency as
select s.id, s.full_name, s.grade,
  m.allergies, m.medical_conditions,
  m.emergency_contact_name, m.emergency_contact_phone, m.emergency_contact_relationship
from public.students s
left join public.student_medical m on m.student_id = s.id
where exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin');

revoke all on public.student_emergency from anon;

-- Check: should say "admin only"
select case when pg_get_viewdef('public.student_emergency'::regclass) like '%''admin''::text)%'
             and pg_get_viewdef('public.student_emergency'::regclass) not like '%teacher%'
            then 'admin only' else 'CHECK FAILED' end as student_emergency;
