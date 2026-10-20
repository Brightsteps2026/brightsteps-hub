-- BrightSteps Hub: progress by standard (20 Oct 2026)
-- Run once in Supabase > SQL Editor, after gradebook-setup.sql and gradebook-types-letters-levels.sql.
-- Safe to run again. Deletes nothing.
--
-- What it does:
--   * gb_standards: the school's standards library (e.g. Common Core codes), by subject and grade.
--   * gb_assessment_standards: which standards each Gradebook assessment checks.
--   * gb_standard_progress: for every student and standard, the average of the linked
--     assessments (a % for Grade 3–7; the most recent level for Pre-N to Grade 2).
--   * Who sees what: the same as the Gradebook (admin everything, teachers their grades,
--     assistants their grades read only). Admin and teachers can add to the library.
--   * Standards already typed into the Hub's old standards list are copied across.

create table if not exists public.gb_standards (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text,
  subject text,
  grade text,
  description text not null,
  sort integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists gb_standards_lookup on public.gb_standards (grade, subject);

create table if not exists public.gb_assessment_standards (
  assessment_id uuid not null references public.gb_assessments(id) on delete cascade,
  standard_id uuid not null references public.gb_standards(id) on delete cascade,
  primary key (assessment_id, standard_id)
);
create index if not exists gb_assessment_standards_std on public.gb_assessment_standards (standard_id);

alter table public.gb_standards enable row level security;
alter table public.gb_assessment_standards enable row level security;

drop policy if exists "standards read" on public.gb_standards;
create policy "standards read" on public.gb_standards for select to authenticated
  using (public.hub_my_role() in ('admin', 'viewer', 'teacher', 'learning_assistant'));
drop policy if exists "standards write" on public.gb_standards;
create policy "standards write" on public.gb_standards for all to authenticated
  using (public.hub_my_role() = 'admin' or (public.hub_my_role() = 'teacher' and (grade is null or grade = any(public.gb_edit_grades()))))
  with check (public.hub_my_role() = 'admin' or (public.hub_my_role() = 'teacher' and (grade is null or grade = any(public.gb_edit_grades()))));

drop policy if exists "standard links read" on public.gb_assessment_standards;
create policy "standard links read" on public.gb_assessment_standards for select to authenticated
  using (exists (select 1 from public.gb_assessments a where a.id = assessment_id));  -- the Gradebook rules decide
drop policy if exists "standard links write" on public.gb_assessment_standards;
create policy "standard links write" on public.gb_assessment_standards for all to authenticated
  using (exists (select 1 from public.gb_assessments a where a.id = assessment_id and a.grade = any(public.gb_edit_grades())))
  with check (exists (select 1 from public.gb_assessments a where a.id = assessment_id and a.grade = any(public.gb_edit_grades())));

revoke all on public.gb_standards, public.gb_assessment_standards from anon;
grant select, insert, update, delete on public.gb_standards, public.gb_assessment_standards to authenticated;

-- Progress per student and standard. security_invoker: people only get rows for marks they may see.
create or replace view public.gb_standard_progress with (security_invoker = true) as
with marks as (
  select l.standard_id, m.student_id, a.grading, a.assessed_on, a.created_at,
    case when a.grading <> 'level' and m.points is not null and not m.excused
         then 100.0 * m.points / nullif(a.max_points, 0) end as pct,
    m.level
  from public.gb_assessment_standards l
  join public.gb_assessments a on a.id = l.assessment_id
  join public.gb_marks m on m.assessment_id = a.id
)
select standard_id, student_id,
  count(*) filter (where pct is not null or level is not null) as evidence,
  round(avg(pct)) as avg_pct,
  (array_agg(level order by coalesce(assessed_on, created_at::date) desc, created_at desc) filter (where level is not null))[1] as latest_level
from marks
group by standard_id, student_id;

grant select on public.gb_standard_progress to authenticated;

-- Copy the standards already typed into the Hub (the old copy stays where it is).
insert into public.gb_standards (legacy_id, code, subject, grade, description)
select s->>'id', nullif(s->>'code', ''), nullif(s->>'subject', ''), nullif(s->>'grade', ''),
       coalesce(nullif(s->>'description', ''), s->>'code', 'Standard')
from jsonb_array_elements(public.hub_arr(
  (select value::jsonb->'standards' from public.app_storage where key = 'brightsteps-hub-data' and shared = true))) s
where s->>'id' is not null
on conflict (legacy_id) do nothing;

select (select count(*) from public.gb_standards) as standards,
       (select count(*) from public.gb_assessment_standards) as linked;
