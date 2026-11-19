-- BrightSteps Hub: bus "brothers and sisters" = same parents AND same home (19 Nov 2026)
-- Already applied. Safe to run again. Deletes nothing.
-- Why: Myri and Patrick are linked to Jayden, Mila and Madeem, who live in two different homes.
-- Without the home check, one 2-minute countdown started for all of them at Jayden's building.
-- Any older SQL that redefines bus_door_group must keep this home check.
create or replace function public.bus_door_group(p_trip_id uuid, p_student uuid)
returns table(student_id uuid) language sql stable security definer set search_path = public as $fn$
  select distinct r.student_id
  from public.bus_trips t
  join public.bus_riders me on me.student_id = p_student
  join public.bus_riders r on r.active
  join public.students s on s.id = r.student_id and s.withdrawn_on is null
  where t.id = p_trip_id
    and (r.student_id = p_student
         or (exists (select 1 from public.student_guardians g1 join public.student_guardians g2 on g2.parent_id = g1.parent_id
                     where g1.student_id = p_student and g2.student_id = r.student_id)
             and me.home_lat is not null and r.home_lat is not null
             and public.bus_distance_m(me.home_lat, me.home_lng, r.home_lat, r.home_lng) <= 150))
    and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = r.student_id and e.kind = 'on')
    and not exists (select 1 from public.bus_skips k where k.student_id = r.student_id and k.skip_date = t.trip_date and k.trip = t.trip)
$fn$;
