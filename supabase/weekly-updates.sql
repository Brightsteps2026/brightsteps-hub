-- BrightSteps Hub: weekly child updates (Oct 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
-- What it does:
--   * weekly_class_notes: the part written once per class and week (Math / ELA / Unit topics,
--     an idea to try at home, reminders), with its French translation.
--   * weekly_updates: one row per child and week: Math and ELA taps, three learning-habit taps
--     (participation, behavior and school values, effort), an optional highlight, the note in
--     English and French, attendance for the week, and the family's read confirmation.
--   * Who sees what: admin and viewer see every class; teachers and assistants see their own
--     grades; a family sees only its own child's updates, and only once they are sent.
--   * Only the admin or the class teacher can send (assistants can fill in the taps).
--     Sending gives each family a bell notice (and a phone notification when switched on).
--   * Families confirm they have read it; the confirmation (who, when, note) is kept.

-- 1. Tables ------------------------------------------------------------------------------------------

create table if not exists public.weekly_class_notes (
  grade text not null,
  week_start date not null,
  math_topic text,
  ela_topic text,
  uoi_topic text,
  home_idea text,
  reminders text,
  fr jsonb,
  coming_up jsonb,
  sent_at timestamptz,
  sent_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (grade, week_start)
);

create table if not exists public.weekly_updates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  hub_student_id text,
  grade text not null,
  week_start date not null,
  math text check (math in ('needs_support','practicing','confident','further')),
  ela text check (ela in ('needs_support','practicing','confident','further')),
  participation text check (participation in ('sometimes','usually','always')),
  behavior text check (behavior in ('sometimes','usually','always')),
  effort text check (effort in ('sometimes','usually','always')),
  highlight text,
  note_en text,
  note_fr text,
  attendance jsonb,
  status text not null default 'draft' check (status in ('draft','ready','sent')),
  sent_at timestamptz,
  emailed_at timestamptz,
  ack_at timestamptz,
  ack_by uuid references public.profiles(id),
  ack_note text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (student_id, week_start)
);

create index if not exists weekly_updates_grade_week on public.weekly_updates (grade, week_start);
alter table public.weekly_updates add column if not exists hub_student_id text;
create index if not exists weekly_updates_hub_student on public.weekly_updates (hub_student_id, week_start);

alter table public.weekly_class_notes enable row level security;
alter table public.weekly_updates enable row level security;

-- 2. Helpers -----------------------------------------------------------------------------------------

-- Staff who may see / fill in a grade's weekly updates.
create or replace function public.weekly_staff_can(p_grade text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.hub_my_role() = 'admin'
      or (public.hub_my_role() in ('teacher', 'learning_assistant') and public.hub_my_grades() ? p_grade)
$fn$;

-- Admin, or the class teacher (not an assistant in that grade), may send.
create or replace function public.weekly_can_send(p_grade text)
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare p jsonb;
begin
  if public.hub_my_role() = 'admin' then return true; end if;
  if public.hub_my_role() <> 'teacher' then return false; end if;
  p := (select to_jsonb(x) from public.profiles x where x.id = auth.uid());
  return (coalesce(p->'grades_assigned', '[]'::jsonb) ? p_grade or coalesce(p->'assigned_grades', '[]'::jsonb) ? p_grade)
     and not (coalesce(p->'assistant_grades', '[]'::jsonb) ? p_grade);
end $fn$;

-- The family's own children (by students.id).
create or replace function public.weekly_is_my_child(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.students st
                 where st.id = p_student and public.hub_my_student_ids() ? st.legacy_id)
$fn$;

-- 3. Who can read and write ------------------------------------------------------------------------

drop policy if exists "weekly notes read" on public.weekly_class_notes;
create policy "weekly notes read" on public.weekly_class_notes for select to authenticated using (
  public.hub_my_role() = 'viewer' or public.weekly_staff_can(grade)
  or (sent_at is not null and exists (select 1 from public.weekly_updates w
       where w.grade = weekly_class_notes.grade and w.week_start = weekly_class_notes.week_start
         and w.status = 'sent' and public.weekly_is_my_child(w.student_id)))
);
drop policy if exists "weekly notes write" on public.weekly_class_notes;
create policy "weekly notes write" on public.weekly_class_notes for insert to authenticated
  with check (public.weekly_staff_can(grade));
drop policy if exists "weekly notes update" on public.weekly_class_notes;
create policy "weekly notes update" on public.weekly_class_notes for update to authenticated
  using (public.weekly_staff_can(grade)) with check (public.weekly_staff_can(grade));

drop policy if exists "weekly updates read" on public.weekly_updates;
create policy "weekly updates read" on public.weekly_updates for select to authenticated using (
  public.hub_my_role() = 'viewer' or public.weekly_staff_can(grade)
  or (status = 'sent' and public.weekly_is_my_child(student_id))
);
drop policy if exists "weekly updates write" on public.weekly_updates;
create policy "weekly updates write" on public.weekly_updates for insert to authenticated
  with check (public.weekly_staff_can(grade) and status <> 'sent');
drop policy if exists "weekly updates update" on public.weekly_updates;
create policy "weekly updates update" on public.weekly_updates for update to authenticated
  using (public.weekly_staff_can(grade) and (status <> 'sent' or public.hub_my_role() = 'admin'))
  with check (public.weekly_staff_can(grade) and (status <> 'sent' or public.hub_my_role() = 'admin'));
drop policy if exists "weekly updates delete" on public.weekly_updates;
create policy "weekly updates delete" on public.weekly_updates for delete to authenticated
  using (public.hub_my_role() = 'admin');

-- 4. Send the week's ready updates for one class ------------------------------------------------

create or replace function public.weekly_send(p_grade text, p_week date)
returns integer language plpgsql security definer set search_path = public as $fn$
declare n integer;
begin
  if not public.weekly_can_send(p_grade) then raise exception 'Only the admin or the class teacher can send'; end if;

  update public.weekly_class_notes set sent_at = coalesce(sent_at, now()), sent_by = coalesce(sent_by, auth.uid())
  where grade = p_grade and week_start = p_week;

  with sent as (
    update public.weekly_updates set status = 'sent', sent_at = now(), updated_by = auth.uid(), updated_at = now()
    where grade = p_grade and week_start = p_week and status = 'ready'
    returning student_id
  ), kids as (
    select s.student_id, st.legacy_id, split_part(coalesce(st.full_name, ''), ' ', 1) as first_name
    from sent s join public.students st on st.id = s.student_id
  ), ins as (
    insert into public.notifications (user_id, student_id, kind, title, title_fr, body, body_fr)
    select p.id, k.legacy_id, 'weekly_update',
      coalesce(nullif(k.first_name, '') || '''s', 'Your child''s') || ' weekly update',
      'Le point de la semaine de ' || coalesce(nullif(k.first_name, ''), 'votre enfant'),
      'This week''s update is on the Hub. Please read it and confirm.',
      'Le point de la semaine est sur le Hub. Merci de le lire et de confirmer.'
    from kids k join public.profiles p on p.role = 'parent' and coalesce(to_jsonb(p.student_ids), '[]'::jsonb) ? k.legacy_id
    returning 1
  )
  select count(*) into n from sent;
  return n;
end $fn$;

-- 5. A family confirms it has read the update ----------------------------------------------------

create or replace function public.weekly_ack(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $fn$
declare w public.weekly_updates;
begin
  select * into w from public.weekly_updates where id = p_id;
  if w.id is null or w.status <> 'sent' or not public.weekly_is_my_child(w.student_id) then
    raise exception 'Not allowed';
  end if;
  update public.weekly_updates
     set ack_at = coalesce(ack_at, now()), ack_by = coalesce(ack_by, auth.uid()),
         ack_note = coalesce(nullif(left(trim(coalesce(p_note, '')), 600), ''), ack_note)
   where id = p_id;
end $fn$;

-- 6. Remind the families who have not confirmed --------------------------------------------------

create or replace function public.weekly_remind(p_grade text, p_week date)
returns integer language plpgsql security definer set search_path = public as $fn$
declare n integer;
begin
  if not public.weekly_can_send(p_grade) then raise exception 'Only the admin or the class teacher can send reminders'; end if;
  with kids as (
    select st.legacy_id, split_part(coalesce(st.full_name, ''), ' ', 1) as first_name
    from public.weekly_updates w join public.students st on st.id = w.student_id
    where w.grade = p_grade and w.week_start = p_week and w.status = 'sent' and w.ack_at is null
  ), ins as (
    insert into public.notifications (user_id, student_id, kind, title, title_fr, body, body_fr)
    select p.id, k.legacy_id, 'weekly_update',
      'Reminder: ' || coalesce(nullif(k.first_name, '') || '''s', 'your child''s') || ' weekly update',
      'Rappel : le point de la semaine de ' || coalesce(nullif(k.first_name, ''), 'votre enfant'),
      'Please read it on the Hub and confirm.',
      'Merci de le lire sur le Hub et de confirmer.'
    from kids k join public.profiles p on p.role = 'parent' and coalesce(to_jsonb(p.student_ids), '[]'::jsonb) ? k.legacy_id
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $fn$;

revoke all on function public.weekly_send(text, date), public.weekly_ack(uuid, text), public.weekly_remind(text, date) from public, anon;
grant execute on function public.weekly_send(text, date), public.weekly_ack(uuid, text), public.weekly_remind(text, date) to authenticated;

-- 7. Check ----------------------------------------------------------------------------------------

select 'weekly tables' as what, count(*)::text as detail from information_schema.tables
where table_schema = 'public' and table_name in ('weekly_class_notes', 'weekly_updates');
