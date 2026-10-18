-- BrightSteps Hub: staff read-and-sign on Resources (Oct 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
-- What it does:
--   * A resource marked "Staff must read and sign" (e.g. the Staff Handbook) can be signed by
--     teachers and learning assistants: full name, drawn signature, and a confirmation tick.
--   * Each person sees and adds only their own signature. The admin (and the viewer account)
--     sees everyone's, with the date.
--   * A signature cannot be changed or removed by staff once given.

create table if not exists public.staff_signatures (
  id uuid primary key default gen_random_uuid(),
  resource_id text not null,
  resource_title text,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  full_name text not null check (length(trim(full_name)) > 1),
  signature text not null,
  signed_at timestamptz not null default now(),
  unique (resource_id, user_id)
);

alter table public.staff_signatures enable row level security;

drop policy if exists "staff signatures read" on public.staff_signatures;
create policy "staff signatures read" on public.staff_signatures for select to authenticated
  using (user_id = auth.uid() or public.hub_my_role() in ('admin', 'viewer'));

drop policy if exists "staff signatures sign" on public.staff_signatures;
create policy "staff signatures sign" on public.staff_signatures for insert to authenticated
  with check (user_id = auth.uid() and public.hub_my_role() in ('admin', 'teacher', 'learning_assistant', 'accountant'));

revoke all on public.staff_signatures from anon;
grant select, insert on public.staff_signatures to authenticated;

-- Check: the table, and who is expected to sign (teachers and learning assistants).
select 'table' as what, 'staff_signatures' as detail
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'staff_signatures')
union all
select 'expected to sign', coalesce(full_name, email) from public.profiles where role in ('teacher', 'learning_assistant')
order by 1, 2;
