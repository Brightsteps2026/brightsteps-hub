-- BrightSteps Hub: weekly updates, part 2 (Oct 2026)
-- Run once in Supabase > SQL Editor, AFTER weekly-updates.sql. Safe to run again. Deletes nothing.
--
-- What it does:
--   * Only the class teacher (or the admin) can approve a note ("Looks good"). Assistants can enter
--     the topics, taps and highlights and write the AI draft, but not approve or send.
--   * Reminders on the Hub bell (and phone, when switched on), skipped on holidays and breaks:
--       - Wednesday 7:30: teachers and assistants of each class, "Start this week's weekly updates".
--       - Friday 12:00: the teachers of each class not sent yet, "Weekly updates are due today".
--       - Friday 17:00: the admin, the list of classes not sent yet.
--     Times are Abidjan time (= UTC).

-- 1. Only the class teacher or the admin approves a note -------------------------------------------

create or replace function public.weekly_guard_approve()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is not null
     and new.status = 'ready'
     and (tg_op = 'INSERT' or old.status is distinct from 'ready')
     and not public.weekly_can_send(new.grade) then
    raise exception 'Only the class teacher can approve a note';
  end if;
  return new;
end $fn$;

drop trigger if exists weekly_guard_approve on public.weekly_updates;
create trigger weekly_guard_approve before insert or update on public.weekly_updates
  for each row execute function public.weekly_guard_approve();

-- 2. Who works with a class ---------------------------------------------------------------------------

-- A list field of a profile as a JSON array (missing or empty = []).
create or replace function public.weekly_arr(v jsonb)
returns jsonb language sql immutable as $fn$
  select case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end
$fn$;

-- Teachers of a grade (not as an assistant there).
create or replace function public.weekly_teachers_of(p_grade text)
returns setof uuid language sql stable security definer set search_path = public as $fn$
  select p.id from public.profiles p
  where p.role = 'teacher'
    and (public.weekly_arr(to_jsonb(p)->'grades_assigned') ? p_grade or public.weekly_arr(to_jsonb(p)->'assigned_grades') ? p_grade)
    and not public.weekly_arr(to_jsonb(p)->'assistant_grades') ? p_grade
$fn$;

-- Assistants of a grade (learning assistants, or teachers who assist in that grade).
create or replace function public.weekly_assistants_of(p_grade text)
returns setof uuid language sql stable security definer set search_path = public as $fn$
  select p.id from public.profiles p
  where (p.role = 'learning_assistant'
         and (public.weekly_arr(to_jsonb(p)->'grades_assigned') ? p_grade
              or public.weekly_arr(to_jsonb(p)->'assistant_grades') ? p_grade
              or public.weekly_arr(to_jsonb(p)->'assigned_grades') ? p_grade))
     or (p.role = 'teacher' and public.weekly_arr(to_jsonb(p)->'assistant_grades') ? p_grade)
$fn$;

-- 3. The reminders ----------------------------------------------------------------------------------------

create or replace function public.weekly_staff_reminders(p_kind text)
returns integer language plpgsql volatile security definer set search_path = public as $fn$
declare
  wk date := date_trunc('week', current_date)::date;
  n integer := 0;
  late text;
begin
  -- No reminders on a holiday or a break.
  if public.staff_is_holiday(current_date) then return 0; end if;

  if p_kind = 'wednesday' then
    insert into public.notifications (user_id, kind, title, title_fr, body, body_fr)
    select distinct u, 'weekly_reminder',
      'Start this week''s weekly updates',
      'Start this week''s weekly updates',
      'You can already enter the topics, taps and highlights in Weekly updates. Nothing is sent until Friday.',
      'You can already enter the topics, taps and highlights in Weekly updates. Nothing is sent until Friday.'
    from (select distinct grade from public.students where grade is not null) g,
         lateral (select * from public.weekly_teachers_of(g.grade) union select * from public.weekly_assistants_of(g.grade)) t(u);
    get diagnostics n = row_count;

  elsif p_kind = 'friday' then
    insert into public.notifications (user_id, kind, title, title_fr, body, body_fr)
    select u, 'weekly_reminder',
      'Weekly updates are due today',
      'Weekly updates are due today',
      'Please check the notes and press Send for: ' || string_agg(grade, ', ' order by grade) || '.',
      'Please check the notes and press Send for: ' || string_agg(grade, ', ' order by grade) || '.'
    from (
      select g.grade, t.u
      from (select distinct grade from public.students where grade is not null) g,
           lateral public.weekly_teachers_of(g.grade) t(u)
      where not exists (select 1 from public.weekly_updates w where w.grade = g.grade and w.week_start = wk and w.status = 'sent')
    ) x
    group by u;
    get diagnostics n = row_count;

  elsif p_kind = 'late' then
    select string_agg(grade, ', ' order by grade) into late
    from (select distinct grade from public.students where grade is not null) g
    where not exists (select 1 from public.weekly_updates w where w.grade = g.grade and w.week_start = wk and w.status = 'sent');
    if late is not null then
      insert into public.notifications (user_id, kind, title, title_fr, body, body_fr)
      select p.id, 'weekly_reminder',
        'Weekly updates not sent this week',
        'Weekly updates not sent this week',
        'Not sent yet: ' || late || '.',
        'Not sent yet: ' || late || '.'
      from public.profiles p where p.role = 'admin';
      get diagnostics n = row_count;
    end if;
  end if;

  return n;
end $fn$;

revoke all on function public.weekly_staff_reminders(text), public.weekly_teachers_of(text), public.weekly_assistants_of(text)
  from public, anon, authenticated;

-- 4. Schedules (Abidjan time = UTC) ---------------------------------------------------------------------

do $do$
begin
  perform cron.unschedule(jobname) from cron.job
  where jobname in ('hub-weekly-wednesday', 'hub-weekly-friday', 'hub-weekly-late');
end $do$;

select cron.schedule('hub-weekly-wednesday', '30 7 * * 3', $$select public.weekly_staff_reminders('wednesday')$$);
select cron.schedule('hub-weekly-friday', '0 12 * * 5', $$select public.weekly_staff_reminders('friday')$$);
select cron.schedule('hub-weekly-late', '0 17 * * 5', $$select public.weekly_staff_reminders('late')$$);

-- 5. Check ------------------------------------------------------------------------------------------------
-- Should list the approval rule and the three schedules.

select 'approval rule' as what, tgname as detail from pg_trigger where tgname = 'weekly_guard_approve'
union all
select 'schedule', jobname || ' · ' || schedule from cron.job
where jobname in ('hub-weekly-wednesday', 'hub-weekly-friday', 'hub-weekly-late')
order by 1, 2;

-- UNDO (only if something goes wrong):
-- select cron.unschedule('hub-weekly-wednesday'); select cron.unschedule('hub-weekly-friday'); select cron.unschedule('hub-weekly-late');
-- drop trigger if exists weekly_guard_approve on public.weekly_updates;
