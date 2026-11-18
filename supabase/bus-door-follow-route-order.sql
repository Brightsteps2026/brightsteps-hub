-- BrightSteps Hub: morning bus follows the pickup order (18 Nov 2026)
-- Run once in Supabase > SQL Editor (paste the whole file, then Run). Safe to run again. Deletes nothing.
--   1. Mamitchi's home is pinned where the driver taps her every day.
--   2. Morning "at your door" alert and 2-minute countdown wait until earlier children nearby
--      on the route are picked up (e.g. Mamitchi before Kai). Brothers and sisters stay together.

-- 1. Mamitchi's home
update public.bus_riders r set home_lat = 5.220040, home_lng = -3.820180, home_set_at = now()
from public.students s
where s.id = r.student_id and s.full_name ilike 'Mamitchi%' and r.home_lat is null;

-- 2. Pickup order for the door alert
create or replace function public.bus_door_blocked(p_trip_id uuid, p_student uuid, p_lat double precision, p_lng double precision)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
    from public.bus_trips t
    join public.bus_riders me on me.student_id = p_student
    join public.bus_riders r2 on r2.active and r2.student_id <> p_student
    join public.students s2 on s2.id = r2.student_id and s2.withdrawn_on is null
    where t.id = p_trip_id and t.trip = 'morning'
      and me.route_order is not null and r2.route_order is not null and r2.route_order < me.route_order
      and r2.home_lat is not null and r2.home_lng is not null
      and public.bus_distance_m(p_lat, p_lng, r2.home_lat, r2.home_lng) <= 300
      and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = r2.student_id and e.kind = 'on')
      and not exists (select 1 from public.bus_skips k where k.student_id = r2.student_id and k.skip_date = t.trip_date and k.trip = t.trip)
      and not exists (select 1 from public.bus_door_waits w where w.trip_id = t.id and w.student_id = r2.student_id and w.left_at is not null)
      and not exists (select 1 from public.student_guardians g1 join public.student_guardians g2 on g2.parent_id = g1.parent_id
                      where g1.student_id = p_student and g2.student_id = r2.student_id)
  )
$fn$;
revoke all on function public.bus_door_blocked(uuid, uuid, double precision, double precision) from public, anon, authenticated;

create or replace function public.bus_post_position(p_trip_id uuid, p_lat double precision, p_lng double precision)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare t public.bus_trips; st text; lim double precision; rec record;
        n_en text; n_fr text; ten text; tfr text; en text; fr text;
begin
  if not public.bus_is_staff() then raise exception 'Not allowed'; end if;
  if abs(p_lat) > 90 or abs(p_lng) > 180 then raise exception 'Bad position'; end if;
  update public.bus_trips set last_lat = p_lat, last_lng = p_lng, last_at = now()
   where id = p_trip_id and ended_at is null
   returning * into t;
  if t.id is null then return; end if;
  insert into public.bus_positions (trip_id, lat, lng) values (p_trip_id, p_lat, p_lng);

  foreach st in array array['door', 'near'] loop
    lim := case when st = 'door' then 150 else 1500 end;

    create temp table if not exists _bus_new (sid uuid, legacy_id text, fname text, ord int) on commit drop;
    truncate _bus_new;
    insert into _bus_new
    select s.id, s.legacy_id, coalesce(nullif(s.first_name, ''), split_part(s.full_name, ' ', 1)), coalesce(r.route_order, 999)
    from public.bus_riders r
    join public.students s on s.id = r.student_id
    where r.active and s.withdrawn_on is null
      and r.home_lat is not null and r.home_lng is not null
      and public.bus_distance_m(p_lat, p_lng, r.home_lat, r.home_lng) <= lim
      and not exists (select 1 from public.bus_skips k where k.student_id = s.id and k.skip_date = t.trip_date and k.trip = t.trip)
      and not exists (select 1 from public.bus_near_alerts a where a.trip_id = t.id and a.student_id = s.id and a.stage = st)
      and not (st = 'door' and public.bus_door_blocked(t.id, s.id, p_lat, p_lng))
      and (
        (t.trip = 'morning'
          and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'on'))
        or
        (t.trip = 'afternoon'
          and exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'on')
          and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'off'))
      );

    insert into public.bus_near_alerts (trip_id, student_id, stage) select t.id, sid, st from _bus_new on conflict do nothing;
    if st = 'door' then
      insert into public.bus_near_alerts (trip_id, student_id, stage) select t.id, sid, 'near' from _bus_new on conflict do nothing;
    end if;

    for rec in
      select pid, array_agg(b.fname order by b.ord) names, min(b.legacy_id) legacy_id
      from _bus_new b cross join lateral public.bus_parents_of(b.sid) pid
      group by pid
    loop
      n_en := public.bus_join_names(rec.names, 'and');
      n_fr := public.bus_join_names(rec.names, 'et');
      if st = 'near' then
        ten := 'The bus is about 5 minutes away'; tfr := 'Le car arrive dans environ 5 minutes';
        if t.trip = 'morning' then
          en := 'The school bus will be at your home in about 5 minutes. Please have ' || n_en || ' ready.';
          fr := 'Le car scolaire sera chez vous dans environ 5 minutes. Merci de préparer ' || n_fr || '.';
        else
          en := 'The school bus will be at your home in about 5 minutes with ' || n_en || '.';
          fr := 'Le car scolaire sera chez vous dans environ 5 minutes avec ' || n_fr || '.';
        end if;
      elsif t.trip = 'morning' then
        ten := 'The bus is now at your door'; tfr := 'Le car est maintenant devant votre porte';
        en := 'The school bus is now at your door. Please bring ' || n_en || ' out.';
        fr := 'Le car scolaire est maintenant devant votre porte. Merci de faire sortir ' || n_fr || '.';
      else
        ten := 'The bus is arriving at your home'; tfr := 'Le car arrive chez vous';
        en := 'The school bus is arriving with ' || n_en || '. Please be ready to welcome them.';
        fr := 'Le car scolaire arrive avec ' || n_fr || '. Merci d''être prêt(e) à les accueillir.';
      end if;
      insert into public.notifications (user_id, student_id, kind, title, title_fr, body, body_fr)
      values (rec.pid, rec.legacy_id, 'bus', ten, tfr, en, fr);
    end loop;
  end loop;
end $function$;

-- Check: Mamitchi now has a home point
select s.full_name, r.home_lat, r.home_lng from public.bus_riders r join public.students s on s.id = r.student_id
where s.full_name ilike 'Mamitchi%';
