-- BrightSteps Hub: staff deadlines (Oct 2026)
-- Run once in Supabase > SQL Editor, AFTER push-notifications.sql. Safe to run again. Deletes nothing.
--
-- What it does:
--   * Miss Myriam adds deadlines (title, due date, who it is for: teachers, or teachers and assistants).
--   * Each teacher sees them on their Dashboard card and presses "Mark as done".
--   * The admin card shows, for each deadline, who has done it and who has not.
--   * Reminders: every morning at 7:00, people who have not marked a deadline done get a bell
--     notice (and a phone notification, if they turned them on) and an email: 3 days before,
--     and on the day. The admin can also press "Remind" to remind only the people still pending.
--   * Emails are sent by the notify-deadline-reminders Edge Function. The database calls it
--     with the same private secret as the phone notifications: nobody has to copy any key.

-- 1. Tables --------------------------------------------------------------------------------------------

create table if not exists public.staff_deadlines (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 140),
  note text check (note is null or length(note) <= 500),
  due_date date not null,
  for_roles text[] not null default array['teacher']
    check (cardinality(for_roles) > 0 and for_roles <@ array['teacher', 'learning_assistant']),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists staff_deadlines_due on public.staff_deadlines (due_date);

create table if not exists public.staff_deadline_done (
  deadline_id uuid not null references public.staff_deadlines (id) on delete cascade,
  user_id uuid not null,
  done_at timestamptz not null default now(),
  primary key (deadline_id, user_id)
);

-- Every reminder sent (one per person, per deadline, per kind), so nobody is reminded twice
-- for the same thing and each email is sent once.
create table if not exists public.staff_deadline_reminders (
  id bigint generated always as identity primary key,
  deadline_id uuid not null references public.staff_deadlines (id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('soon', 'today', 'manual')),
  created_at timestamptz not null default now(),
  attempts int not null default 0,
  claimed_at timestamptz,
  emailed_at timestamptz
);
create unique index if not exists staff_deadline_reminders_once
  on public.staff_deadline_reminders (deadline_id, user_id, kind) where kind <> 'manual';

-- 2. Who can see and change what ---------------------------------------------------------------------

alter table public.staff_deadlines enable row level security;
alter table public.staff_deadline_done enable row level security;
alter table public.staff_deadline_reminders enable row level security;

drop policy if exists "Deadlines: admin and the staff they are for can read" on public.staff_deadlines;
create policy "Deadlines: admin and the staff they are for can read" on public.staff_deadlines
  for select to authenticated
  using (public.hub_my_role() = 'admin' or public.hub_my_role() = any(for_roles));

drop policy if exists "Deadlines: admin can change" on public.staff_deadlines;
create policy "Deadlines: admin can change" on public.staff_deadlines
  for all to authenticated
  using (public.hub_my_role() = 'admin')
  with check (public.hub_my_role() = 'admin');

drop policy if exists "Deadline done: own or admin can read" on public.staff_deadline_done;
create policy "Deadline done: own or admin can read" on public.staff_deadline_done
  for select to authenticated
  using (user_id = auth.uid() or public.hub_my_role() = 'admin');

drop policy if exists "Deadline done: mark my own" on public.staff_deadline_done;
create policy "Deadline done: mark my own" on public.staff_deadline_done
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.staff_deadlines d
                where d.id = deadline_id and public.hub_my_role() = any(d.for_roles))
  );

drop policy if exists "Deadline done: undo my own" on public.staff_deadline_done;
create policy "Deadline done: undo my own" on public.staff_deadline_done
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.staff_deadlines, public.staff_deadline_done, public.staff_deadline_reminders from anon;
revoke all on public.staff_deadline_reminders from authenticated;
grant select, insert, update, delete on public.staff_deadlines to authenticated;
grant select, insert, delete on public.staff_deadline_done to authenticated;

-- 3. The staff a deadline is for (admin card) -------------------------------------------------------

create or replace function public.staff_deadline_people()
returns table (id uuid, name text, role text)
language sql stable security definer set search_path = public as $fn$
  select p.id,
         coalesce((select d.display_name from public.staff_display_names d where d.user_id = p.id), p.full_name, 'Staff member'),
         p.role
  from public.profiles p
  where public.hub_my_role() = 'admin'
    and p.role in ('teacher', 'learning_assistant')
  order by 2
$fn$;
revoke all on function public.staff_deadline_people() from public, anon;
grant execute on function public.staff_deadline_people() to authenticated;

-- 4. Sending reminders ----------------------------------------------------------------------------

-- Calls the email function (same secret and address as the phone notifications).
create or replace function public.staff_deadline_kick()
returns void language plpgsql volatile security definer set search_path = public as $fn$
declare c record;
begin
  select secret, function_url into c from public.push_config where id = 1;
  if c.secret is null then return; end if;
  perform net.http_post(
    url := regexp_replace(c.function_url, '/push$', '/notify-deadline-reminders'),
    body := '{"action": "send"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', c.secret)
  );
end $fn$;

-- The bell notice for one reminder.
create or replace function public.staff_deadline_notice(p_deadline uuid, p_user uuid, p_kind text)
returns void language plpgsql volatile security definer set search_path = public as $fn$
declare
  d public.staff_deadlines;
  due text;
  t text;
  b text;
begin
  select * into d from public.staff_deadlines where id = p_deadline;
  if not found then return; end if;
  due := to_char(d.due_date, 'FMDay FMDD Mon');
  if p_kind = 'today' then
    t := 'Due today: ' || d.title;
    b := 'This deadline is today (' || due || '). Press Mark as done on your Dashboard when it is finished.';
  elsif p_kind = 'soon' then
    t := 'Deadline in 3 days: ' || d.title;
    b := 'Due ' || due || '. Press Mark as done on your Dashboard when it is finished.';
  elsif d.due_date < current_date then
    t := 'Reminder: ' || d.title;
    b := 'This was due ' || due || '. Please finish it and press Mark as done on your Dashboard.';
  else
    t := 'Reminder: ' || d.title;
    b := 'Due ' || due || '. Press Mark as done on your Dashboard when it is finished.';
  end if;
  insert into public.notifications (user_id, kind, title, body)
  values (p_user, 'staff_deadline', left(t, 120), left(b, 300));
end $fn$;

-- Every morning: 3 days before, and on the day, for everyone who has not marked it done.
create or replace function public.staff_deadline_daily()
returns int language plpgsql volatile security definer set search_path = public as $fn$
declare
  r record;
  n int := 0;
begin
  for r in
    with due as (
      select d.id, case when d.due_date = current_date then 'today' else 'soon' end as kind, d.for_roles
      from public.staff_deadlines d
      where d.due_date in (current_date, current_date + 3)
    )
    insert into public.staff_deadline_reminders (deadline_id, user_id, kind)
    select due.id, p.id, due.kind
    from due join public.profiles p on p.role = any(due.for_roles)
    where not exists (select 1 from public.staff_deadline_done x where x.deadline_id = due.id and x.user_id = p.id)
    on conflict (deadline_id, user_id, kind) where kind <> 'manual' do nothing
    returning deadline_id, user_id, kind
  loop
    perform public.staff_deadline_notice(r.deadline_id, r.user_id, r.kind);
    n := n + 1;
  end loop;
  if n > 0 then perform public.staff_deadline_kick(); end if;
  return n;
end $fn$;

-- The admin's "Remind" button: only the people still pending.
create or replace function public.staff_deadline_remind(p_id uuid)
returns int language plpgsql volatile security definer set search_path = public as $fn$
declare
  r record;
  n int := 0;
begin
  if public.hub_my_role() is distinct from 'admin' then raise exception 'Only the admin can send reminders'; end if;
  for r in
    insert into public.staff_deadline_reminders (deadline_id, user_id, kind)
    select d.id, p.id, 'manual'
    from public.staff_deadlines d join public.profiles p on p.role = any(d.for_roles)
    where d.id = p_id
      and not exists (select 1 from public.staff_deadline_done x where x.deadline_id = d.id and x.user_id = p.id)
    returning deadline_id, user_id, kind
  loop
    perform public.staff_deadline_notice(r.deadline_id, r.user_id, r.kind);
    n := n + 1;
  end loop;
  if n > 0 then perform public.staff_deadline_kick(); end if;
  return n;
end $fn$;

-- The email function takes the reminders not emailed yet (never the same one twice at once).
create or replace function public.staff_deadline_claim(p_limit int default 100)
returns table (id bigint, email text, name text, title text, note text, due_date date, kind text)
language sql volatile security definer set search_path = public as $fn$
  with c as (
    update public.staff_deadline_reminders r set claimed_at = now(), attempts = r.attempts + 1
    where r.id in (
      select x.id from public.staff_deadline_reminders x
      where x.emailed_at is null and x.attempts < 3 and x.created_at > now() - interval '1 day'
        and (x.claimed_at is null or x.claimed_at < now() - interval '2 minutes')
      order by x.id limit p_limit
      for update skip locked)
    returning r.*
  )
  select c.id, p.email,
         coalesce((select dn.display_name from public.staff_display_names dn where dn.user_id = p.id), p.full_name),
         d.title, d.note, d.due_date, c.kind
  from c join public.profiles p on p.id = c.user_id join public.staff_deadlines d on d.id = c.deadline_id
$fn$;

create or replace function public.staff_deadline_emailed(p_ids bigint[])
returns void language sql volatile security definer set search_path = public as $fn$
  update public.staff_deadline_reminders set emailed_at = now() where id = any(p_ids)
$fn$;

revoke all on function public.staff_deadline_kick(), public.staff_deadline_notice(uuid, uuid, text),
  public.staff_deadline_daily(), public.staff_deadline_claim(int), public.staff_deadline_emailed(bigint[]) from public, anon, authenticated;
revoke all on function public.staff_deadline_remind(uuid) from public, anon;
grant execute on function public.staff_deadline_remind(uuid) to authenticated;
grant execute on function public.staff_deadline_claim(int), public.staff_deadline_emailed(bigint[]) to service_role;

-- 5. Every morning at 7:00 (Abidjan time = UTC) ------------------------------------------------------

select cron.schedule('hub-deadline-reminders', '0 7 * * *', 'select public.staff_deadline_daily()');

-- 6. The first deadline, from the end of Term 1 plan ---------------------------------------------------

insert into public.staff_deadlines (title, note, due_date, for_roles)
select 'Submit final grades and comments', 'Term 1 report cards go out on Tuesday 8 December.', date '2026-12-02', array['teacher']
where not exists (select 1 from public.staff_deadlines where title = 'Submit final grades and comments' and due_date = date '2026-12-02');

-- 7. Check ------------------------------------------------------------------------------------------------
-- Should list the three tables, the schedule, the first deadline, and the teachers it is for.

select 'table' as what, table_name as detail from information_schema.tables
 where table_schema = 'public' and table_name in ('staff_deadlines', 'staff_deadline_done', 'staff_deadline_reminders')
union all
select 'schedule', jobname || ' · ' || schedule from cron.job where jobname = 'hub-deadline-reminders'
union all
select 'deadline', title || ' · due ' || to_char(due_date, 'Dy DD Mon') from public.staff_deadlines
union all
select 'reminded (teacher)', coalesce(full_name, email) from public.profiles where role = 'teacher'
order by 1, 2;

-- UNDO (only if something goes wrong):
-- select cron.unschedule('hub-deadline-reminders');
-- drop table if exists public.staff_deadline_reminders, public.staff_deadline_done, public.staff_deadlines;
