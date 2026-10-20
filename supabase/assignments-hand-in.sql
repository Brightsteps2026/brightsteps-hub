-- BrightSteps Hub: Assignments with hand-in, marking and feedback (20 Oct 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
-- What it does:
--   * hw_assignments: what the teacher sets (title, instructions, grades, due date, files),
--     optionally linked to a Gradebook assessment.
--   * hw_submissions: one row per student and assignment: the student's answer and files,
--     handed-in time, and the teacher's feedback and mark.
--   * Grade 3 to Grade 7 students hand in themselves. For younger classes the teacher adds a
--     photo of the work.
--   * Who sees what:
--       admin and viewer: everything (viewer cannot change anything);
--       teachers: their own grades, can set, mark and return;
--       learning assistants: their grades, read only;
--       a student: the assignments for their grade and only their own work;
--       a parent: the assignments and work of their own children, feedback once returned.
--   * A student can never change their mark or feedback, and cannot change work after the
--     teacher has returned it.
--   * When work is returned, the family gets a bell notice, and the mark goes into the
--     Gradebook if the assignment is linked to one.
--   * The assignments already on the Hub are copied across (nothing is removed from the old place).

-- 1. Tables ---------------------------------------------------------------------------------

create table if not exists public.hw_assignments (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null,
  description text,
  subject text,
  grades text[] not null default '{}',
  due_date date,
  link text,
  files jsonb not null default '[]'::jsonb,
  hand_in boolean not null default true,
  gb_assessment_id uuid references public.gb_assessments(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create index if not exists hw_assignments_due on public.hw_assignments (due_date);

create table if not exists public.hw_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.hw_assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  hub_student_id text not null,
  status text not null default 'draft' check (status in ('draft', 'handed_in', 'returned')),
  answer text,
  files jsonb not null default '[]'::jsonb,
  handed_in_at timestamptz,
  added_by_staff boolean not null default false,
  feedback text,
  feedback_files jsonb not null default '[]'::jsonb,
  mark_points numeric check (mark_points is null or mark_points >= 0),
  mark_letter text check (mark_letter is null or mark_letter in ('A+','A','A−','B+','B','B−','C+','C','C−','D+','D','D−','F')),
  mark_level text check (mark_level is null or mark_level in ('emerging','developing','meeting','exceeding')),
  marked_by uuid,
  marked_at timestamptz,
  returned_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists hw_submissions_hub_student on public.hw_submissions (hub_student_id);

alter table public.hw_assignments enable row level security;
alter table public.hw_submissions enable row level security;

-- 2. Helpers --------------------------------------------------------------------------------

-- Staff who may SEE work for any of these grades.
create or replace function public.hw_staff_view(p_grades text[])
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.hub_my_role() in ('admin', 'viewer')
      or (public.hub_my_role() in ('teacher', 'learning_assistant')
          and exists (select 1 from unnest(p_grades) g where public.hub_my_grades() ? g))
$fn$;

-- Staff who may SET, MARK and RETURN work for all of these grades (admin, or the teacher).
create or replace function public.hw_staff_edit(p_grades text[])
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.hub_my_role() = 'admin'
      or (public.hub_my_role() = 'teacher' and cardinality(p_grades) > 0
          and p_grades <@ public.gb_edit_grades())
$fn$;

-- Grades of the signed-in family's (or student's) own children.
create or replace function public.hw_child_grades()
returns text[] language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(distinct st.grade), '{}')
  from public.students st
  where public.hub_my_role() in ('parent', 'student') and public.hub_my_student_ids() ? st.legacy_id
$fn$;

create or replace function public.hw_student_grade(p_student uuid)
returns text language sql stable security definer set search_path = public as $fn$
  select grade from public.students where id = p_student
$fn$;

-- 3. Who can read and write -----------------------------------------------------------------

drop policy if exists "hw assignments read" on public.hw_assignments;
create policy "hw assignments read" on public.hw_assignments for select to authenticated
  using (public.hw_staff_view(grades) or grades && public.hw_child_grades());

drop policy if exists "hw assignments write" on public.hw_assignments;
create policy "hw assignments write" on public.hw_assignments for all to authenticated
  using (public.hw_staff_edit(grades)) with check (public.hw_staff_edit(grades));

drop policy if exists "hw submissions read" on public.hw_submissions;
create policy "hw submissions read" on public.hw_submissions for select to authenticated
  using (
    public.hw_staff_view(array[public.hw_student_grade(student_id)])
    or (public.hub_my_role() in ('parent', 'student') and public.hub_my_student_ids() ? hub_student_id)
  );

drop policy if exists "hw submissions insert" on public.hw_submissions;
create policy "hw submissions insert" on public.hw_submissions for insert to authenticated
  with check (
    public.hw_staff_edit(array[public.hw_student_grade(student_id)])
    or (public.hub_my_role() = 'student' and public.hub_my_student_ids() ? hub_student_id)
  );

drop policy if exists "hw submissions update" on public.hw_submissions;
create policy "hw submissions update" on public.hw_submissions for update to authenticated
  using (
    public.hw_staff_edit(array[public.hw_student_grade(student_id)])
    or (public.hub_my_role() = 'student' and public.hub_my_student_ids() ? hub_student_id)
  )
  with check (
    public.hw_staff_edit(array[public.hw_student_grade(student_id)])
    or (public.hub_my_role() = 'student' and public.hub_my_student_ids() ? hub_student_id)
  );

drop policy if exists "hw submissions delete" on public.hw_submissions;
create policy "hw submissions delete" on public.hw_submissions for delete to authenticated
  using (public.hw_staff_edit(array[public.hw_student_grade(student_id)]));

-- 4. Safety checks on every save ------------------------------------------------------------

create or replace function public.hw_touch_assignment()
returns trigger language plpgsql set search_path = public as $fn$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $fn$;

drop trigger if exists hw_assignments_touch on public.hw_assignments;
create trigger hw_assignments_touch before insert or update on public.hw_assignments
  for each row execute function public.hw_touch_assignment();

create or replace function public.hw_guard_submission()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  a public.hw_assignments;
  st public.students;
  r text := public.hub_my_role();
begin
  select * into st from public.students where id = new.student_id;
  if st.id is null then
    select * into st from public.students where legacy_id = new.hub_student_id;
    new.student_id := st.id;
  end if;
  if st.id is null then raise exception 'Student not found'; end if;
  new.hub_student_id := st.legacy_id;

  select * into a from public.hw_assignments where id = new.assignment_id;
  if a.id is null then raise exception 'Assignment not found'; end if;
  if not (st.grade = any(a.grades)) then raise exception 'This assignment is not for %', st.grade; end if;

  -- Changes made from the SQL Editor or by the database itself are not checked further.
  if auth.uid() is null then return new; end if;

  if r = 'student' then
    if st.grade not in ('Grade 3','Grade 4','Grade 5','Grade 6','Grade 7') or not a.hand_in then
      raise exception 'This work is handed in by your teacher';
    end if;
    if tg_op = 'UPDATE' and old.status = 'returned' then
      raise exception 'Your teacher has already returned this work';
    end if;
    if new.status not in ('draft', 'handed_in') then new.status := 'draft'; end if;
    -- A student never sets marks or feedback.
    if tg_op = 'UPDATE' then
      new.feedback := old.feedback; new.feedback_files := old.feedback_files;
      new.mark_points := old.mark_points; new.mark_letter := old.mark_letter; new.mark_level := old.mark_level;
      new.marked_by := old.marked_by; new.marked_at := old.marked_at; new.returned_at := old.returned_at;
      new.added_by_staff := old.added_by_staff;
    else
      new.feedback := null; new.feedback_files := '[]'::jsonb;
      new.mark_points := null; new.mark_letter := null; new.mark_level := null;
      new.marked_by := null; new.marked_at := null; new.returned_at := null;
      new.added_by_staff := false;
    end if;
  else
    -- Staff
    if tg_op = 'INSERT' then new.added_by_staff := true; end if;
    if (tg_op = 'INSERT' and (new.mark_points is not null or new.mark_letter is not null or new.mark_level is not null or new.feedback is not null))
       or (tg_op = 'UPDATE' and (new.mark_points is distinct from old.mark_points or new.mark_letter is distinct from old.mark_letter
                                 or new.mark_level is distinct from old.mark_level or new.feedback is distinct from old.feedback)) then
      new.marked_by := auth.uid(); new.marked_at := now();
    end if;
    if new.status = 'returned' and (tg_op = 'INSERT' or old.status <> 'returned') then
      new.returned_at := now();
    end if;
  end if;

  if new.status = 'handed_in' and (tg_op = 'INSERT' or old.status = 'draft') then
    new.handed_in_at := now();
  elsif new.status = 'draft' then
    new.handed_in_at := null;
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $fn$;

drop trigger if exists hw_submissions_guard on public.hw_submissions;
create trigger hw_submissions_guard before insert or update on public.hw_submissions
  for each row execute function public.hw_guard_submission();

-- 5. When work is returned: bell notice to the family, mark into the Gradebook ---------------

create or replace function public.hw_on_returned()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  a public.hw_assignments;
  first_name text;
begin
  if new.status <> 'returned' then return new; end if;
  select * into a from public.hw_assignments where id = new.assignment_id;

  if a.gb_assessment_id is not null
     and (new.mark_points is not null or new.mark_letter is not null or new.mark_level is not null) then
    insert into public.gb_marks (assessment_id, student_id, points, letter, level)
    values (a.gb_assessment_id, new.student_id, new.mark_points, new.mark_letter, new.mark_level)
    on conflict (assessment_id, student_id)
    do update set points = excluded.points, letter = excluded.letter, level = excluded.level;
  end if;

  if tg_op = 'INSERT' or old.status <> 'returned' then
    select split_part(coalesce(full_name, ''), ' ', 1) into first_name from public.students where id = new.student_id;
    insert into public.notifications (user_id, student_id, kind, title, title_fr, body, body_fr)
    select p.id, new.hub_student_id, 'assignment_returned',
      coalesce(nullif(first_name, '') || '''s', 'Your child''s') || ' work has been marked',
      'Le travail de ' || coalesce(nullif(first_name, ''), 'votre enfant') || ' a été corrigé',
      a.title || ': the teacher''s feedback is on the Hub.',
      a.title || ' : le retour de l''enseignant(e) est sur le Hub.'
    from public.profiles p
    where p.role in ('parent', 'student') and coalesce(to_jsonb(p.student_ids), '[]'::jsonb) ? new.hub_student_id;
  end if;
  return new;
end $fn$;

drop trigger if exists hw_submissions_returned on public.hw_submissions;
create trigger hw_submissions_returned after insert or update on public.hw_submissions
  for each row execute function public.hw_on_returned();

-- 6. Files: families can open the files on their own children's assignments and work ---------

create or replace function public.hw_my_file_paths()
returns text[] language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(distinct f->>'path'), '{}')
  from (
    select jsonb_array_elements(a.files) f
    from public.hw_assignments a
    where public.hub_my_role() in ('parent', 'student') and a.grades && public.hw_child_grades()
    union all
    select jsonb_array_elements(s.files || case when s.status = 'returned' then s.feedback_files else '[]'::jsonb end)
    from public.hw_submissions s
    where public.hub_my_role() in ('parent', 'student') and public.hub_my_student_ids() ? s.hub_student_id
  ) x
$fn$;

revoke all on function public.hw_my_file_paths() from public, anon;
grant execute on function public.hw_my_file_paths() to authenticated;

drop policy if exists "Assignment files: families" on storage.objects;
create policy "Assignment files: families" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and name like 'assignments/%'
         and name = any (coalesce((select public.hw_my_file_paths()), '{}'::text[])));

-- 7. Copy the assignments already on the Hub (the old copy stays where it is) ---------------

insert into public.hw_assignments (legacy_id, title, description, subject, grades, due_date, link, files, created_by)
select a->>'id',
  coalesce(nullif(trim(a->>'title'), ''), 'Untitled'),
  nullif(a->>'description', ''),
  nullif(a->>'subject', ''),
  coalesce(array(select jsonb_array_elements_text(public.hub_arr(a->'grades'))), '{}'),
  case when a->>'dueDate' ~ '^\d{4}-\d{2}-\d{2}$' then (a->>'dueDate')::date end,
  nullif(a->>'link', ''),
  public.hub_arr(a->'files'),
  null
from jsonb_array_elements(public.hub_arr(
  (select value::jsonb->'assignments' from public.app_storage where key = 'brightsteps-hub-data' and shared = true))) a
where a->>'id' is not null
on conflict (legacy_id) do nothing;

insert into public.hw_submissions (assignment_id, student_id, hub_student_id, status, answer, files, handed_in_at)
select h.id, st.id, st.legacy_id, 'handed_in',
  nullif(sub.value->>'note', ''),
  public.hub_arr(sub.value->'files'),
  case when sub.value->>'date' ~ '^\d{4}-\d{2}-\d{2}$' then (sub.value->>'date')::date::timestamptz else now() end
from jsonb_array_elements(public.hub_arr(
  (select value::jsonb->'assignments' from public.app_storage where key = 'brightsteps-hub-data' and shared = true))) a
join public.hw_assignments h on h.legacy_id = a->>'id'
cross join lateral jsonb_each(public.hub_obj(a->'submissions')) sub
join public.students st on st.legacy_id = sub.key and st.grade = any(h.grades)
where coalesce(nullif(sub.value->>'note', ''), '') <> '' or jsonb_array_length(public.hub_arr(sub.value->'files')) > 0
on conflict (assignment_id, student_id) do nothing;

-- 8. Check ------------------------------------------------------------------------------------
select (select count(*) from public.hw_assignments) as assignments,
       (select count(*) from public.hw_submissions) as handed_in_work;
