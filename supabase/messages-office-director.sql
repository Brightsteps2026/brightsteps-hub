-- BrightSteps Hub: parents can write to the School office or to the Director (Nov 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
-- Two new private threads per student, next to "family" (parents and teachers)
-- and "student" (Grade 3+ student and teachers):
--   office:   parents of the child + the school office.
--             Miss Myriam (Director) reads and replies; other admins (Mr Patrick)
--             can read but not reply. Teachers never see it.
--   director: parents of the child + Miss Myriam only. Nobody else sees it,
--             not even other admins.
-- Phone notices: a parent's office or director message goes to the Director;
-- the Director's reply goes to the child's parents.

-- 1. Allow the new thread names --------------------------------------------------------------

alter table public.hub_messages drop constraint if exists hub_messages_thread_check;
alter table public.hub_messages add constraint hub_messages_thread_check
  check (thread in ('family', 'student', 'office', 'director'));
alter table public.hub_message_reads drop constraint if exists hub_message_reads_thread_check;
alter table public.hub_message_reads add constraint hub_message_reads_thread_check
  check (thread in ('family', 'student', 'office', 'director'));

-- 2. Who the Director is (Myriam Aoussou) ----------------------------------------------------

create or replace function public.hub_director_id()
returns uuid language sql immutable set search_path = public as $fn$
  select 'c7938eac-08fb-4ac9-933d-0cb24d27082b'::uuid
$fn$;
grant execute on function public.hub_director_id() to authenticated, service_role;

create or replace function public.hub_is_director()
returns boolean language sql stable set search_path = public as $fn$
  select auth.uid() is not null and auth.uid() = public.hub_director_id()
$fn$;

-- 3. Who can read each thread ----------------------------------------------------------------

create or replace function public.hub_msg_can_read(sid text, th text)
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare r text := public.hub_my_role();
begin
  if th = 'director' then
    if public.hub_is_director() then return true; end if;
    return r = 'parent' and public.hub_my_student_ids() ? sid;
  end if;
  if th = 'office' then
    if r = 'admin' then return true; end if;
    return r = 'parent' and public.hub_my_student_ids() ? sid;
  end if;
  if r = 'admin' then return true; end if;
  if r = 'teacher' then return public.hub_my_grades() ? coalesce(public.hub_msg_student_grade(sid), ''); end if;
  if r = 'learning_assistant' then
    return th = 'family' and public.hub_my_grades() ? coalesce(public.hub_msg_student_grade(sid), '');
  end if;
  if r = 'parent' then return th = 'family' and public.hub_my_student_ids() ? sid; end if;
  if r = 'student' then return th = 'student' and public.hub_my_student_ids() ? sid; end if;
  return false;
end $fn$;

-- 4. Who can write in each thread ------------------------------------------------------------

create or replace function public.hub_msg_can_post(sid text, th text)
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare
  r text := public.hub_my_role();
  g text := public.hub_msg_student_grade(sid);
begin
  if th = 'student' and coalesce(g, '') not in ('Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8') then
    return false;  -- only Grade 3+ students have their own thread
  end if;
  if th in ('office', 'director') then
    -- Parents of the child, and the Director. Other admins read only.
    if public.hub_is_director() then return true; end if;
    return r = 'parent' and public.hub_msg_can_read(sid, th);
  end if;
  if r in ('admin', 'teacher', 'parent', 'student') then return public.hub_msg_can_read(sid, th); end if;
  return false;   -- learning assistants, viewer, accountant: read only or nothing
end $fn$;

-- 5. Removing a message: admins only in threads they can write in --------------------------------

create or replace function public.remove_hub_message(p_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.hub_messages set deleted_at = now(), deleted_by = auth.uid()
  where id = p_id and deleted_at is null
    and (author_id = auth.uid()
         or (public.hub_my_role() = 'admin' and public.hub_msg_can_post(student_id, thread)));
  if not found then raise exception 'You cannot remove this message'; end if;
end $fn$;

-- 6. Phone notices ---------------------------------------------------------------------------

create or replace function public.push_from_message()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  g text := public.hub_msg_student_grade(new.student_id);
  from_family boolean := new.author_role in ('parent', 'student');
  staff uuid[];
  family uuid[];
begin
  if new.legacy_id is not null then return new; end if;

  if from_family then
    if new.thread in ('office', 'director') then
      staff := array[public.hub_director_id()];
    else
      select array_agg(p.id) into staff from public.profiles p
      where p.id <> coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (p.role = 'admin'
             or (p.role = 'teacher' and g = any(p.grades_assigned))
             or (new.thread = 'family' and p.role = 'learning_assistant' and g = any(p.grades_assigned)));
    end if;
    perform public.push_enqueue(staff, 'New message from ' || new.author_name, 'Open the Hub to read it.', '/');
  else
    select array_agg(p.id) into family from public.profiles p
    where p.role = (case when new.thread = 'student' then 'student' else 'parent' end)
      and new.student_id = any(p.student_ids);
    perform public.push_enqueue(family,
      'New message from ' || new.author_name,
      case when new.thread = 'student' then 'Open the Hub to read it.' else 'Nouveau message de ' || new.author_name end,
      '/');
  end if;
  return new;
end $fn$;

-- 7. Check -----------------------------------------------------------------------------------
select 'director' as what, full_name as detail from public.profiles where id = public.hub_director_id()
union all
select 'thread rule', pg_get_constraintdef(oid) from pg_constraint where conname = 'hub_messages_thread_check';
