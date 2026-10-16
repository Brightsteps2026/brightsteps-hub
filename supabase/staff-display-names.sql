-- BrightSteps Hub: staff names shown as "Ms Agnes", "Mr Oliver"... (Oct 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
-- What it does:
--   * staff_display_names: the name families see for each staff member
--     (in message threads, phone notifications and message emails).
--   * Fills it for the staff the school already calls Ms / Mr + first name.
--     Anyone not recognised is listed at the end: tell Claude their title.
--   * New messages use this name; existing messages from staff are updated too.
--   * Only the admin can change these names (nobody can rename themselves).

-- 1. The names -------------------------------------------------------------------------------------------

create table if not exists public.staff_display_names (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 60),
  updated_at timestamptz not null default now()
);

alter table public.staff_display_names enable row level security;
drop policy if exists "Staff names: signed in can read" on public.staff_display_names;
drop policy if exists "Staff names: admin can change" on public.staff_display_names;
create policy "Staff names: signed in can read" on public.staff_display_names for select to authenticated using (true);
create policy "Staff names: admin can change" on public.staff_display_names for all to authenticated
  using (public.hub_my_role() = 'admin') with check (public.hub_my_role() = 'admin');
revoke all on public.staff_display_names from anon;
grant select, insert, update, delete on public.staff_display_names to authenticated;

-- Known staff: title by first name. (Never overwrites a name already set.)
insert into public.staff_display_names (user_id, display_name)
select p.id,
  case when split_part(trim(p.full_name), ' ', 1) ilike 'myri%' then 'Ms Myriam'
       else t.title || ' ' || initcap(split_part(trim(p.full_name), ' ', 1)) end
from public.profiles p
join (values ('agnes', 'Ms'), ('myriam', 'Ms'), ('myri', 'Ms'), ('grace', 'Ms'), ('trudy', 'Ms'),
             ('thairy', 'Ms'), ('sandra', 'Ms'), ('maryliz', 'Ms'),
             ('jonathan', 'Mr'), ('oliver', 'Mr'), ('patrick', 'Mr')) t(first, title)
  on lower(split_part(trim(p.full_name), ' ', 1)) = t.first
where p.role in ('admin', 'teacher', 'learning_assistant')
on conflict (user_id) do nothing;

-- 2. The name used when someone sends a message --------------------------------------------------------------

create or replace function public.hub_author_name(uid uuid)
returns text language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select d.display_name from public.staff_display_names d
       join public.profiles p on p.id = d.user_id
      where d.user_id = uid and p.role in ('admin', 'teacher', 'learning_assistant')),
    (select full_name from public.profiles where id = uid),
    'Someone')
$fn$;

revoke all on function public.hub_author_name(uuid) from public, anon, authenticated;

create or replace function public.send_hub_message(p_student text, p_thread text, p_body text)
returns public.hub_messages language plpgsql volatile security definer set search_path = public as $fn$
declare
  b text := left(trim(coalesce(p_body, '')), 4000);
  row public.hub_messages;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if b = '' then raise exception 'The message is empty'; end if;
  if not public.hub_msg_can_post(p_student, p_thread) then raise exception 'You cannot write in this thread'; end if;
  -- At most 30 messages a minute per person (protects against a stuck "send" button).
  if (select count(*) from public.hub_messages where author_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many messages, please wait a moment';
  end if;

  insert into public.hub_messages (student_id, thread, author_id, author_name, author_role, body)
  values (p_student, p_thread, auth.uid(), public.hub_author_name(auth.uid()), public.hub_my_role(), b)
  returning * into row;

  insert into public.hub_message_reads (user_id, student_id, thread, last_read)
  values (auth.uid(), p_student, p_thread, row.created_at)
  on conflict (user_id, student_id, thread) do update set last_read = greatest(hub_message_reads.last_read, excluded.last_read);

  return row;
end $fn$;

-- 3. Existing messages from staff show the new name too ------------------------------------------------------------

update public.hub_messages m set author_name = d.display_name
from public.staff_display_names d
where m.author_id = d.user_id and m.author_name is distinct from d.display_name;

-- When the admin changes a name later, past messages follow.
create or replace function public.staff_display_names_apply()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  update public.hub_messages set author_name = new.display_name
  where author_id = new.user_id and author_name is distinct from new.display_name;
  return new;
end $fn$;

drop trigger if exists staff_display_names_apply on public.staff_display_names;
create trigger staff_display_names_apply after insert or update on public.staff_display_names
  for each row execute function public.staff_display_names_apply();

-- 4. Check: every staff member and the name families will see ----------------------------------------------------------

select p.role, p.full_name, coalesce(d.display_name, '(not set: tell Claude the title)') as families_see
from public.profiles p
left join public.staff_display_names d on d.user_id = p.id
where p.role in ('admin', 'teacher', 'learning_assistant')
order by d.display_name is null desc, p.role, p.full_name;
