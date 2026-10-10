-- BrightSteps Hub: no more lost saves when two people save at the same time
-- Run once in Supabase > SQL Editor. Safe to run again. Changes no data.
--
-- What it does:
--   Each save now says which copy of the school data it was based on. If someone
--   else saved in between, the database refuses this save instead of quietly
--   overwriting their work; the Hub then reads the newer copy, combines both
--   sets of changes and saves again (automatically, the person sees nothing).
--
-- The Hub keeps working before this file is run (it uses the old way until then).

-- Which copy of the school data is current (the time it was last saved).
create or replace function public.hub_data_version()
returns text language sql stable security definer set search_path = public as $fn$
  select updated_at::text from public.app_storage where key = 'brightsteps-hub-data' and shared = true
$fn$;

revoke all on function public.hub_data_version() from public, anon;
grant execute on function public.hub_data_version() to authenticated;

-- Save, but only if nobody else has saved since base_version.
-- Returns the new version.
create or replace function public.save_hub_data_checked(new_value text, base_version text)
returns text language plpgsql volatile security definer set search_path = public as $fn$
declare current_version text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  perform 1 from public.app_storage where key = 'brightsteps-hub-data' and shared = true for update;
  current_version := (select updated_at::text from public.app_storage where key = 'brightsteps-hub-data' and shared = true);
  if base_version is not null and current_version is distinct from base_version then
    raise exception 'stale_data: the school data changed since it was loaded';
  end if;
  perform public.save_hub_data(new_value);
  return (select updated_at::text from public.app_storage where key = 'brightsteps-hub-data' and shared = true);
end $fn$;

revoke all on function public.save_hub_data_checked(text, text) from public, anon;
grant execute on function public.save_hub_data_checked(text, text) to authenticated;

-- Check: should list both functions
select proname from pg_proc
where pronamespace = 'public'::regnamespace and proname in ('hub_data_version', 'save_hub_data_checked')
order by proname;
