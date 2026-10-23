-- Gradebook: what families see (23 October 2026)
-- Run the whole file once in the Supabase SQL Editor. Safe to run again.
--
-- What it does:
--   1. Each Gradebook assessment gets a "Share with families" tick (off by default).
--   2. Families read their own child's results ONLY for ticked assessments,
--      through one function. They still cannot read the Gradebook tables.
--   3. No term average is given to families: the term grade stays on the report card.
--   It does not change or delete any marks.

-- 1. The tick ----------------------------------------------------------------------

alter table public.gb_assessments add column if not exists shared_with_families boolean not null default false;
alter table public.gb_assessments add column if not exists shared_at timestamptz;

create or replace function public.gb_shared_stamp()
returns trigger language plpgsql as $fn$
begin
  if new.shared_with_families and (tg_op = 'INSERT' or not coalesce(old.shared_with_families, false)) then
    new.shared_at := now();
  elsif not new.shared_with_families then
    new.shared_at := null;
  end if;
  return new;
end $fn$;

drop trigger if exists gb_assessments_shared_stamp on public.gb_assessments;
create trigger gb_assessments_shared_stamp before insert or update on public.gb_assessments
  for each row execute function public.gb_shared_stamp();

-- 2. What a family (or staff, for that child's grade) can read ----------------------
-- p_student is the child's Hub id (the one parents are linked to).

drop function if exists public.gb_family_results(text);
create or replace function public.gb_family_results(p_student text)
returns table (
  assessment_id uuid, school_year text, term smallint, subject text, title text,
  assess_type text, grading text, max_points numeric, assessed_on date,
  points numeric, letter text, level text, excused boolean, note text
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  r text := public.hub_my_role();
  sid uuid;
  sgrade text;
begin
  if auth.uid() is null or p_student is null then return; end if;

  select st.id, st.grade into sid, sgrade from public.students st where st.legacy_id = p_student limit 1;
  if sid is null then return; end if;

  if r in ('parent', 'student') then
    if not (public.hub_my_student_ids() ? p_student) then return; end if;
  elsif r = 'admin' or r = 'viewer' then
    null;
  elsif not (sgrade = any(public.gb_view_grades())) then
    return;
  end if;

  return query
  select a.id, a.school_year, a.term, a.subject, a.title,
         a.assess_type, a.grading, a.max_points, a.assessed_on,
         m.points, m.letter, m.level, m.excused, m.note
  from public.gb_assessments a
  join public.gb_marks m on m.assessment_id = a.id and m.student_id = sid
  where a.shared_with_families
    and a.grade = sgrade
    and coalesce(a.assess_type, '') <> 'baseline'
    and (m.points is not null or m.letter is not null or m.level is not null or m.excused)
  order by a.assessed_on desc nulls last, a.created_at desc;
end $fn$;

revoke all on function public.gb_family_results(text) from public, anon;
grant execute on function public.gb_family_results(text) to authenticated;

-- 3. Check: assessments per grade, and how many are shared --------------------------
select grade, count(*) as assessments, count(*) filter (where shared_with_families) as shared
from public.gb_assessments
group by grade
order by grade;
