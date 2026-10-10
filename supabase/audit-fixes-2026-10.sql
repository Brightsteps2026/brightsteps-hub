-- BrightSteps Hub: privacy and security fixes from the October 2026 audit
-- Run ONCE in Supabase > SQL Editor (paste the whole file, then Run). Safe to run again.
-- It does not delete any school data.
--
-- What it does:
--   1. School data table: closes the old "Allow all ... for now" rules (if still there),
--      so nobody can read or change the school data without the Hub's checks.
--      The login-screen logo stays readable; only the admin can change it.
--   2. Profiles: nobody except the admin can change a role, grades, linked children,
--      canteen balance or limited access - not even on their own account.
--      Adds "limited_access".
--   3. What each person receives from the school data:
--        - Parents: only what concerns their own children (no other families' fees,
--          no staff-only documents, plans, accreditation or admissions).
--        - Students: their own records and their OWN private thread with teachers,
--          never their parents' messages.
--        - Teachers: only the students in their grades, without parent contacts or
--          medical details. Learning assistants also get no message threads.
--        - Accountant: student names and grades, billing and fees only.
--   4. What each person can change when they save:
--        - Teachers / assistants: only their own grades' students and records;
--          settings, billing, fees, admissions, staff and the lunch menu stay as they were.
--        - Accountant: only billing and fees.
--        - Parents / students: can only ADD messages in their own thread (no editing
--          other people's messages); the sender name and role are set by the database.
--   5. Absence notes: teachers and assistants only see their own grades' absences.
--   6. Photos and attachments: only the person who uploaded a file (or the admin)
--      can delete it.
--   7. Phone calendar links: the admin can make new links (old ones stop working).
--   8. Lunch menu: the admin can send parents a bell notice when the menu changes.

-- 1. School data table rules ----------------------------------------------------

drop policy if exists "Allow all reads for now" on public.app_storage;
drop policy if exists "Allow all writes for now" on public.app_storage;
drop policy if exists "Allow all updates for now" on public.app_storage;
drop policy if exists "Allow all deletes for now" on public.app_storage;
drop policy if exists "Signed in users can read (school data admin only)" on public.app_storage;
drop policy if exists "Signed in users can update (school data admin only)" on public.app_storage;
drop policy if exists "Signed in users can insert (school data admin only)" on public.app_storage;
drop policy if exists "app_storage read" on public.app_storage;
drop policy if exists "app_storage insert" on public.app_storage;
drop policy if exists "app_storage update" on public.app_storage;
drop policy if exists "app_storage delete" on public.app_storage;
drop policy if exists "app_storage logo read" on public.app_storage;
drop policy if exists "Anyone can read the public logo" on public.app_storage;
drop policy if exists "Only admins can delete storage" on public.app_storage;

alter table public.app_storage enable row level security;

-- Anyone (even before signing in) may read the login-screen logo, and nothing else.
create policy "app_storage logo read" on public.app_storage for select to anon
  using (key = 'brightsteps-hub-logo');

-- Signed in: the logo, your own personal rows, or everything for the admin.
create policy "app_storage read" on public.app_storage for select to authenticated
  using (key = 'brightsteps-hub-logo' or key like auth.uid()::text || ':%' or public.hub_my_role() = 'admin');
create policy "app_storage insert" on public.app_storage for insert to authenticated
  with check (key like auth.uid()::text || ':%' or public.hub_my_role() = 'admin');
create policy "app_storage update" on public.app_storage for update to authenticated
  using (key like auth.uid()::text || ':%' or public.hub_my_role() = 'admin')
  with check (key like auth.uid()::text || ':%' or public.hub_my_role() = 'admin');
create policy "app_storage delete" on public.app_storage for delete to authenticated
  using ((key like auth.uid()::text || ':%') or (public.hub_my_role() = 'admin' and key <> 'brightsteps-hub-data'));

revoke all on public.app_storage from anon;
grant select on public.app_storage to anon;

-- 2. Profiles: protect roles, grades and linked children -----------------------

alter table public.profiles add column if not exists limited_access boolean not null default false;

-- The teacher whose Hub menu was limited in the code (moved here from the code).
update public.profiles p set limited_access = true
from auth.users u
where u.id = p.id and lower(u.email) = 'thairy.ekellem@bischoolci.org' and not p.limited_access;

-- (Not "security definer": it must see who is really making the change.)
create or replace function public.hub_guard_profile()
returns trigger language plpgsql set search_path = public as $fn$
declare
  -- What people may change on their own profile from the Hub.
  allowed text[] := array['full_name', 'phone', 'nationality', 'password_changed', 'updated_at'];
begin
  -- Only checks changes made directly from the Hub (not by the database's own
  -- functions, the SQL Editor or the email/alert functions).
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.hub_my_role() = 'admin' then return new; end if;
  if new.id is distinct from auth.uid() then
    raise exception 'You can only change your own profile';
  end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'Only the school can change roles, grades or linked children';
  end if;
  return new;
end $fn$;

drop trigger if exists hub_guard_profile on public.profiles;
create trigger hub_guard_profile before update on public.profiles
  for each row execute function public.hub_guard_profile();

create or replace function public.hub_guard_profile_insert()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.hub_my_role() = 'admin' then return new; end if;
  raise exception 'Only the school can create accounts';
end $fn$;

drop trigger if exists hub_guard_profile_insert on public.profiles;
create trigger hub_guard_profile_insert before insert on public.profiles
  for each row execute function public.hub_guard_profile_insert();

-- 3. Helpers -----------------------------------------------------------------------

-- Grades of the signed-in teacher or learning assistant (their own + assisting).
create or replace function public.hub_my_grades()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare p jsonb;
begin
  p := (select to_jsonb(x) from public.profiles x where x.id = auth.uid());
  if p is null then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(distinct g), '[]'::jsonb)
    from (
      select jsonb_array_elements_text(case when jsonb_typeof(p->'grades_assigned') = 'array' then p->'grades_assigned' else '[]'::jsonb end) g
      union
      select jsonb_array_elements_text(case when jsonb_typeof(p->'assistant_grades') = 'array' then p->'assistant_grades' else '[]'::jsonb end)
      union
      select jsonb_array_elements_text(case when jsonb_typeof(p->'assigned_grades') = 'array' then p->'assigned_grades' else '[]'::jsonb end)
    ) t
  );
end $fn$;

-- Ids of the students (in this copy of the data) whose grade is in grades.
create or replace function public.hub_ids_in_grades(students jsonb, grades jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce(jsonb_agg(s->>'id'), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(students) = 'array' then students else '[]'::jsonb end) s
  where grades ? (s->>'grade')
$fn$;

create or replace function public.hub_arr(v jsonb)
returns jsonb language sql immutable as $fn$
  select case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end
$fn$;

create or replace function public.hub_obj(v jsonb)
returns jsonb language sql immutable as $fn$
  select case when jsonb_typeof(v) = 'object' then v else '{}'::jsonb end
$fn$;

-- Does a record (portfolio entry, report, mark...) belong to these students / grades?
-- Records for one student go by the student; records without a student go by their grade.
create or replace function public.hub_in_scope(item jsonb, ids jsonb, grades jsonb)
returns boolean language sql immutable as $fn$
  select case
    when coalesce(item->>'studentId', '') <> '' then ids ? (item->>'studentId')
    when coalesce(item->>'grade', '') <> '' then grades ? (item->>'grade')
    else false end
$fn$;

create or replace function public.hub_filter_scope(items jsonb, ids jsonb, grades jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce(jsonb_agg(x order by o), '[]'::jsonb)
  from jsonb_array_elements(public.hub_arr(items)) with ordinality t(x, o)
  where public.hub_in_scope(x, ids, grades)
$fn$;

-- On save: records outside the scope stay exactly as they were; inside the scope,
-- what was sent is kept (so adding, editing and removing still work).
create or replace function public.hub_merge_scope(old_items jsonb, new_items jsonb, ids jsonb, grades jsonb)
returns jsonb language sql immutable as $fn$
  with outside as (
    select x, o from jsonb_array_elements(public.hub_arr(old_items)) with ordinality t(x, o)
    where not public.hub_in_scope(x, ids, grades)
  )
  select coalesce((select jsonb_agg(x order by o) from outside), '[]'::jsonb)
      || coalesce((
        select jsonb_agg(x order by o)
        from jsonb_array_elements(public.hub_arr(new_items)) with ordinality t(x, o)
        where public.hub_in_scope(x, ids, grades)
          and not exists (select 1 from outside where outside.x->>'id' = t.x->>'id')
      ), '[]'::jsonb)
$fn$;

-- Attendance is { "2026-10-10": { "<student id>": "present", ... }, ... }
create or replace function public.hub_att_filter(att jsonb, ids jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce(jsonb_object_agg(day.key, coalesce((
      select jsonb_object_agg(st.key, st.value) from jsonb_each(public.hub_obj(day.value)) st where ids ? st.key
    ), '{}'::jsonb)), '{}'::jsonb)
  from jsonb_each(public.hub_obj(att)) day
$fn$;

create or replace function public.hub_att_merge(old_att jsonb, new_att jsonb, ids jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce(jsonb_object_agg(d.day,
      coalesce((select jsonb_object_agg(st.key, st.value) from jsonb_each(public.hub_obj(public.hub_obj(old_att)->d.day)) st where not (ids ? st.key)), '{}'::jsonb)
   || coalesce((select jsonb_object_agg(st.key, st.value) from jsonb_each(public.hub_obj(public.hub_obj(new_att)->d.day)) st where ids ? st.key), '{}'::jsonb)
  ), '{}'::jsonb)
  from (select jsonb_object_keys(public.hub_obj(old_att)) as day union select jsonb_object_keys(public.hub_obj(new_att))) d
$fn$;

-- Assignments keep their submissions in { "<student id>": {...} }
create or replace function public.hub_subs_filter(assignments jsonb, ids jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce(jsonb_agg(a || jsonb_build_object('submissions', coalesce((
      select jsonb_object_agg(s.key, s.value) from jsonb_each(public.hub_obj(a->'submissions')) s where ids ? s.key
    ), '{}'::jsonb)) order by o), '[]'::jsonb)
  from jsonb_array_elements(public.hub_arr(assignments)) with ordinality t(a, o)
$fn$;

create or replace function public.hub_subs_merge(old_list jsonb, new_list jsonb, ids jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce(jsonb_agg(n || jsonb_build_object('submissions',
      coalesce((select jsonb_object_agg(s.key, s.value)
                from jsonb_each(public.hub_obj((select x->'submissions' from jsonb_array_elements(public.hub_arr(old_list)) x where x->>'id' = n->>'id' limit 1))) s
                where not (ids ? s.key)), '{}'::jsonb)
   || coalesce((select jsonb_object_agg(s.key, s.value) from jsonb_each(public.hub_obj(n->'submissions')) s where ids ? s.key), '{}'::jsonb)
  ) order by o), '[]'::jsonb)
  from jsonb_array_elements(public.hub_arr(new_list)) with ordinality t(n, o)
$fn$;

-- A message thread that families can only add to. Their new messages are stamped
-- with their own name, role and account; they may remove only their own messages.
create or replace function public.hub_thread_merge(old_msgs jsonb, new_msgs jsonb, my_role text)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  me text := auth.uid()::text;
  my_name text := coalesce((select full_name from public.profiles where id = auth.uid()), 'Parent');
  kept jsonb;
  added jsonb;
begin
  -- Everything already in the thread stays, except their own messages they removed.
  kept := coalesce((
    select jsonb_agg(m order by o) from jsonb_array_elements(public.hub_arr(old_msgs)) with ordinality t(m, o)
    where coalesce(m->>'authorId', '') <> me
       or exists (select 1 from jsonb_array_elements(public.hub_arr(new_msgs)) n where n->>'id' = m->>'id')
  ), '[]'::jsonb);
  -- New messages (ids not seen before), stamped by the database. At most 20 per save.
  added := coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', n->>'id',
        'author', my_name,
        'authorId', me,
        'role', my_role,
        'text', left(coalesce(n->>'text', ''), 4000),
        'date', coalesce(n->>'date', to_char(now(), 'YYYY-MM-DD')),
        'createdAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ) order by o)
    from (
      select n, o from jsonb_array_elements(public.hub_arr(new_msgs)) with ordinality t(n, o)
      where coalesce(n->>'id', '') <> ''
        and coalesce(trim(n->>'text'), '') <> ''
        and not exists (select 1 from jsonb_array_elements(public.hub_arr(old_msgs)) m where m->>'id' = n->>'id')
      order by o limit 20
    ) x
  ), '[]'::jsonb);
  return kept || added;
end $fn$;

-- Student fields teachers and learning assistants must not receive.
create or replace function public.hub_hidden_student_fields()
returns text[] language sql immutable as $fn$
  select array[
    'guardian1Name','guardian1Relationship','guardian1Phone','guardian1Email',
    'guardian2Name','guardian2Relationship','guardian2Phone','guardian2Email',
    'guardianName','guardianContact','parentContact','parentEmail','parentPhone',
    'medicalConditions','emergencyContactName','emergencyContactPhone','emergencyContactRelationship',
    'homeAddress','previousSchool'
  ]
$fn$;

-- The two message threads on a student.
create or replace function public.hub_thread_fields()
returns text[] language sql immutable as $fn$
  select array['messages', 'lastRead', 'studentMessages', 'studentLastRead']
$fn$;

-- 4. What each person receives -------------------------------------------------------

create or replace function public.hub_trim(full_data jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  r text := public.hub_my_role();
  ids jsonb;
  grades jsonb;
  d jsonb := full_data;
  kids jsonb;
  kid_grades jsonb;
  hidden text[] := public.hub_hidden_student_fields();
begin
  if r in ('admin', 'viewer') then
    return d;
  end if;

  if r = 'accountant' then
    return jsonb_build_object(
      'settings', d->'settings',
      'students', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', s->'id', 'name', s->'name', 'firstName', s->'firstName', 'middleName', s->'middleName',
          'lastName', s->'lastName', 'grade', s->'grade', 'studentIdNumber', s->'studentIdNumber', 'photo', s->'photo')))
        from jsonb_array_elements(public.hub_arr(d->'students')) s), '[]'::jsonb),
      'billing', public.hub_arr(d->'billing'),
      'feeSchedule', public.hub_arr(d->'feeSchedule'),
      'events', public.hub_arr(d->'events'),
      'lunchMenu', d->'lunchMenu'
    );
  end if;

  if r in ('teacher', 'learning_assistant') then
    grades := public.hub_my_grades();
    ids := public.hub_ids_in_grades(d->'students', grades);
    if r = 'learning_assistant' then hidden := hidden || public.hub_thread_fields(); end if;
    d := d || jsonb_build_object(
      'students', coalesce((
        select jsonb_agg(s - hidden order by o)
        from jsonb_array_elements(public.hub_arr(d->'students')) with ordinality t(s, o)
        where ids ? (s->>'id')), '[]'::jsonb),
      'portfolio', public.hub_filter_scope(d->'portfolio', ids, grades),
      'assessments', public.hub_filter_scope(d->'assessments', ids, grades),
      'gradeEntries', public.hub_filter_scope(d->'gradeEntries', ids, grades),
      'reports', public.hub_filter_scope(d->'reports', ids, grades),
      'attendance', public.hub_att_filter(d->'attendance', ids),
      'assignments', public.hub_subs_filter(d->'assignments', ids),
      'billing', '[]'::jsonb, 'feeSchedule', '[]'::jsonb, 'admissions', '[]'::jsonb,
      'staff', '[]'::jsonb, 'activityLog', '[]'::jsonb,
      'accreditation', '{"milestones": [], "checklist": []}'::jsonb
    );
    return d;
  end if;

  if r in ('parent', 'student') then
    ids := public.hub_my_student_ids();
    kids := coalesce((
      select jsonb_agg(
        case when r = 'student' then s - array['messages', 'lastRead'] else s - array['studentMessages', 'studentLastRead'] end
        order by o)
      from jsonb_array_elements(public.hub_arr(d->'students')) with ordinality t(s, o)
      where ids ? (s->>'id')), '[]'::jsonb);
    kid_grades := coalesce((select jsonb_agg(distinct s->>'grade') from jsonb_array_elements(kids) s), '[]'::jsonb);
    -- Only these items are sent; anything else (and anything added in future) stays at school.
    return jsonb_build_object(
      'settings', d->'settings',
      'students', kids,
      'portfolio', public.hub_only_mine(d->'portfolio', ids),
      'assessments', public.hub_only_mine(d->'assessments', ids),
      'gradeEntries', public.hub_only_mine(d->'gradeEntries', ids),
      'reports', public.hub_only_mine(d->'reports', ids),
      'billing', public.hub_only_mine(d->'billing', ids),
      'feeSchedule', public.hub_only_mine(d->'feeSchedule', ids),
      'attendance', public.hub_att_filter(d->'attendance', ids),
      'events', public.hub_arr(d->'events'),
      'lunchMenu', d->'lunchMenu',
      'rubrics', public.hub_arr(d->'rubrics'),
      'standards', public.hub_arr(d->'standards'),
      'announcements', coalesce((
        select jsonb_agg(a order by o) from jsonb_array_elements(public.hub_arr(d->'announcements')) with ordinality t(a, o)
        where jsonb_array_length(public.hub_arr(a->'grades')) = 0
           or exists (select 1 from jsonb_array_elements_text(public.hub_arr(a->'grades')) g where kid_grades ? g)), '[]'::jsonb),
      'resources', coalesce((
        select jsonb_agg(res || jsonb_build_object('signatures', coalesce((
          select jsonb_agg(sig) from jsonb_array_elements(public.hub_arr(res->'signatures')) sig
          where sig->>'parentId' = auth.uid()::text), '[]'::jsonb)) order by o)
        from jsonb_array_elements(public.hub_arr(d->'resources')) with ordinality t(res, o)
        where coalesce((res->>'visibleToParents')::boolean, false)), '[]'::jsonb),
      'assignments', coalesce((
        select jsonb_agg(a order by o)
        from jsonb_array_elements(public.hub_subs_filter(d->'assignments', ids)) with ordinality t(a, o)
        where jsonb_array_length(public.hub_arr(a->'grades')) = 0
           or exists (select 1 from jsonb_array_elements_text(public.hub_arr(a->'grades')) g where kid_grades ? g)
           or kid_grades ? (a->>'grade')), '[]'::jsonb)
    );
  end if;

  -- Unknown or missing role: nothing.
  return '{}'::jsonb;
end $fn$;

-- 5. What each person can change when they save ---------------------------------------
-- (The Hub calls save_hub_data, which checks calendar events and behaviour notes,
-- then this function.)

create or replace function public.save_hub_data_core(new_value text)
returns void language plpgsql volatile security definer set search_path = public as $fn$
declare
  r text := public.hub_my_role();
  ids jsonb := public.hub_my_student_ids();
  grades jsonb;
  old_d jsonb;
  new_d jsonb := new_value::jsonb;
  result jsonb;
  keep_fields text[];
  old_log_ids jsonb;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if r is null or r = 'viewer' then raise exception 'This account cannot save changes'; end if;
  if jsonb_typeof(new_d) is distinct from 'object' then raise exception 'Bad data'; end if;

  perform 1 from public.app_storage where key = 'brightsteps-hub-data' and shared = true for update;
  old_d := (select value::jsonb from public.app_storage where key = 'brightsteps-hub-data' and shared = true);

  if old_d is null then
    if r <> 'admin' then raise exception 'No school data yet'; end if;
    result := new_d;

  elsif r = 'admin' then
    result := new_d;

  elsif r = 'accountant' then
    result := old_d || jsonb_build_object(
      'billing', public.hub_arr(new_d->'billing'),
      'feeSchedule', public.hub_arr(new_d->'feeSchedule'));

  elsif r in ('teacher', 'learning_assistant') then
    grades := public.hub_my_grades();
    ids := public.hub_ids_in_grades(old_d->'students', grades);
    keep_fields := public.hub_hidden_student_fields();
    if r = 'learning_assistant' then keep_fields := keep_fields || public.hub_thread_fields(); end if;

    result := new_d || jsonb_build_object(
      -- Students: their own grades' students from what was sent (with hidden details
      -- put back); every other student exactly as before. Nobody is removed here.
      'students',
        coalesce((
          select jsonb_agg(
            case
              when not (ids ? (o->>'id')) or n is null then o
              else n || coalesce((select jsonb_object_agg(k.key, k.value) from jsonb_each(o) k where k.key = any(keep_fields)), '{}'::jsonb)
                     - coalesce((select array_agg(f) from unnest(keep_fields) f where not (o ? f)), '{}'::text[])
            end order by oo)
          from jsonb_array_elements(public.hub_arr(old_d->'students')) with ordinality t(o, oo)
          left join lateral (select y as n from jsonb_array_elements(public.hub_arr(new_d->'students')) y where y->>'id' = o->>'id' limit 1) nn on true
        ), '[]'::jsonb)
        -- New students, only in their own grades.
        || coalesce((
          select jsonb_agg(y - keep_fields) from jsonb_array_elements(public.hub_arr(new_d->'students')) y
          where grades ? (y->>'grade')
            and not exists (select 1 from jsonb_array_elements(public.hub_arr(old_d->'students')) x where x->>'id' = y->>'id')
        ), '[]'::jsonb),
      'portfolio', public.hub_merge_scope(old_d->'portfolio', new_d->'portfolio', ids, grades),
      'assessments', public.hub_merge_scope(old_d->'assessments', new_d->'assessments', ids, grades),
      'gradeEntries', public.hub_merge_scope(old_d->'gradeEntries', new_d->'gradeEntries', ids, grades),
      'reports', public.hub_merge_scope(old_d->'reports', new_d->'reports', ids, grades),
      'attendance', public.hub_att_merge(old_d->'attendance', new_d->'attendance', ids),
      'assignments', public.hub_subs_merge(old_d->'assignments', new_d->'assignments', ids),
      -- Office and admin areas never change from a teacher's save.
      'settings', old_d->'settings',
      'billing', public.hub_arr(old_d->'billing'),
      'feeSchedule', public.hub_arr(old_d->'feeSchedule'),
      'admissions', public.hub_arr(old_d->'admissions'),
      'staff', public.hub_arr(old_d->'staff'),
      'accreditation', coalesce(old_d->'accreditation', '{"milestones": [], "checklist": []}'::jsonb),
      'lunchMenu', old_d->'lunchMenu'
    );
    -- Keys the teacher never received stay as they were.
    result := jsonb_strip_nulls(result) || coalesce((
      select jsonb_object_agg(k.key, k.value) from jsonb_each(old_d) k where not (new_d ? k.key)), '{}'::jsonb);

  elsif r in ('parent', 'student') then
    -- Start from the real data and apply only what they may change.
    result := old_d;
    result := jsonb_set(result, '{students}', coalesce((
      select jsonb_agg(
        case
          when ids ? (o->>'id') and n is not null and r = 'parent' then
            o || jsonb_build_object(
              'messages', public.hub_thread_merge(o->'messages', n->'messages', 'parent'),
              'lastRead', public.hub_obj(o->'lastRead') || jsonb_build_object(auth.uid()::text, coalesce(public.hub_obj(n->'lastRead')->(auth.uid()::text), public.hub_obj(o->'lastRead')->(auth.uid()::text))))
          when ids ? (o->>'id') and n is not null and r = 'student' then
            o || jsonb_build_object(
              'studentMessages', public.hub_thread_merge(o->'studentMessages', n->'studentMessages', 'student'),
              'studentLastRead', public.hub_obj(o->'studentLastRead') || jsonb_build_object(auth.uid()::text, coalesce(public.hub_obj(n->'studentLastRead')->(auth.uid()::text), public.hub_obj(o->'studentLastRead')->(auth.uid()::text))))
          else o end order by oo)
      from jsonb_array_elements(public.hub_arr(old_d->'students')) with ordinality t(o, oo)
      left join lateral (select y as n from jsonb_array_elements(public.hub_arr(new_d->'students')) y where y->>'id' = o->>'id' limit 1) nn on true
    ), '[]'::jsonb));
    -- Remove empty "last read" entries left by the line above.
    result := jsonb_set(result, '{students}', coalesce((
      select jsonb_agg(jsonb_strip_nulls(s) order by o) from jsonb_array_elements(result->'students') with ordinality t(s, o)), '[]'::jsonb));
    -- Their own signatures on documents
    result := jsonb_set(result, '{resources}', coalesce((
      select jsonb_agg(res || jsonb_build_object('signatures',
        coalesce((select jsonb_agg(sig) from jsonb_array_elements(public.hub_arr(res->'signatures')) sig where sig->>'parentId' is distinct from auth.uid()::text), '[]'::jsonb)
        || coalesce((select jsonb_agg(sig || jsonb_build_object('parentId', auth.uid()::text))
                     from jsonb_array_elements(public.hub_arr(nres->'signatures')) sig where sig->>'parentId' = auth.uid()::text), '[]'::jsonb))
        order by r_ord)
      from jsonb_array_elements(public.hub_arr(old_d->'resources')) with ordinality as t(res, r_ord)
      left join lateral (select z as nres from jsonb_array_elements(public.hub_arr(new_d->'resources')) z where z->>'id' = res->>'id' limit 1) nr on true
    ), '[]'::jsonb));
    if r = 'student' then
      -- Their own portfolio reflections and assignment work
      result := jsonb_set(result, '{portfolio}',
        coalesce((select jsonb_agg(p) from jsonb_array_elements(public.hub_arr(old_d->'portfolio')) p where not (ids ? (p->>'studentId'))), '[]'::jsonb)
        || public.hub_only_mine(new_d->'portfolio', ids));
      result := jsonb_set(result, '{assignments}', coalesce((
        select jsonb_agg(a || jsonb_build_object('submissions',
          coalesce((select jsonb_object_agg(s.key, s.value) from jsonb_each(public.hub_obj(a->'submissions')) s where not (ids ? s.key)), '{}'::jsonb)
          || coalesce((select jsonb_object_agg(s.key, s.value) from jsonb_each(public.hub_obj(na->'submissions')) s where ids ? s.key), '{}'::jsonb))
          order by a_ord)
        from jsonb_array_elements(public.hub_arr(old_d->'assignments')) with ordinality as t(a, a_ord)
        left join lateral (select w as na from jsonb_array_elements(public.hub_arr(new_d->'assignments')) w where w->>'id' = a->>'id' limit 1) nx on true
      ), '[]'::jsonb));
    end if;

  else
    raise exception 'This account cannot save changes';
  end if;

  -- Activity log: new entries from anyone are added to the real log (last 500 kept).
  if r <> 'admin' and old_d is not null then
    old_log_ids := coalesce((select jsonb_agg(e->'id') from jsonb_array_elements(public.hub_arr(old_d->'activityLog')) e), '[]'::jsonb);
    result := jsonb_set(result, '{activityLog}', (
      select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) from (
        select e, ord from (
          select e, row_number() over () as ord from (
            select e from jsonb_array_elements(public.hub_arr(old_d->'activityLog')) e
            union all
            select e from jsonb_array_elements(public.hub_arr(new_d->'activityLog')) e where not (old_log_ids @> jsonb_build_array(e->'id'))
          ) all_e
        ) numbered
        order by ord desc limit 500
      ) last500));
  end if;

  insert into public.app_storage (key, value, shared, updated_at)
  values ('brightsteps-hub-data', result::text, true, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $fn$;

revoke all on function public.save_hub_data_core(text) from public, anon, authenticated;
revoke all on function public.hub_thread_merge(jsonb, jsonb, text) from public, anon, authenticated;

-- 6. Absence notes: teachers and assistants see their own grades only --------------------

drop policy if exists "Parents see their own reports, staff see all" on public.absence_reports;
drop policy if exists "Absence reports: who can read" on public.absence_reports;
create policy "Absence reports: who can read" on public.absence_reports
  for select to authenticated
  using (
    reported_by = auth.uid()
    or public.hub_my_role() in ('admin', 'viewer')
    or (public.hub_my_role() in ('teacher', 'learning_assistant') and public.hub_my_grades() ? grade)
  );

-- 6b. School announcements: each person only receives the ones meant for them ----------

create or replace function public.hub_can_see_announcement(p_audience text, p_show_staff boolean)
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare r text := public.hub_my_role();
begin
  if r in ('admin', 'viewer') then return true; end if;
  if r in ('teacher', 'learning_assistant', 'accountant') then return coalesce(p_show_staff, true); end if;
  if r in ('parent', 'student') then
    if p_audience is null or p_audience in ('', 'school') then return true; end if;
    return exists (
      select 1 from public.students st
      where public.hub_my_student_ids() ? st.legacy_id
        and (st.grade = p_audience
          or (p_audience = 'lower' and st.grade in ('Pre-N','PreK','Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5'))
          or (p_audience = 'upper' and st.grade in ('Grade 6','Grade 7'))));
  end if;
  return false;
end $fn$;

drop policy if exists "read announcements" on public.announcements;
create policy "read announcements" on public.announcements for select to authenticated
  using (public.hub_can_see_announcement(audience, show_staff));

-- 7. Photos and attachments --------------------------------------------------------------

drop policy if exists "Authenticated can delete attachments" on storage.objects;
drop policy if exists "Authenticated can upload attachments" on storage.objects;
drop policy if exists "Attachments: uploader or admin can delete" on storage.objects;
drop policy if exists "Attachments: signed in can upload" on storage.objects;

create policy "Attachments: signed in can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and public.hub_my_role() is not null and public.hub_my_role() <> 'viewer');

create policy "Attachments: uploader or admin can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (owner = auth.uid() or public.hub_my_role() = 'admin'));

-- 8. Phone calendar links: admin can make new ones --------------------------------------

create or replace function public.rotate_calendar_feeds()
returns void language plpgsql volatile security definer set search_path = public as $fn$
begin
  if public.hub_my_role() <> 'admin' then raise exception 'Only the admin can do this'; end if;
  update public.calendar_feeds set token = gen_random_uuid(), created_at = now();
end $fn$;
revoke all on function public.rotate_calendar_feeds() from public, anon;
grant execute on function public.rotate_calendar_feeds() to authenticated;

-- 9. Lunch menu bell notice for parents -------------------------------------------------

create or replace function public.notify_lunch_menu(p_week text default null)
returns integer language plpgsql volatile security definer set search_path = public as $fn$
declare n integer;
begin
  if public.hub_my_role() <> 'admin' then raise exception 'Only the admin can do this'; end if;
  insert into public.notifications (user_id, kind, title, title_fr, body, body_fr)
  select p.id, 'lunch_menu',
    'Lunch menu updated',
    'Menu de la cantine mis à jour',
    'The lunch menu' || coalesce(' for the week of ' || to_char(p_week::date, 'FMDD FMMonth YYYY'), '') || ' is on your dashboard.',
    'Le menu de la cantine' || coalesce(' de la semaine du ' || to_char(p_week::date, 'FMDD') || ' ' ||
      (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from p_week::date)::int]
      || ' ' || to_char(p_week::date, 'YYYY'), '') || ' est sur votre tableau de bord.'
  from public.profiles p where p.role = 'parent';
  get diagnostics n = row_count;
  return n;
end $fn$;
revoke all on function public.notify_lunch_menu(text) from public, anon;
grant execute on function public.notify_lunch_menu(text) to authenticated;

-- 10. Check -------------------------------------------------------------------------------
select 'app_storage rule' as what, policyname as detail from pg_policies where schemaname = 'public' and tablename = 'app_storage'
union all
select 'profiles protection', tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname like 'hub_guard%'
union all
select 'storage rule', policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
union all
select 'limited access', coalesce(full_name, '?') from public.profiles where limited_access
order by 1, 2;
