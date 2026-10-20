-- BrightSteps Hub: bell notice + phone notification for new portfolio entries (Oct 2026)
-- Run once in Supabase > SQL Editor, AFTER push-notifications.sql. Safe to run again. Deletes nothing.
--
-- What it does:
--   * When a teacher note or student reflection is added to a child's portfolio, that
--     child's parents get a bell notice ("New portfolio entry: Jayden"), English then French.
--   * Parents who turned phone notifications on also get it on their phone.
--   * Only the child's own parents are notified. Editing or reacting to an entry sends nothing.
--   * The person who posted is never notified of their own post.

create or replace function public.hub_notify_new_portfolio()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  entry jsonb;
  child text;
  me uuid := auth.uid();
begin
  if new.key <> 'brightsteps-hub-data' or not new.shared or tg_op <> 'UPDATE' then return new; end if;

  for entry in
    select n from jsonb_array_elements(case when jsonb_typeof(new.value::jsonb->'portfolio') = 'array'
                                            then new.value::jsonb->'portfolio' else '[]'::jsonb end) n
    where coalesce(n->>'id', '') <> '' and coalesce(n->>'studentId', '') <> ''
      and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(old.value::jsonb->'portfolio') = 'array'
                                                              then old.value::jsonb->'portfolio' else '[]'::jsonb end) o
                      where o->>'id' = n->>'id')
  loop
    child := coalesce(nullif(split_part(trim(coalesce(entry->>'studentName', '')), ' ', 1), ''), 'your child');

    insert into public.notifications (user_id, student_id, kind, title, title_fr, body, body_fr)
    select p.id, entry->>'studentId', 'portfolio',
      left('New portfolio entry: ' || child, 120),
      left('Nouveau dans le portfolio : ' || case when child = 'your child' then 'votre enfant' else child end, 120),
      left(coalesce(nullif(trim(entry->>'note'), ''), 'A new photo was added.'), 300),
      left(coalesce(nullif(trim(entry->>'note'), ''), 'Une nouvelle photo a été ajoutée.'), 300)
    from public.profiles p
    where p.role = 'parent'
      and (entry->>'studentId') = any(p.student_ids)
      and p.id is distinct from me;
  end loop;
  return new;
end $fn$;

drop trigger if exists hub_notify_new_portfolio on public.app_storage;
create trigger hub_notify_new_portfolio after update on public.app_storage
  for each row execute function public.hub_notify_new_portfolio();

revoke all on function public.hub_notify_new_portfolio() from public, anon, authenticated;

-- Check: should show one row for the trigger
select tgname from pg_trigger where tgname = 'hub_notify_new_portfolio';
