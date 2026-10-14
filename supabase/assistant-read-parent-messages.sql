-- BrightSteps Hub: learning assistants can read parents' messages (Oct 2026)
-- Run ONCE in Supabase > SQL Editor (paste the whole file, then Run). Safe to run again.
-- It does not change or delete any school data.
--
-- What it does: learning assistants now receive the parent-teacher message thread
-- for the students in their grades, read-only. They still cannot send, edit or
-- delete messages, and they still never see a Grade 3+ student's private thread.
-- Everything else this function does is unchanged from audit-fixes-2026-10.sql.

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
    -- Learning assistants can READ the parents' thread (messages) but not the
    -- Grade 3+ student's private thread. They still cannot change any message:
    -- hub_save keeps every thread field exactly as it was for them.
    if r = 'learning_assistant' then hidden := hidden || array['lastRead', 'studentMessages', 'studentLastRead']; end if;
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
