-- BrightSteps Hub: bus simulation mode + children's photos on the bus screen (17 Nov 2026).
-- Already applied to the live database. Safe to run again. Deletes nothing on its own.
--
-- Simulation mode (Myri): the bus can do a practice run without parents thinking their child
-- is being dropped off.
--   * Until the chosen time, parents get NO bus notices (bell or phone). Admins still get theirs.
--   * Parents' School bus screen shows no trip progress during that time.
--   * When the time is up (checked every 2 minutes), the practice taps, positions and trips made
--     during the simulation are cleared, so the real trip afterwards starts clean and every
--     family gets its notices. The admin can also end it early from the School bus tab.
-- Photos: the bus phone sees each child's profile photo next to their name (bus riders only).

-- 1. Setting -----------------------------------------------------------------------------------
create table if not exists public.bus_settings (
  id int primary key default 1 check (id = 1),
  parents_quiet_until timestamptz,
  quiet_started_at timestamptz
);
insert into public.bus_settings (id) values (1) on conflict do nothing;
alter table public.bus_settings enable row level security;
revoke all on public.bus_settings from anon, authenticated;

create or replace function public.bus_parents_quiet()
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((select parents_quiet_until > now() from public.bus_settings where id = 1), false)
$fn$;

-- 2. Drop parents' bus notices while quiet -------------------------------------------------------
create or replace function public.bus_quiet_filter()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.kind = 'bus' and public.bus_parents_quiet()
     and exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'parent') then
    return null;
  end if;
  return new;
end $fn$;

drop trigger if exists bus_quiet_filter on public.notifications;
create trigger bus_quiet_filter before insert on public.notifications
  for each row execute function public.bus_quiet_filter();

-- 3. Admin controls --------------------------------------------------------------------------------
create or replace function public.bus_simulation_status()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
begin
  if not public.bus_is_staff() then raise exception 'Not allowed'; end if;
  return (select jsonb_build_object('quiet_until', case when parents_quiet_until > now() then parents_quiet_until end,
                                    'started_at', quiet_started_at)
          from public.bus_settings where id = 1);
end $fn$;
grant execute on function public.bus_simulation_status() to authenticated;

create or replace function public.bus_simulation_start(p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if public.hub_my_role() <> 'admin' then raise exception 'Only the admin can start a simulation'; end if;
  if p_until <= now() or p_until > now() + interval '12 hours' then raise exception 'Choose a time later today'; end if;
  update public.bus_settings
     set parents_quiet_until = p_until,
         quiet_started_at = case when parents_quiet_until > now() then quiet_started_at else now() end
   where id = 1;
end $fn$;
grant execute on function public.bus_simulation_start(timestamptz) to authenticated;

-- Clears what was recorded during the simulation, then switches quiet mode off.
create or replace function public.bus_simulation_clear_internal()
returns integer language plpgsql security definer set search_path = public as $fn$
declare s timestamptz; n integer := 0;
begin
  select quiet_started_at into s from public.bus_settings where id = 1;
  if s is null then return 0; end if;
  delete from public.bus_events      e using public.bus_trips t where t.id = e.trip_id and e.at >= s;
  get diagnostics n = row_count;
  delete from public.bus_positions   p where p.at >= s;
  delete from public.bus_door_waits  w where w.started_at >= s;
  delete from public.bus_near_alerts a where a.sent_at >= s;
  delete from public.bus_auto_log    l where l.at >= s;
  -- Trips first started during the simulation go; an earlier real trip that was reopened is closed again.
  delete from public.bus_trips where started_at >= s;
  update public.bus_trips set ended_at = s where trip_date = (s at time zone 'Africa/Abidjan')::date and started_at < s and (ended_at is null or ended_at > s);
  update public.bus_settings set parents_quiet_until = null, quiet_started_at = null where id = 1;
  return n;
end $fn$;
revoke all on function public.bus_simulation_clear_internal() from public, anon, authenticated;

create or replace function public.bus_simulation_end()
returns integer language plpgsql security definer set search_path = public as $fn$
begin
  if public.hub_my_role() <> 'admin' then raise exception 'Only the admin can end a simulation'; end if;
  return public.bus_simulation_clear_internal();
end $fn$;
grant execute on function public.bus_simulation_end() to authenticated;

create or replace function public.bus_simulation_auto_end()
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if exists (select 1 from public.bus_settings where id = 1 and quiet_started_at is not null
             and (parents_quiet_until is null or parents_quiet_until <= now())) then
    perform public.bus_simulation_clear_internal();
  end if;
end $fn$;
revoke all on function public.bus_simulation_auto_end() from public, anon, authenticated;

select cron.unschedule('bus-simulation-end') where exists (select 1 from cron.job where jobname = 'bus-simulation-end');
select cron.schedule('bus-simulation-end', '*/2 * * * *', 'select public.bus_simulation_auto_end()');

-- 4. Parents' bus screen: no trip progress while quiet ---------------------------------------------
create or replace function public.bus_family_today()
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
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
        left join public.bus_trips t on t.trip_date = d and t.trip = tt.trip and not q
      )
    ))
    from public.bus_riders r join public.students s on s.id = r.student_id
    where r.active and s.withdrawn_on is null and public.is_my_child(s.id)
  ), '[]'::jsonb);
end $function$;

-- 5. Bus screen: photo of each child + simulation flag ----------------------------------------------
create or replace function public.bus_run_list(p_trip text)
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare d date := public.bus_local_now()::date; t public.bus_trips; adm boolean := public.hub_my_role() = 'admin';
begin
  if not public.bus_is_staff() then raise exception 'Not allowed'; end if;
  select * into t from public.bus_trips where trip_date = d and trip = p_trip;
  return jsonb_build_object(
    'date', d,
    'parents_quiet_until', (select parents_quiet_until from public.bus_settings where id = 1 and parents_quiet_until > now()),
    'trip', case when t.id is null then null else jsonb_build_object('id', t.id, 'started_at', t.started_at, 'ended_at', t.ended_at, 'last_lat', t.last_lat, 'last_lng', t.last_lng, 'last_at', t.last_at) end,
    'riders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id, 'name', s.full_name, 'grade', s.grade, 'zone', r.zone, 'route_order', r.route_order,
        'photo_path', s.photo_path,
        'home_lat', r.home_lat, 'home_lng', r.home_lng, 'home_link', r.home_link, 'home_note', r.home_note,
        'phones', case when adm then array_remove(array[nullif(s.guardian1_phone, ''), nullif(s.guardian2_phone, '')], null) else array[]::text[] end,
        'skip', exists (select 1 from public.bus_skips k where k.student_id = s.id and k.skip_date = d and k.trip = p_trip),
        'skip_note', (select k.note from public.bus_skips k where k.student_id = s.id and k.skip_date = d and k.trip = p_trip),
        'on_at', (select e.at from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'on'),
        'off_at', (select e.at from public.bus_events e where e.trip_id = t.id and e.student_id = s.id and e.kind = 'off'),
        'door_started_at', (select w.started_at from public.bus_door_waits w where w.trip_id = t.id and w.student_id = s.id),
        'door_reminded_at', (select w.reminded_at from public.bus_door_waits w where w.trip_id = t.id and w.student_id = s.id),
        'door_left_at', (select w.left_at from public.bus_door_waits w where w.trip_id = t.id and w.student_id = s.id),
        'server_now', now()
      ) order by case when p_trip = 'afternoon' then -r.route_order else r.route_order end nulls last, r.zone, s.full_name)
      from public.bus_riders r join public.students s on s.id = r.student_id
      where r.active and s.withdrawn_on is null), '[]'::jsonb)
  );
end $function$;

-- 6. Bus phone may open the photos of children on the bus list ---------------------------------------
drop policy if exists "Bus sees rider photos" on storage.objects;
create policy "Bus sees rider photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments' and public.bus_is_staff()
    and name in (select s.photo_path from public.students s join public.bus_riders r on r.student_id = s.id
                 where r.active and s.withdrawn_on is null and s.photo_path is not null)
  );
