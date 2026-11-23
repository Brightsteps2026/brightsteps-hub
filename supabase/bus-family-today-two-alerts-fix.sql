-- BrightSteps Hub: fix the parent bus view disappearing (23 Nov 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. No data is changed or deleted.
--
-- Why: since the 2-minute door rule (17 Nov), a child can have two alert rows on a trip
-- ("near" and "door"). bus_family_today read them as if there could only be one, so as soon
-- as the bus reached a child's door the function failed ("more than one row returned") and
-- the parent's live banner, trip status and map all disappeared.

CREATE OR REPLACE FUNCTION public.bus_family_today()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare d date := public.bus_local_now()::date; q boolean := public.bus_parents_quiet();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'student_id', s.id,
      'first_name', coalesce(nullif(s.first_name, ''), split_part(s.full_name, ' ', 1)),
      'trips', (
        select jsonb_object_agg(tt.trip, jsonb_build_object(
          'skip', exists (select 1 from public.bus_skips k where k.student_id = s.id and k.skip_date = d and k.trip = tt.trip),
          'started', t.id is not null,
          'live', t.id is not null and t.ended_at is null,
          'on_at', (select min(e.at) from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'on'),
          'off_at', (select min(e.at) from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'off'),
          'near_at', (select min(a.sent_at) from public.bus_near_alerts a where a.trip_id = t.id and a.student_id = s.id),
          'door_at', (select min(a.sent_at) from public.bus_near_alerts a where a.trip_id = t.id and a.student_id = s.id and a.stage = 'door'),
          'bus', case when t.id is not null and t.ended_at is null and t.last_at > now() - interval '15 minutes'
                   and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'off')
                 then jsonb_build_object('lat', t.last_lat, 'lng', t.last_lng, 'at', t.last_at) end,
          'path', case when t.id is not null and t.ended_at is null then (
              select coalesce(jsonb_agg(jsonb_build_array(p.lat, p.lng) order by p.at), '[]'::jsonb)
              from public.bus_positions p
              where p.trip_id = t.id
                and p.at >= (select min(e.at) from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'on')
                and p.at <= coalesce((select min(e.at) from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'off'), now()))
            end
        ))
        from (values ('morning'), ('afternoon')) tt(trip)
        left join public.bus_trips t on t.trip_date = d and t.trip = tt.trip and not q
      )
    ))
    from public.bus_riders r join public.students s on s.id = r.student_id
    where r.active and s.withdrawn_on is null and public.is_my_child(s.id)
  ), '[]'::jsonb);
end $function$;
