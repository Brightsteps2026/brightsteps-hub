-- BrightSteps Hub: admin rights only after two-step sign-in (20 Oct 2026)
-- Run once in Supabase > SQL Editor, AFTER you have set up your phone on the Hub's
-- new "Set up two-step sign-in" screen. Safe to run again. Deletes nothing.
--
-- What it does:
--   * An admin account only gets admin rights once the 6-digit code has been
--     confirmed in this sign-in (Supabase marks that session "aal2").
--   * With only the password, an admin account can read its own profile (so the
--     Hub can show the code screen) and the school logo, and nothing else.
--   * Every other role (teacher, assistant, accountant, viewer, parent, student)
--     is unchanged.
--
-- How:
--   1. hub_my_role() and get_my_role() report 'admin_pending_mfa' instead of
--      'admin' until the code is confirmed. Every rule and function that uses
--      them stops treating the account as admin.
--   2. Some older rules check profiles.role = 'admin' directly. A "restrictive"
--      rule is added on every table so those are blocked too.
--
-- LOST PHONE? In Supabase > Authentication > Users, open your account and remove
-- the MFA factor (or run the line below with your email). Then sign in to the Hub
-- and scan a new code:
--   delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'YOUR EMAIL');

-- True when the person signed in is an admin who has NOT confirmed the code yet.
create or replace function public.hub_admin_needs_mfa()
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
$fn$;

revoke all on function public.hub_admin_needs_mfa() from public, anon;
grant execute on function public.hub_admin_needs_mfa() to authenticated;

-- 1. Role helpers (same functions, so every existing rule picks this up).
create or replace function public.hub_my_role()
returns text
language sql stable security definer
set search_path to 'public'
as $fn$
  select case
    when p.role = 'admin' and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then 'admin_pending_mfa'
    else p.role
  end
  from public.profiles p where p.id = auth.uid()
$fn$;

create or replace function public.get_my_role()
returns text
language sql stable security definer
set search_path to 'public'
as $fn$
  select case
    when p.role = 'admin' and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then 'admin_pending_mfa'
    else p.role
  end
  from public.profiles p where p.id = auth.uid()
$fn$;

-- 2. A restrictive rule on every table. It only ever affects an admin without
--    the code; for everyone else it is always true.
do $do$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('drop policy if exists "Admin needs two-step sign-in" on public.%I', t.relname);
    if t.relname = 'profiles' then
      execute 'create policy "Admin needs two-step sign-in" on public.profiles as restrictive
               for all to authenticated
               using (id = auth.uid() or not (select public.hub_admin_needs_mfa()))
               with check (not (select public.hub_admin_needs_mfa()))';
    elsif t.relname = 'app_storage' then
      execute 'create policy "Admin needs two-step sign-in" on public.app_storage as restrictive
               for all to authenticated
               using (key = ''brightsteps-hub-logo'' or not (select public.hub_admin_needs_mfa()))
               with check (not (select public.hub_admin_needs_mfa()))';
    else
      execute format('create policy "Admin needs two-step sign-in" on public.%I as restrictive
                      for all to authenticated
                      using (not (select public.hub_admin_needs_mfa()))
                      with check (not (select public.hub_admin_needs_mfa()))', t.relname);
    end if;
  end loop;
end $do$;

-- Files (photos, portfolio, attachments).
drop policy if exists "Admin needs two-step sign-in" on storage.objects;
create policy "Admin needs two-step sign-in" on storage.objects as restrictive
  for all to authenticated
  using (not (select public.hub_admin_needs_mfa()))
  with check (not (select public.hub_admin_needs_mfa()));

-- Check: how many tables now have the rule (should match your number of tables).
select count(*) as tables_protected
from pg_policies
where policyname = 'Admin needs two-step sign-in';

-- UNDO (only if something goes wrong): run these lines.
--   create or replace function public.hub_my_role() returns text language sql stable security definer set search_path to 'public' as $$ select role from public.profiles where id = auth.uid() $$;
--   create or replace function public.get_my_role() returns text language sql stable security definer set search_path to 'public' as $$ select role from public.profiles where id = auth.uid(); $$;
--   do $$ declare t record; begin for t in select schemaname, tablename from pg_policies where policyname = 'Admin needs two-step sign-in' loop execute format('drop policy %I on %I.%I', 'Admin needs two-step sign-in', t.schemaname, t.tablename); end loop; end $$;
