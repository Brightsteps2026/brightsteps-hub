-- BrightSteps Hub: Stage 0 — daily backup of the shared school data (16 Oct 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing from the Hub.
--
-- What it does:
--   * Keeps a copy of the whole shared school data (the "blob") every night at 02:00,
--     and one right now.
--   * Keeps the last 30 days of copies; older copies are removed automatically.
--   * Only the admin can see the copies. Nobody can change them from the Hub.

-- 1. Where the copies are kept -------------------------------------------------------------

create table if not exists public.hub_data_backups (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  size_kb integer,
  students integer,
  value text not null
);

alter table public.hub_data_backups enable row level security;
drop policy if exists "Backups: admin can read" on public.hub_data_backups;
create policy "Backups: admin can read" on public.hub_data_backups for select to authenticated
  using (public.hub_my_role() = 'admin');
revoke all on public.hub_data_backups from anon, authenticated;
grant select on public.hub_data_backups to authenticated;

-- 2. Taking a copy -------------------------------------------------------------------------------

create or replace function public.backup_hub_data()
returns void language plpgsql volatile security definer set search_path = public as $fn$
declare v text;
begin
  v := (select value from public.app_storage where key = 'brightsteps-hub-data' and shared = true);
  if v is null then return; end if;
  insert into public.hub_data_backups (size_kb, students, value)
  values (length(v) / 1024,
          coalesce(jsonb_array_length(case when jsonb_typeof(v::jsonb->'students') = 'array' then v::jsonb->'students' end), 0),
          v);
  delete from public.hub_data_backups where taken_at < now() - interval '30 days';
end $fn$;

revoke all on function public.backup_hub_data() from public, anon, authenticated;

-- 3. Every night at 02:00 (Abidjan time) ------------------------------------------------------------

create extension if not exists pg_cron;
select cron.schedule('hub-daily-backup', '0 2 * * *', 'select public.backup_hub_data()');

-- 4. One copy now, and check ----------------------------------------------------------------------

select public.backup_hub_data();

select 'backup' as what, to_char(taken_at, 'DD Mon YYYY HH24:MI') || ' · ' || students || ' students · ' || size_kb || ' KB' as detail
from public.hub_data_backups order by taken_at desc limit 3;

-- TO RESTORE A COPY (only with Claude, never on your own): the copy is in
-- hub_data_backups.value; restoring means writing it back to app_storage.
