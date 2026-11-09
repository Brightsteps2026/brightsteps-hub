-- Bus "about 5 minutes away" alert (9 Nov 2026)
-- When the bus comes within ~1.5 km of a child's home, the child's parents get one
-- notification per trip (bell + phone push via the push_from_notification trigger).
-- Morning: child not yet on the bus. Afternoon: child on the bus, not yet dropped off.
-- Skipped children (bus_skips) and withdrawn students are left out.

create table if not exists public.bus_near_alerts (
  trip_id uuid not null references public.bus_trips(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (trip_id, student_id)
);
alter table public.bus_near_alerts enable row level security;
-- No policies: only the security-definer function below writes or reads it.

create or replace function public.bus_post_position(p_trip_id uuid, p_lat double precision, p_lng double precision)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare t public.bus_trips;
begin
  if not public.bus_is_staff() then raise exception 'Not allowed'; end if;
  if abs(p_lat) > 90 or abs(p_lng) > 180 then raise exception 'Bad position'; end if;
  update public.bus_trips set last_lat = p_lat, last_lng = p_lng, last_at = now()
   where id = p_trip_id and ended_at is null
   returning * into t;
  if t.id is null then return; end if;
  insert into public.bus_positions (trip_id, lat, lng) values (p_trip_id, p_lat, p_lng);

  -- About 5 minutes away (~1.5 km straight line)
  with near as (
    select s.id as sid, s.legacy_id, coalesce(nullif(s.first_name, ''), split_part(s.full_name, ' ', 1)) as fname
    from public.bus_riders r
    join public.students s on s.id = r.student_id
    where r.active and s.withdrawn_on is null
      and r.home_lat is not null and r.home_lng is not null
      and public.bus_distance_m(p_lat, p_lng, r.home_lat, r.home_lng) <= 1500
      and not exists (select 1 from public.bus_skips k where k.student_id = s.id and k.skip_date = t.trip_date and k.trip = t.trip)
      and not exists (select 1 from public.bus_near_alerts a where a.trip_id = t.id and a.student_id = s.id)
      and (
        (t.trip = 'morning'
          and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'on'))
        or
        (t.trip = 'afternoon'
          and exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'on')
          and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'off'))
      )
  ), sent as (
    insert into public.bus_near_alerts (trip_id, student_id)
    select t.id, sid from near
    on conflict do nothing
    returning student_id
  )
  insert into public.notifications (user_id, student_id, kind, title, title_fr, body, body_fr)
  select pid, n.legacy_id, 'bus',
    'The bus is about 5 minutes away', 'Le car arrive dans environ 5 minutes',
    case when t.trip = 'morning'
      then 'The school bus will be at your home in about 5 minutes. Please have ' || n.fname || ' ready.'
      else 'The school bus will be at your home in about 5 minutes with ' || n.fname || '.' end,
    case when t.trip = 'morning'
      then 'Le car scolaire sera chez vous dans environ 5 minutes. Merci de préparer ' || n.fname || '.'
      else 'Le car scolaire sera chez vous dans environ 5 minutes avec ' || n.fname || '.' end
  from sent
  join near n on n.sid = sent.student_id
  cross join lateral public.bus_parents_of(n.sid) pid;
end $function$;
