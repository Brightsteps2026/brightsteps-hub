-- BrightSteps Hub: "about 5 minutes away" follows the pickup order (23 Nov 2026)
-- Run once in Supabase > SQL Editor, AFTER bus-family-today-two-alerts-fix.sql. Safe to run again.
-- No data is changed or deleted.
--
-- Why: the "5 minutes away" alert was sent as soon as the bus came within 1.5 km of a home,
-- whatever the route. On 23 Nov it went to Jayden at 07:07 while the bus still had Aria, Sarah,
-- Jeavis and Francesco to pick up first; the bus reached him at 07:19 (12 minutes, not 5).
-- Mila and Madeem got it at 07:01 for a 07:38 pickup.
--
-- New rule: the alert waits while an EARLIER child on the route (morning: pickup order;
-- afternoon: drop-off order) is still to be picked up / dropped off and lives more than 100 m
-- away (Aria, the Mbangowah boys and Jayden are only 150–330 m apart but the bus takes several
-- minutes per stop). Children in the same building (Jayden and Enola, Italia 2, 60 m) still get
-- it together. A child already skipped for the trip, or left behind ("Leaving without..."),
-- no longer holds the others back. Children with no home pin yet don't hold anyone back.

create or replace function public.bus_near_blocked(p_trip_id uuid, p_student uuid)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select exists (
    select 1
    from public.bus_trips t
    join public.bus_riders me on me.student_id = p_student
    join public.bus_riders o on o.active and o.student_id <> me.student_id
    join public.students os on os.id = o.student_id and os.withdrawn_on is null
    where t.id = p_trip_id
      and o.home_lat is not null and me.home_lat is not null
      and case when t.trip = 'morning'
               then coalesce(o.route_order, 999) < coalesce(me.route_order, 999)
               else coalesce(o.afternoon_order, 1000 - coalesce(o.route_order, 0)) < coalesce(me.afternoon_order, 1000 - coalesce(me.route_order, 0)) end
      and public.bus_distance_m(o.home_lat, o.home_lng, me.home_lat, me.home_lng) > 100
      and not exists (select 1 from public.bus_skips k where k.student_id = o.student_id and k.skip_date = t.trip_date and k.trip = t.trip)
      and (
        (t.trip = 'morning'
          and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = o.student_id and e.kind = 'on')
          and not exists (select 1 from public.bus_door_waits w where w.trip_id = t.id and w.student_id = o.student_id and w.left_at is not null))
        or
        (t.trip = 'afternoon'
          and exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = o.student_id and e.kind = 'on')
          and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = o.student_id and e.kind = 'off'))
      )
  )
$f$;

CREATE OR REPLACE FUNCTION public.bus_post_position(p_trip_id uuid, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    lim := case when st = 'door' then 80 else 1500 end;  -- door: 80 m (was 150 m; Myri, 19 Nov 2026)

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
      -- "5 minutes away" follows the route order (Myri, 23 Nov 2026)
      and not (st = 'near' and public.bus_near_blocked(t.id, s.id))
      -- Door: the bus must have STOPPED there: the previous position (last 45 s) was also within 80 m
      and (st <> 'door' or exists (select 1 from public.bus_positions q where q.trip_id = t.id
             and q.at < now() and q.at > now() - interval '45 seconds'
             and public.bus_distance_m(q.lat, q.lng, r.home_lat, r.home_lng) <= lim))
      -- Morning: no "at your door" / countdown before the family's pickup time (Myri, 19 Nov 2026)
      and not (st = 'door' and t.trip = 'morning' and r.pickup_time is not null and public.bus_local_now()::time < r.pickup_time)
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
