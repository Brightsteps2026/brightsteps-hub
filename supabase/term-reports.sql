-- BrightSteps Hub: term report cards (built from the Gradebook)
-- Run once in Supabase > SQL Editor, BEFORE uploading the new code. Safe to run again.
-- Nothing is deleted. The Gradebook and the older Reports screen stay as they are.
--
-- What it does:
--   * term_reports: one report card per student, per term. Each one is a snapshot
--     of the Gradebook (marks, levels, comments, ATL · SEL · Life skills, the
--     homeroom note, attendance and up to 3 portfolio photos for the little ones).
--   * Teachers make and refresh DRAFTS for their own grades. Assistants can look.
--   * Only the admin can PUBLISH. Families only ever see published report cards,
--     and only for their own children.
--   * When a report card is published, each parent of that child gets a bell notice,
--     and an email (sent by the notify-term-reports function) saying it is ready on
--     the Hub. The report card itself is never attached to the email.

-- 1. The table --------------------------------------------------------------------

create table if not exists public.term_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  hub_student_id text,                 -- Hub student id (same as profiles.student_ids), filled in automatically
  school_year text not null default '2026-2027',
  term smallint not null check (term between 1 and 3),
  grade text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  published_by uuid,
  published_at timestamptz,
  emailed_at timestamptz,              -- when families were emailed (only ever once)
  unique (student_id, school_year, term)
);
alter table public.term_reports add column if not exists emailed_at timestamptz;
create index if not exists term_reports_lookup on public.term_reports (grade, school_year, term);
create index if not exists term_reports_hub_student on public.term_reports (hub_student_id);

-- 2. Rules checked on every save ----------------------------------------------------
--   * grade and Hub student id always come from the student record (cannot be faked)
--   * only the admin can publish or unpublish
--   * a published report card can only be changed by the admin

create or replace function public.term_reports_guard()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  me text := public.hub_my_role();
begin
  select st.grade, st.legacy_id into new.grade, new.hub_student_id
  from public.students st where st.id = new.student_id;

  if new.grade is null then raise exception 'Student not found'; end if;

  -- The email function (no signed-in person) only records when families were emailed.
  if auth.uid() is null then
    return new;
  end if;

  -- Only the email function sets emailed_at.
  if tg_op = 'INSERT' then
    new.emailed_at := null;
  else
    new.emailed_at := old.emailed_at;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'published' and me is distinct from 'admin' then
      raise exception 'Only the admin can publish a report card';
    end if;
  else
    if old.status = 'published' and me is distinct from 'admin' then
      raise exception 'This report card is published. Ask the admin to unpublish it before changing it.';
    end if;
    if new.status is distinct from old.status and me is distinct from 'admin' then
      raise exception 'Only the admin can publish a report card';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
    new.published_by := auth.uid();
  elsif new.status = 'draft' then
    new.published_at := null;
    new.published_by := null;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $fn$;

drop trigger if exists term_reports_guard on public.term_reports;
create trigger term_reports_guard before insert or update on public.term_reports
  for each row execute function public.term_reports_guard();

-- 3. Bell notice to the parents when a report card is published ---------------------

create or replace function public.term_reports_notify()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  child text := coalesce(new.content->'student'->>'name', 'your child');
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and new.hub_student_id is not null then
    insert into public.notifications (user_id, student_id, kind, title, title_fr, body, body_fr)
    select p.id, new.hub_student_id, 'term_report',
      'Term ' || new.term || ' report card: ' || child,
      'Bulletin du trimestre ' || new.term || ' : ' || child,
      child || '''s Term ' || new.term || ' report card is ready. Open My child, then Reports.',
      'Le bulletin du trimestre ' || new.term || ' de ' || child || ' est disponible. Ouvrez Mon enfant, puis Bulletins.'
    from public.profiles p
    where p.role = 'parent' and to_jsonb(p.student_ids) ? new.hub_student_id;
  end if;
  return new;
end $fn$;

drop trigger if exists term_reports_notify on public.term_reports;
create trigger term_reports_notify after insert or update on public.term_reports
  for each row execute function public.term_reports_notify();

-- 4. Who can see and change what -----------------------------------------------------

alter table public.term_reports enable row level security;

drop policy if exists "term reports: staff read" on public.term_reports;
drop policy if exists "term reports: family read" on public.term_reports;
drop policy if exists "term reports: teacher write" on public.term_reports;
drop policy if exists "term reports: teacher update" on public.term_reports;
drop policy if exists "term reports: admin delete" on public.term_reports;

-- Admin and viewer: all. Teachers and assistants: their grades.
create policy "term reports: staff read" on public.term_reports for select to authenticated
  using (public.hub_my_role() in ('admin', 'viewer') or grade = any(public.gb_view_grades()));

-- Parents and students: published report cards of their own children only.
create policy "term reports: family read" on public.term_reports for select to authenticated
  using (status = 'published' and public.hub_my_role() in ('parent', 'student')
         and public.hub_my_student_ids() ? hub_student_id);

-- Teachers (their own grades, not assistant grades) and the admin.
create policy "term reports: teacher write" on public.term_reports for insert to authenticated
  with check (public.gb_student_grade(student_id) = any(public.gb_edit_grades()));
create policy "term reports: teacher update" on public.term_reports for update to authenticated
  using (grade = any(public.gb_edit_grades()))
  with check (public.gb_student_grade(student_id) = any(public.gb_edit_grades()));

create policy "term reports: admin delete" on public.term_reports for delete to authenticated
  using (public.hub_my_role() = 'admin');

revoke all on public.term_reports from anon;
grant select, insert, update, delete on public.term_reports to authenticated;

-- 5. Homeroom teacher names for the report cards of a grade ------------------------

create or replace function public.term_report_homerooms(p_grade text)
returns table (student_id uuid, teacher_name text)
language sql stable security definer set search_path = public as $fn$
  select st.id, p.full_name
  from public.students st
  left join public.profiles p on p.id = st.home_teacher_id
  where st.grade = p_grade
    and (public.hub_my_role() in ('admin', 'viewer') or p_grade = any(public.gb_view_grades()))
$fn$;

revoke all on function public.term_report_homerooms(text) from public, anon;
grant execute on function public.term_report_homerooms(text) to authenticated;

-- 6. Check: should show the table, its 5 rules and the homeroom function -------------

select 'table' as what, count(*)::text as detail from public.term_reports
union all
select 'rule', policyname from pg_policies where tablename = 'term_reports'
union all
select 'function', proname from pg_proc where proname = 'term_report_homerooms';
