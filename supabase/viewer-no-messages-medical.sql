-- BrightSteps Hub: viewer accounts see everything EXCEPT family messages and medical details (16 Oct 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
-- What it does:
--   * A viewer (read-only account) still receives all school data, but each student
--     arrives WITHOUT message threads (parents' and students' messages, read status),
--     medical conditions or allergies.
--   * The medical table and the emergency summary are already admin only
--     (security-fixes-2026-10-16.sql), so viewers cannot reach them there either.
--   * Every other role is unchanged.
--
-- How: the existing hub_trim is kept exactly as it is (renamed hub_trim_core), and a
-- small hub_trim in front of it removes those fields for viewers.
-- NOTE for future scripts: change hub_trim_core, not hub_trim.

do $do$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'hub_trim_core') then
    alter function public.hub_trim(jsonb) rename to hub_trim_core;
  end if;
end $do$;

revoke all on function public.hub_trim_core(jsonb) from public, anon, authenticated;

create or replace function public.hub_viewer_hidden_fields()
returns text[] language sql immutable as $fn$
  select public.hub_thread_fields() || array['medicalConditions', 'allergies']
$fn$;

create or replace function public.hub_trim(full_data jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  d jsonb := public.hub_trim_core(full_data);
  hidden text[];
begin
  if public.hub_my_role() is distinct from 'viewer' then
    return d;
  end if;
  hidden := public.hub_viewer_hidden_fields();
  return d || jsonb_build_object('students', coalesce((
    select jsonb_agg(s - hidden order by o)
    from jsonb_array_elements(case when jsonb_typeof(d->'students') = 'array' then d->'students' else '[]'::jsonb end)
      with ordinality t(s, o)), '[]'::jsonb));
end $fn$;

revoke all on function public.hub_trim(jsonb) from public, anon;
grant execute on function public.hub_trim(jsonb) to authenticated;

-- Check: act as the viewer account for this run only, and count what it receives.
-- Expected: students > 0, and 0 for messages and medical.
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from public.profiles where role = 'viewer' order by full_name limit 1), 'role', 'authenticated')::text, true);

with v as (
  select public.hub_trim((select value::jsonb from public.app_storage where key = 'brightsteps-hub-data' and shared = true)) as d
)
select 'students the viewer receives' as what, jsonb_array_length(d->'students')::text as detail from v
union all
select 'students arriving with messages', count(*)::text from v, jsonb_array_elements(d->'students') s
  where s ?| array['messages', 'lastRead', 'studentMessages', 'studentLastRead']
union all
select 'students arriving with medical details', count(*)::text from v, jsonb_array_elements(d->'students') s
  where s ?| array['medicalConditions', 'allergies'];
