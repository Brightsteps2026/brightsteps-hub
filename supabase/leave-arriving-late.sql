-- BrightSteps Hub: "Arriving late" leave requests (19 Nov 2026). Already applied. Safe to run again.
alter table public.leave_requests add column if not exists expected_arrival time;
alter table public.leave_requests drop constraint if exists leave_requests_leave_type_check,
  add constraint leave_requests_leave_type_check check (leave_type = any (array['half_am','half_pm','full_day','multi_day','late']));
-- staff_leave_on() returns 'late' for an approved late arrival (check-in stays required; real arrival = check-in time).
