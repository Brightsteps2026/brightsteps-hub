-- School bus fixes (Myri, 9 Nov 2026)
-- 1. Drop-off: when the child's home is not saved (or the bus phone gave no position),
--    parents are no longer told "got off the bus at home" — the Hub cannot know that.
--    They get a neutral "was dropped off at HH:MM" instead.
-- 2. bus_family_today: adds near_at (when the "about 5 minutes away" alert was sent)
--    so the parent screens can show a big banner.

create or replace function public.bus_mark(p_trip_id uuid, p_student uuid, p_kind text, p_lat double precision default null::double precision, p_lng double precision default null::double precision)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare t public.bus_trips; s public.students; r public.bus_riders; fname text; hhmm text := to_char(public.bus_local_now(), 'HH24:MI');
        en text; fr text; ten text; tfr text; dist double precision; away boolean := false; unknown boolean := false; nohome boolean := false; dtxt text;
begin
  if not public.bus_is_staff() then raise exception 'Not allowed'; end if;
  select * into t from public.bus_trips where id = p_trip_id;
  select * into s from public.students where id = p_student;
  if t.id is null or s.id is null or p_kind not in ('on', 'off') then raise exception 'Bad request'; end if;
  insert into public.bus_events (trip_id, student_id, kind, lat, lng, marked_by)
  values (p_trip_id, p_student, p_kind, p_lat, p_lng, auth.uid())
  on conflict (trip_id, student_id, kind) do nothing;
  if not found then return; end if;   -- already marked: no second notice

  fname := coalesce(nullif(s.first_name, ''), split_part(s.full_name, ' ', 1));

  -- Afternoon drop-off: check it happened at the child's home (within 300 m)
  if t.trip = 'afternoon' and p_kind = 'off' then
    select * into r from public.bus_riders where student_id = s.id;
    if p_lat is null or p_lng is null then
      unknown := true;
    elsif r.home_lat is null or r.home_lng is null then
      nohome := true;
    else
      dist := public.bus_distance_m(p_lat, p_lng, r.home_lat, r.home_lng);
      away := dist > 300;
    end if;
    dtxt := case when dist >= 1000 then replace(to_char(dist / 1000, 'FM990.0'), '.', ',') || ' km' else round(dist)::int || ' m' end;
    if away or unknown then
      insert into public.notifications (user_id, student_id, kind, title, title_fr, body, body_fr)
      select p.id, s.legacy_id, 'bus',
        'URGENT: ' || fname || ' dropped off away from home',
        'URGENT : ' || fname || ' déposé(e) hors du domicile',
        case when away then fname || ' was marked as dropped off at ' || hhmm || ', about ' || dtxt || ' from home. Please check with the driver now.'
             else fname || ' was marked as dropped off at ' || hhmm || ', but the bus phone gave no location. Please check with the driver now.' end,
        case when away then fname || ' a été marqué(e) comme déposé(e) à ' || replace(hhmm, ':', 'h') || ', à environ ' || dtxt || ' du domicile. Merci de vérifier avec le chauffeur maintenant.'
             else fname || ' a été marqué(e) comme déposé(e) à ' || replace(hhmm, ':', 'h') || ', mais le téléphone du car n''a donné aucune position. Merci de vérifier avec le chauffeur maintenant.' end
      from public.profiles p where p.role = 'admin';
    end if;
  end if;

  if t.trip = 'morning' and p_kind = 'on' then
    ten := fname || ' is on the bus'; tfr := fname || ' est dans le car';
    en := fname || ' got on the school bus at ' || hhmm || '.'; fr := fname || ' est monté(e) dans le car scolaire à ' || replace(hhmm, ':', 'h') || '.';
  elsif t.trip = 'morning' then
    ten := fname || ' arrived at school'; tfr := fname || ' est arrivé(e) à l''école';
    en := fname || ' got off the bus at school at ' || hhmm || '.'; fr := fname || ' est descendu(e) du car à l''école à ' || replace(hhmm, ':', 'h') || '.';
  elsif p_kind = 'on' then
    ten := fname || ' is on the bus home'; tfr := fname || ' rentre en car';
    en := fname || ' got on the bus at school at ' || hhmm || '.'; fr := fname || ' est monté(e) dans le car à l''école à ' || replace(hhmm, ':', 'h') || '.';
  elsif away then
    ten := fname || ' was dropped off away from home'; tfr := fname || ' a été déposé(e) hors du domicile';
    en := fname || ' got off the bus at ' || hhmm || ', about ' || dtxt || ' from home. The school has been alerted and is checking.';
    fr := fname || ' est descendu(e) du car à ' || replace(hhmm, ':', 'h') || ', à environ ' || dtxt || ' du domicile. L''école a été alertée et vérifie.';
  elsif unknown or nohome then
    ten := fname || ' was dropped off'; tfr := fname || ' a été déposé(e)';
    en := fname || ' got off the bus at ' || hhmm || '.'; fr := fname || ' est descendu(e) du car à ' || replace(hhmm, ':', 'h') || '.';
  else
    ten := fname || ' was dropped off'; tfr := fname || ' a été déposé(e)';
    en := fname || ' got off the bus at home at ' || hhmm || '.'; fr := fname || ' est descendu(e) du car à la maison à ' || replace(hhmm, ':', 'h') || '.';
  end if;
  insert into public.notifications (user_id, student_id, kind, title, title_fr, body, body_fr)
  select pid, s.legacy_id, 'bus', ten, tfr, en, fr from public.bus_parents_of(s.id) pid;
end $function$;

create or replace function public.bus_family_today()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare d date := public.bus_local_now()::date;
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
          'on_at', (select e.at from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'on'),
          'off_at', (select e.at from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'off'),
          'near_at', (select a.sent_at from public.bus_near_alerts a where a.trip_id = t.id and a.student_id = s.id),
          'bus', case when t.id is not null and t.ended_at is null and t.last_at > now() - interval '15 minutes'
                   and not exists (select 1 from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'off')
                 then jsonb_build_object('lat', t.last_lat, 'lng', t.last_lng, 'at', t.last_at) end,
          'path', case when t.id is not null and t.ended_at is null then (
              select coalesce(jsonb_agg(jsonb_build_array(p.lat, p.lng) order by p.at), '[]'::jsonb)
              from public.bus_positions p
              where p.trip_id = t.id
                and p.at >= (select e.at from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'on')
                and p.at <= coalesce((select e.at from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'off'), now()))
            end
        ))
        from (values ('morning'), ('afternoon')) tt(trip)
        left join public.bus_trips t on t.trip_date = d and t.trip = tt.trip
      )
    ))
    from public.bus_riders r join public.students s on s.id = r.student_id
    where r.active and s.withdrawn_on is null and public.is_my_child(s.id)
  ), '[]'::jsonb);
end $function$;
