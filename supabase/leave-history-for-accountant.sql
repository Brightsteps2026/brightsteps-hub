-- BrightSteps Hub: leave history (17 Nov 2026). Already applied to the live database.
-- The accountant's Leave tab now lists approved AND denied requests (it used to show approved only).
-- Still admin and accountant only. The accountant sees name, type, dates and decision:
-- never the reason, notes, comments or proof files.

create or replace view public.leave_requests_payroll as
 SELECT r.id, r.teacher_id, p.full_name AS teacher_name, r.leave_type, r.start_date, r.end_date, r.decided_at, r.status
   FROM leave_requests r JOIN profiles p ON p.id = r.teacher_id
  WHERE r.status = ANY (ARRAY['approved'::text, 'denied'::text])
    AND leave_my_role() = ANY (ARRAY['admin'::text, 'accountant'::text]);
revoke all on public.leave_requests_payroll from anon;
