-- BrightSteps Hub: staff-only calendar events, phone calendar links, and the
-- dates from the 10 October 2026 parent letter.
-- Run once in Supabase > SQL Editor. Safe to run again.
--
-- What it does:
--   1. Staff-only events never reach parents or students. The database removes
--      them before the school data is sent, and nothing a parent or student saves
--      can change the calendar. (An event is staff only when it is marked
--      "Staff only", or, for older events, when its type is "Staff".)
--   2. Creates the two private calendar links (staff, and families) used by the
--      "Add to my phone calendar" button.
--   3. Adds the letter's dates to the Hub calendar.
--
-- How: the two functions the Hub uses (get_hub_data and save_hub_data) are kept
-- exactly as they are, renamed to *_behaviour, and a thin layer is put in front
-- of them that only handles calendar events. Nothing else changes.
-- Note: if protect-student-data.sql or behaviour-notes-privacy.sql is ever run
-- again, run this file again after them.

-- 1. Keep the current functions under a new name ------------------------------

do $do$
begin
  if not exists (select 1 from pg_proc where proname = 'get_hub_data_behaviour' and pronamespace = 'public'::regnamespace) then
    alter function public.get_hub_data() rename to get_hub_data_behaviour;
  end if;
  if not exists (select 1 from pg_proc where proname = 'save_hub_data_behaviour' and pronamespace = 'public'::regnamespace) then
    alter function public.save_hub_data(text) rename to save_hub_data_behaviour;
  end if;
end $do$;

revoke all on function public.get_hub_data_behaviour() from public, anon, authenticated;
revoke all on function public.save_hub_data_behaviour(text) from public, anon, authenticated;

-- 2. Helper: is this event staff only? ------------------------------------------

create or replace function public.hub_event_is_staff(e jsonb)
returns boolean language sql immutable as $fn$
  select coalesce(e->>'audience' = 'staff', false)
      or (e->>'audience' is null and coalesce(e->>'type', '') = 'Staff')
$fn$;

-- 3. What the Hub calls to read the school data ---------------------------------

create or replace function public.get_hub_data()
returns text language plpgsql stable security definer set search_path = public as $fn$
declare
  v text;
  d jsonb;
  r text := public.hub_my_role();
begin
  v := public.get_hub_data_behaviour();
  if v is null then return null; end if;
  if r is not null and r not in ('parent', 'student') then return v; end if;

  d := v::jsonb;
  if jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'events') is distinct from 'array' then return v; end if;

  d := jsonb_set(d, '{events}', coalesce((
    select jsonb_agg(e order by o)
    from jsonb_array_elements(d->'events') with ordinality as t(e, o)
    where not public.hub_event_is_staff(e)
  ), '[]'::jsonb));

  return d::text;
end $fn$;

-- 4. What the Hub calls to save the school data ---------------------------------

create or replace function public.save_hub_data(new_value text)
returns void language plpgsql volatile security definer set search_path = public as $fn$
declare
  r text := public.hub_my_role();
  old_d jsonb;
  new_d jsonb;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  if r is not null and r not in ('parent', 'student') then
    perform public.save_hub_data_behaviour(new_value);
    return;
  end if;

  -- Parents and students: the calendar always stays exactly as it was.
  old_d := (select value::jsonb from public.app_storage where key = 'brightsteps-hub-data' and shared = true);
  new_d := new_value::jsonb;
  if old_d is not null and jsonb_typeof(new_d) = 'object' then
    new_d := jsonb_set(new_d, '{events}', coalesce(old_d->'events', '[]'::jsonb));
  end if;

  perform public.save_hub_data_behaviour(new_d::text);
end $fn$;

revoke all on function public.get_hub_data() from public, anon;
revoke all on function public.save_hub_data(text) from public, anon;
grant execute on function public.get_hub_data() to authenticated;
grant execute on function public.save_hub_data(text) to authenticated;

-- 5. Private calendar links ------------------------------------------------------

create table if not exists public.calendar_feeds (
  audience text primary key check (audience in ('staff', 'everyone')),
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

insert into public.calendar_feeds (audience) values ('staff'), ('everyone')
on conflict (audience) do nothing;

alter table public.calendar_feeds enable row level security;

drop policy if exists "calendar feeds: read own link" on public.calendar_feeds;
create policy "calendar feeds: read own link" on public.calendar_feeds
  for select to authenticated
  using (audience = 'everyone' or public.hub_my_role() not in ('parent', 'student'));

revoke all on public.calendar_feeds from anon;
grant select on public.calendar_feeds to authenticated;

-- 6. Dates from the 10 October 2026 parent letter ------------------------------
-- (October Break, 19 to 23 October, is already on the calendar.)
-- Orange T-shirt Friday skips 8 January (December break) and 11 June (after the last day of school).

update public.app_storage
set value = jsonb_set(value::jsonb, '{events}',
      coalesce(value::jsonb->'events', '[]'::jsonb) || coalesce((
        select jsonb_agg(n.e)
        from jsonb_array_elements(jsonb_build_array(
          jsonb_build_object('id', 'letter-2026-10-26-return', 'title', 'Back to school, after school activities list sent to families', 'type', 'Academic',
            'date', '2026-10-26', 'endDate', '', 'grades', '[]'::jsonb, 'audience', 'everyone',
            'description', 'Students return after the October break. Families receive the list of after school activities with prices and registration details. / Retour des élèves après les vacances d''octobre. Les familles reçoivent la liste des activités périscolaires avec les tarifs et les modalités d''inscription.'),
          jsonb_build_object('id', 'letter-2026-10-30-tiedye', 'title', 'Orange Tie Dye Day: Every Child Matters', 'type', 'Event',
            'date', '2026-10-30', 'endDate', '', 'grades', '[]'::jsonb, 'audience', 'everyone',
            'description', 'Please send a plain white, 100% cotton T shirt. / Merci de fournir un T shirt blanc uni, 100 % coton.'),
          jsonb_build_object('id', 'letter-2026-11-02-afterschool', 'title', 'After school activities begin', 'type', 'Academic',
            'date', '2026-11-02', 'endDate', '', 'grades', '[]'::jsonb, 'audience', 'everyone',
            'description', 'After school activities start today. / Début des activités périscolaires.')
        ) || (
          select jsonb_agg(jsonb_build_object('id', 'orange-friday-' || d, 'seriesId', 'orange-friday', 'title', 'Orange T shirt Friday', 'type', 'Event',
            'date', d, 'endDate', '', 'grades', '[]'::jsonb, 'audience', 'everyone',
            'description', 'Students wear their orange T shirt (second Friday of each month). / Les élèves portent leur T shirt orange (deuxième vendredi de chaque mois).'))
          from unnest(array['2026-11-13', '2026-12-11', '2027-02-12', '2027-03-12', '2027-04-09', '2027-05-14']) d
        )) n(e)
        where not exists (
          select 1 from jsonb_array_elements(coalesce(value::jsonb->'events', '[]'::jsonb)) x
          where x->>'id' = n.e->>'id'
        )
      ), '[]'::jsonb))::text,
    updated_at = now()
where key = 'brightsteps-hub-data' and shared = true;

-- 7. Checks ----------------------------------------------------------------------
-- a) should list get_hub_data, get_hub_data_behaviour, save_hub_data, save_hub_data_behaviour
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('get_hub_data', 'get_hub_data_behaviour', 'save_hub_data', 'save_hub_data_behaviour')
order by proname;

-- b) the calendar from 26 October to mid November, with who can see each event
select e->>'date' as starts, e->>'title' as title,
       case when public.hub_event_is_staff(e) then 'Staff only' else 'Everyone' end as seen_by
from public.app_storage, jsonb_array_elements(value::jsonb->'events') e
where key = 'brightsteps-hub-data' and shared = true
  and e->>'date' between '2026-10-19' and '2026-11-15'
order by e->>'date';

-- UNDO (only if something goes wrong): run these lines to go back to how it was.
-- drop function if exists public.get_hub_data();
-- drop function if exists public.save_hub_data(text);
-- alter function public.get_hub_data_behaviour() rename to get_hub_data;
-- alter function public.save_hub_data_behaviour(text) rename to save_hub_data;
-- grant execute on function public.get_hub_data() to authenticated;
-- grant execute on function public.save_hub_data(text) to authenticated;
