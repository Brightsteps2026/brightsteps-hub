-- Baseline assessments: teachers and admin only (23 October 2026)
-- Parents and students no longer receive baseline assessments at all.
-- When a parent or student saves, the baselines already on file are kept as they are.
-- Run the whole file once in the Supabase SQL Editor.

-- 1. What the Hub calls to read the school data ---------------------------------

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
  if jsonb_typeof(d) is distinct from 'object' then return v; end if;

  -- Staff-only calendar events
  if jsonb_typeof(d->'events') = 'array' then
    d := jsonb_set(d, '{events}', coalesce((
      select jsonb_agg(e order by o)
      from jsonb_array_elements(d->'events') with ordinality as t(e, o)
      where not public.hub_event_is_staff(e)
    ), '[]'::jsonb));
  end if;

  -- Baseline assessments
  if jsonb_typeof(d->'assessments') = 'array' then
    d := jsonb_set(d, '{assessments}', coalesce((
      select jsonb_agg(a order by o)
      from jsonb_array_elements(d->'assessments') with ordinality as t(a, o)
      where coalesce(a->>'assessmentType', '') <> 'Baseline Assessment'
    ), '[]'::jsonb));
  end if;

  return d::text;
end $fn$;

-- 2. What the Hub calls to save the school data ---------------------------------

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

  old_d := (select value::jsonb from public.app_storage where key = 'brightsteps-hub-data' and shared = true);
  new_d := new_value::jsonb;
  if old_d is not null and jsonb_typeof(new_d) = 'object' then
    -- The calendar always stays exactly as it was.
    new_d := jsonb_set(new_d, '{events}', coalesce(old_d->'events', '[]'::jsonb));
    -- Baselines: parents never had them, so put back the ones on file.
    new_d := jsonb_set(new_d, '{assessments}',
      coalesce((
        select jsonb_agg(a)
        from jsonb_array_elements(case when jsonb_typeof(new_d->'assessments') = 'array' then new_d->'assessments' else '[]'::jsonb end) a
        where coalesce(a->>'assessmentType', '') <> 'Baseline Assessment'
      ), '[]'::jsonb)
      || coalesce((
        select jsonb_agg(a)
        from jsonb_array_elements(case when jsonb_typeof(old_d->'assessments') = 'array' then old_d->'assessments' else '[]'::jsonb end) a
        where a->>'assessmentType' = 'Baseline Assessment'
      ), '[]'::jsonb));
  end if;

  perform public.save_hub_data_behaviour(new_d::text);
end $fn$;

revoke all on function public.get_hub_data() from public, anon;
revoke all on function public.save_hub_data(text) from public, anon;
grant execute on function public.get_hub_data() to authenticated;
grant execute on function public.save_hub_data(text) to authenticated;

-- 3. Check: how many baselines are on file, by grade (staff still see all of these)
select a->>'grade' as grade, a->>'level' as level, count(*) as baselines
from public.app_storage, jsonb_array_elements(value::jsonb->'assessments') a
where key = 'brightsteps-hub-data' and shared = true
  and a->>'assessmentType' = 'Baseline Assessment'
group by 1, 2
order by 1, 2;

-- UNDO: run supabase/calendar-staff-only-and-feeds.sql sections 3 and 4 again.
