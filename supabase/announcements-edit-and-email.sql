-- BrightSteps Hub: edit school announcements + email them to parents (Oct 2026)
-- Run once in Supabase > SQL Editor, AFTER notify-updates-announcements.sql. Safe to run again. Deletes nothing.
--
-- What it does:
--   * Lets the admin edit an announcement after posting it (fix a mistake instead of deleting).
--     Editing does NOT send a new bell notice or email.
--   * Remembers when an announcement was edited (shown as "Edited") and when it was emailed,
--     so the same announcement is never emailed to families twice.

-- 1. New columns ---------------------------------------------------------------------------------------------------

alter table public.announcements add column if not exists edited_at timestamptz;
alter table public.announcements add column if not exists emailed_at timestamptz;

-- 2. Only the admin can edit -----------------------------------------------------------------------------------------

drop policy if exists "admin edits announcements" on public.announcements;
create policy "admin edits announcements" on public.announcements for update to authenticated
  using (public.hub_my_role() = 'admin')
  with check (public.hub_my_role() = 'admin');

-- 3. Check ----------------------------------------------------------------------------------------------------------
--   * "bell trigger installed" must say yes. If it says no, run notify-updates-announcements.sql first:
--     without it, parents get no bell notice for announcements.
--   * The last line shows how many bell notices your most recent announcement made.

select 'bell trigger installed' as what,
       case when exists (select 1 from pg_trigger where tgname = 'hub_notify_new_announcement') then 'yes' else 'NO' end as detail
union all
select 'edit permission', case when exists (select 1 from pg_policies where tablename = 'announcements'
       and policyname = 'admin edits announcements') then 'yes' else 'NO' end
union all
select 'bell notices for latest announcement', count(*)::text
from public.notifications n
where n.kind = 'announcement'
  and n.title = (select title from public.announcements where title <> 'Lunch menu updated' order by created_at desc limit 1)
  and n.created_at >= (select created_at from public.announcements where title <> 'Lunch menu updated' order by created_at desc limit 1);
