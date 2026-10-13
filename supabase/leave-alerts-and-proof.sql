-- BrightSteps Hub: leave request alerts + proof files for past absences
-- Run once in Supabase > SQL Editor.
--
-- What it does:
--   * Every admin gets a bell notice when a staff member sends a leave request,
--     answers "Ask for more info", or adds a proof file later.
--   * Leave requests can carry a proof file (doctor's note, etc.).
--   * Proof files are private: only the person who uploaded it and admins can open
--     them. The accountant and covering teachers cannot.

-- 1. Proof file columns -------------------------------------------------------------

alter table public.leave_requests add column if not exists proof_path text;
alter table public.leave_requests add column if not exists proof_name text;
alter table public.leave_requests add column if not exists proof_added_at timestamptz;
alter table public.leave_requests add column if not exists after_the_fact boolean not null default false;

-- 2. Attach a proof file (from the form, or later from the request card) -------------

create or replace function public.leave_add_proof(p_id uuid, p_path text, p_name text)
returns void language plpgsql volatile security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_path is null or p_path not like 'leave-proof/' || auth.uid()::text || '/%' then
    raise exception 'Upload the file first';
  end if;
  update public.leave_requests
     set proof_path = p_path, proof_name = left(coalesce(p_name, 'Proof'), 200), proof_added_at = now()
   where id = p_id and teacher_id = auth.uid();
  if not found then raise exception 'This request is not yours'; end if;
end $fn$;
revoke all on function public.leave_add_proof(uuid, text, text) from public, anon;
grant execute on function public.leave_add_proof(uuid, text, text) to authenticated;

-- 3. Bell notices for admins --------------------------------------------------------

create or replace function public.leave_notify_admins()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  who text := coalesce((select full_name from public.profiles where id = new.teacher_id), 'A staff member');
  dates text := case when new.start_date = new.end_date then to_char(new.start_date, 'Dy DD Mon')
                     else to_char(new.start_date, 'Dy DD Mon') || ' to ' || to_char(new.end_date, 'Dy DD Mon') end;
  past text := case when new.after_the_fact then ' (already happened)' else '' end;
  t text;
  b text;
begin
  if tg_op = 'INSERT' then
    t := 'Leave request: ' || who;
    b := who || ' asked for leave on ' || dates || past || '. Reason: ' || new.reason
         || case when new.proof_path is not null then '. A proof file is attached' else '' end
         || '. Open the Leave tab to decide.';
  elsif new.teacher_reply is not null and new.teacher_reply is distinct from old.teacher_reply then
    t := 'Leave request answer: ' || who;
    b := who || ' answered your question about leave on ' || dates || ': ' || left(new.teacher_reply, 300);
  elsif new.proof_path is not null and old.proof_path is null then
    t := 'Proof added: ' || who;
    b := who || ' added a proof file to the leave request for ' || dates || '.';
  else
    return new;
  end if;

  insert into public.notifications (user_id, kind, title, body)
  select p.id, 'leave_request', t, b from public.profiles p where p.role = 'admin';
  return new;
end $fn$;

drop trigger if exists leave_notify_admins on public.leave_requests;
create trigger leave_notify_admins
  after insert or update on public.leave_requests
  for each row execute function public.leave_notify_admins();

-- 4. Keep proof files private --------------------------------------------------------
-- A restrictive rule: whatever other rules say, a file under leave-proof/ can only be
-- opened by the person who uploaded it or an admin.

drop policy if exists "Leave proof: uploader or admin only" on storage.objects;
create policy "Leave proof: uploader or admin only" on storage.objects
  as restrictive for select to authenticated
  using (
    bucket_id <> 'attachments'
    or name not like 'leave-proof/%'
    or owner = auth.uid()
    or public.hub_my_role() = 'admin'
  );

-- 5. Check: should list the four new columns, the function and the trigger ----------
select 'column' as what, column_name as detail from information_schema.columns
 where table_schema = 'public' and table_name = 'leave_requests' and (column_name like 'proof%' or column_name = 'after_the_fact')
union all
select 'function', proname from pg_proc where proname in ('leave_add_proof', 'leave_notify_admins')
union all
select 'trigger', tgname from pg_trigger where tgname = 'leave_notify_admins'
order by 1, 2;
