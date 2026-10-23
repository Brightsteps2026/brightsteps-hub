-- Early-years observations (Pre-Nursery, PreK, Kindergarten) — 23 October 2026
-- Run the whole file once in the Supabase SQL Editor. Safe to run again.
-- It adds one new table and changes no existing data.
--
-- Who can do what:
--   * Admin: everything.  Viewer: reads.
--   * Teachers and learning assistants: read and add observations for their classes.
--   * Teachers (their own classes) and the author: change or delete an observation.
--   * Families: nothing here. They only see an observation when a teacher ticks
--     "share in portfolio", which copies it into the child's portfolio.

create table if not exists public.ey_observations (
  id uuid primary key default gen_random_uuid(),
  school_year text not null default '2026-2027',
  term smallint not null check (term between 1 and 3),
  grade text not null check (grade in ('Pre-N', 'PreK', 'Kindergarten')),
  student_id uuid not null references public.students(id) on delete cascade,
  area text not null,
  note text,
  level text check (level in ('beginning', 'growing', 'secure')),
  photo jsonb,                    -- { path, name, type } of the uploaded photo
  observed_on date not null default current_date,
  shared boolean not null default false,
  portfolio_entry_id text,        -- the portfolio entry made when shared
  created_by uuid default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create index if not exists ey_obs_lookup on public.ey_observations (grade, school_year, term);
create index if not exists ey_obs_student on public.ey_observations (student_id, area);

-- The grade must be the child's grade.
create or replace function public.ey_obs_check()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- Checked when an observation is added (a child may move up a grade later).
  if (tg_op = 'INSERT' or new.student_id <> old.student_id or new.grade <> old.grade)
     and public.gb_student_grade(new.student_id) is distinct from new.grade then
    raise exception 'This child is not in %', new.grade;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $fn$;

drop trigger if exists ey_obs_check on public.ey_observations;
create trigger ey_obs_check before insert or update on public.ey_observations
  for each row execute function public.ey_obs_check();

alter table public.ey_observations enable row level security;

drop policy if exists "ey obs read" on public.ey_observations;
drop policy if exists "ey obs add" on public.ey_observations;
drop policy if exists "ey obs change" on public.ey_observations;
drop policy if exists "ey obs delete" on public.ey_observations;

create policy "ey obs read" on public.ey_observations for select to authenticated
  using (grade = any(public.gb_view_grades()) or public.hub_my_role() = 'viewer');

create policy "ey obs add" on public.ey_observations for insert to authenticated
  with check (grade = any(public.gb_view_grades()));

create policy "ey obs change" on public.ey_observations for update to authenticated
  using (grade = any(public.gb_edit_grades()) or created_by = auth.uid())
  with check (grade = any(public.gb_view_grades()));

create policy "ey obs delete" on public.ey_observations for delete to authenticated
  using (grade = any(public.gb_edit_grades()) or created_by = auth.uid());

revoke all on public.ey_observations from anon;
grant select, insert, update, delete on public.ey_observations to authenticated;

-- Check: should show 0 rows to start with, and no error.
select grade, count(*) as observations from public.ey_observations group by grade order by grade;
