-- BrightSteps Hub: class timetable (20 Oct 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
-- What it does:
--   * tt_periods: the school day (e.g. "Period 1, 07:45–08:30", "Break"), and which weekdays
--     each one applies to (so Tuesday can run later).
--   * tt_slots: for each grade, weekday and period: the subject, the teacher and the room.
--   * Who sees what: all staff see every class; a family or student sees their own child's
--     class only. Only the admin changes the timetable.

create table if not exists public.tt_periods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_time time not null,
  end_time time not null,
  kind text not null default 'lesson' check (kind in ('lesson', 'break')),
  days smallint[] not null default '{1,2,3,4,5}',
  sort integer not null default 0,
  check (end_time > start_time)
);

create table if not exists public.tt_slots (
  id uuid primary key default gen_random_uuid(),
  grade text not null,
  weekday smallint not null check (weekday between 1 and 5),
  period_id uuid not null references public.tt_periods(id) on delete cascade,
  subject text,
  teacher_id uuid references public.profiles(id) on delete set null,
  room text,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (grade, weekday, period_id)
);
create index if not exists tt_slots_teacher on public.tt_slots (teacher_id);

alter table public.tt_periods enable row level security;
alter table public.tt_slots enable row level security;

drop policy if exists "tt periods read" on public.tt_periods;
create policy "tt periods read" on public.tt_periods for select to authenticated using (true);
drop policy if exists "tt periods write" on public.tt_periods;
create policy "tt periods write" on public.tt_periods for all to authenticated
  using (public.hub_my_role() = 'admin') with check (public.hub_my_role() = 'admin');

drop policy if exists "tt slots read" on public.tt_slots;
create policy "tt slots read" on public.tt_slots for select to authenticated using (
  public.hub_my_role() in ('admin', 'viewer', 'teacher', 'learning_assistant')
  or grade = any (public.hw_child_grades())
);
drop policy if exists "tt slots write" on public.tt_slots;
create policy "tt slots write" on public.tt_slots for all to authenticated
  using (public.hub_my_role() = 'admin') with check (public.hub_my_role() = 'admin');

revoke all on public.tt_periods, public.tt_slots from anon;
grant select, insert, update, delete on public.tt_periods, public.tt_slots to authenticated;

-- Check
select (select count(*) from public.tt_periods) as periods, (select count(*) from public.tt_slots) as lessons;
