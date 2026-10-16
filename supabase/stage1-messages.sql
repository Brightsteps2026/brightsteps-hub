-- BrightSteps Hub: Stage 1 — messages move to their own tables (Oct 2026)
-- Run once in Supabase > SQL Editor, BEFORE the new Hub code goes live. Safe to run again.
-- Nothing is deleted: the messages stay in the shared school data as well, untouched,
-- for two weeks (so the change can be undone).
--
-- What it does:
--   * hub_messages: one row per message, for both threads of each student
--       family  = parents and teachers (students never see it)
--       student = a Grade 3+ student and teachers (parents never see it)
--   * hub_message_reads: when each person last read each thread (for unread counts).
--   * Copies every existing message and "last read" across, keeping dates and authors.
--   * Same people see the same threads as today:
--       admin: everything · teachers: students of their grades, both threads
--       learning assistants: the parents' thread of their grades, read only
--       parents: their children's family thread · students: their own thread
--       viewer and accountant: no messages
--   * Sending, removing and "mark as read" go through database functions that stamp
--     who sent what; nobody can write a message in someone else's name.
--   * While the old Hub version may still be open on someone's phone, any message
--     it saves is copied across automatically, so nothing is lost during the switch.

-- 1. Tables ---------------------------------------------------------------------------------------

create table if not exists public.hub_messages (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,                    -- the message's place in the old shared data
  student_id text not null,                 -- Hub student id (same as profiles.student_ids)
  thread text not null check (thread in ('family', 'student')),
  author_id uuid,
  author_name text not null,
  author_role text not null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);
create index if not exists hub_messages_thread on public.hub_messages (student_id, thread, created_at);

create table if not exists public.hub_message_reads (
  user_id uuid not null,
  student_id text not null,
  thread text not null check (thread in ('family', 'student')),
  last_read timestamptz not null,
  primary key (user_id, student_id, thread)
);

-- 2. Who may read and write which thread -------------------------------------------------------------

create or replace function public.hub_msg_student_grade(sid text)
returns text language sql stable security definer set search_path = public as $fn$
  select grade from public.students where legacy_id = sid limit 1
$fn$;

create or replace function public.hub_msg_can_read(sid text, th text)
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare r text := public.hub_my_role();
begin
  if r = 'admin' then return true; end if;
  if r = 'teacher' then return public.hub_my_grades() ? coalesce(public.hub_msg_student_grade(sid), ''); end if;
  if r = 'learning_assistant' then
    return th = 'family' and public.hub_my_grades() ? coalesce(public.hub_msg_student_grade(sid), '');
  end if;
  if r = 'parent' then return th = 'family' and public.hub_my_student_ids() ? sid; end if;
  if r = 'student' then return th = 'student' and public.hub_my_student_ids() ? sid; end if;
  return false;
end $fn$;

create or replace function public.hub_msg_can_post(sid text, th text)
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare
  r text := public.hub_my_role();
  g text := public.hub_msg_student_grade(sid);
begin
  if th = 'student' and coalesce(g, '') not in ('Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7') then
    return false;  -- only Grade 3+ students have their own thread
  end if;
  if r in ('admin', 'teacher', 'parent', 'student') then return public.hub_msg_can_read(sid, th); end if;
  return false;   -- learning assistants, viewer, accountant: read only or nothing
end $fn$;

-- 3. Access rules ------------------------------------------------------------------------------------------

alter table public.hub_messages enable row level security;
alter table public.hub_message_reads enable row level security;

drop policy if exists "Messages: who can read" on public.hub_messages;
create policy "Messages: who can read" on public.hub_messages for select to authenticated
  using (deleted_at is null and public.hub_msg_can_read(student_id, thread));
-- No insert / update / delete rules: only the functions below change messages.

drop policy if exists "Message reads: my own" on public.hub_message_reads;
create policy "Message reads: my own" on public.hub_message_reads for select to authenticated
  using (user_id = auth.uid());

revoke all on public.hub_messages, public.hub_message_reads from anon, authenticated;
grant select on public.hub_messages, public.hub_message_reads to authenticated;

-- 4. Sending, removing, marking as read ------------------------------------------------------------------

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
  values (p_student, p_thread, auth.uid(),
          coalesce((select full_name from public.profiles where id = auth.uid()), 'Someone'),
          public.hub_my_role(), b)
  returning * into row;

  insert into public.hub_message_reads (user_id, student_id, thread, last_read)
  values (auth.uid(), p_student, p_thread, row.created_at)
  on conflict (user_id, student_id, thread) do update set last_read = greatest(hub_message_reads.last_read, excluded.last_read);

  return row;
end $fn$;

create or replace function public.remove_hub_message(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.hub_messages set deleted_at = now(), deleted_by = auth.uid()
  where id = p_id and deleted_at is null
    and (author_id = auth.uid() or public.hub_my_role() = 'admin');
  if not found then raise exception 'You cannot remove this message'; end if;
end $fn$;

create or replace function public.mark_hub_thread_read(p_student text, p_thread text)
returns void language plpgsql volatile security definer set search_path = public as $fn$
begin
  if auth.uid() is null or not public.hub_msg_can_read(p_student, p_thread) then return; end if;
  if public.hub_my_role() in ('viewer', 'learning_assistant', 'accountant') then return; end if;
  insert into public.hub_message_reads (user_id, student_id, thread, last_read)
  values (auth.uid(), p_student, p_thread, now())
  on conflict (user_id, student_id, thread) do update set last_read = now();
end $fn$;

-- Unread messages per student and thread. Families count messages from staff;
-- staff count messages from families (parents or students).
create or replace function public.my_unread_messages()
returns table (student_id text, thread text, unread integer)
language sql stable security definer set search_path = public as $fn$
  select m.student_id, m.thread, count(*)::int
  from public.hub_messages m
  left join public.hub_message_reads r
    on r.user_id = auth.uid() and r.student_id = m.student_id and r.thread = m.thread
  where m.deleted_at is null
    and public.hub_my_role() in ('admin', 'teacher', 'parent', 'student')
    and m.created_at > coalesce(r.last_read, 'epoch'::timestamptz)
    and (case when public.hub_my_role() in ('parent', 'student')
              then m.author_role not in ('parent', 'student')
              else m.author_role in ('parent', 'student') end)
    and public.hub_msg_can_read(m.student_id, m.thread)
  group by m.student_id, m.thread
$fn$;

revoke all on function public.hub_msg_student_grade(text), public.hub_msg_can_read(text, text), public.hub_msg_can_post(text, text),
  public.send_hub_message(text, text, text), public.remove_hub_message(uuid), public.mark_hub_thread_read(text, text),
  public.my_unread_messages() from public, anon;
grant execute on function public.send_hub_message(text, text, text), public.remove_hub_message(uuid),
  public.mark_hub_thread_read(text, text), public.my_unread_messages(),
  public.hub_msg_can_read(text, text) to authenticated;  -- (the read rule uses it; it only answers yes/no for yourself)

-- 5. Copy the messages from the shared school data (safe to repeat) -------------------------------------------

create or replace function public.hub_copy_blob_messages(blob jsonb)
returns integer language plpgsql volatile security definer set search_path = public as $fn$
declare n integer;
begin
  with src as (
    select s->>'id' as sid, th.thread, m, o
    from jsonb_array_elements(case when jsonb_typeof(blob->'students') = 'array' then blob->'students' else '[]'::jsonb end) s
    cross join (values ('family', 'messages'), ('student', 'studentMessages')) th(thread, field)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(s->th.field) = 'array' then s->th.field else '[]'::jsonb end)
      with ordinality t(m, o)
    where coalesce(trim(m->>'text'), '') <> ''
  ), ins as (
    insert into public.hub_messages (legacy_id, student_id, thread, author_id, author_name, author_role, body, created_at)
    select sid || ':' || thread || ':' || coalesce(m->>'id', 'n' || o),
      sid, thread,
      case when (m->>'authorId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (m->>'authorId')::uuid end,
      coalesce(nullif(m->>'author', ''), 'Someone'),
      coalesce(nullif(m->>'role', ''), 'admin'),
      left(m->>'text', 4000),
      coalesce(
        case when (m->>'createdAt') ~ '^\d{4}-\d{2}-\d{2}T' then (m->>'createdAt')::timestamptz end,
        case when (m->>'date') ~ '^\d{4}-\d{2}-\d{2}$' then (m->>'date')::date + time '08:00' end,
        now())
    from src
    on conflict (legacy_id) do nothing
    returning 1
  )
  select count(*) into n from ins;

  -- "Last read" for each person (keeps the later date if both exist).
  insert into public.hub_message_reads (user_id, student_id, thread, last_read)
  select (lr.key)::uuid, s->>'id', th.thread, max((lr.value #>> '{}')::timestamptz)
  from jsonb_array_elements(case when jsonb_typeof(blob->'students') = 'array' then blob->'students' else '[]'::jsonb end) s
  cross join (values ('family', 'lastRead'), ('student', 'studentLastRead')) th(thread, field)
  cross join lateral jsonb_each(case when jsonb_typeof(s->th.field) = 'object' then s->th.field else '{}'::jsonb end) lr
  where lr.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (lr.value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}'
  group by 1, 2, 3
  on conflict (user_id, student_id, thread) do update set last_read = greatest(hub_message_reads.last_read, excluded.last_read);

  return n;
end $fn$;

revoke all on function public.hub_copy_blob_messages(jsonb) from public, anon, authenticated;

-- While the switch happens: whenever the shared data is saved, copy any new message.
create or replace function public.hub_copy_blob_messages_trg()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.key = 'brightsteps-hub-data' and new.shared then
    perform public.hub_copy_blob_messages(new.value::jsonb);
  end if;
  return new;
end $fn$;

drop trigger if exists hub_copy_blob_messages on public.app_storage;
create trigger hub_copy_blob_messages after insert or update on public.app_storage
  for each row execute function public.hub_copy_blob_messages_trg();

select public.hub_copy_blob_messages((select value::jsonb from public.app_storage where key = 'brightsteps-hub-data' and shared = true));

-- 6. Check: the counts must match ------------------------------------------------------------------------------

with blob as (select value::jsonb as d from public.app_storage where key = 'brightsteps-hub-data' and shared = true)
select 'messages in the shared data' as what,
  (select count(*) from blob, jsonb_array_elements(d->'students') s,
     jsonb_array_elements(coalesce(s->'messages', '[]') || coalesce(s->'studentMessages', '[]')) m
   where coalesce(trim(m->>'text'), '') <> '')::text as detail
union all
select 'messages in the new table', count(*)::text from public.hub_messages
union all
select 'students with messages', count(distinct student_id)::text from public.hub_messages
union all
select 'read markers copied', count(*)::text from public.hub_message_reads;
