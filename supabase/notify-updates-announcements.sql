-- BrightSteps Hub: bell notice + phone notification for Family Updates and announcements (Oct 2026)
-- Run once in Supabase > SQL Editor, AFTER push-notifications.sql. Safe to run again. Deletes nothing.
--
-- What it does:
--   * New Family Update (Updates screen): every parent of a child in the chosen grades
--     (or every parent, if no grade is chosen) gets a bell notice. Title in English,
--     then French.
--   * New school announcement (Dashboard): every parent who can see it gets a bell notice;
--     staff too when it is marked as visible to staff.
--   * Because they are bell notices, people who turned phone notifications on also get
--     them on their phone.
--   * The person who posted is never notified of their own post. The lunch menu
--     announcement is skipped (the lunch menu already sends its own notice).

-- 1. Parents of children in some grades (all parents when no grade is given) -----------------------------

create or replace function public.hub_parents_of_grades(p_grades text[])
returns setof uuid language sql stable security definer set search_path = public as $fn$
  select distinct p.id
  from public.profiles p
  where p.role = 'parent'
    and (coalesce(array_length(p_grades, 1), 0) = 0
         or exists (select 1 from public.students st
                    where st.legacy_id = any(p.student_ids) and st.grade = any(p_grades)))
$fn$;

revoke all on function public.hub_parents_of_grades(text[]) from public, anon, authenticated;

-- 2. Family Updates (saved in the shared school data) ---------------------------------------------------------

create or replace function public.hub_notify_new_updates()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  post jsonb;
  grades text[];
  me uuid := auth.uid();
begin
  if new.key <> 'brightsteps-hub-data' or not new.shared or tg_op <> 'UPDATE' then return new; end if;

  for post in
    select n from jsonb_array_elements(case when jsonb_typeof(new.value::jsonb->'announcements') = 'array'
                                            then new.value::jsonb->'announcements' else '[]'::jsonb end) n
    where coalesce(n->>'id', '') <> ''
      and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(old.value::jsonb->'announcements') = 'array'
                                                              then old.value::jsonb->'announcements' else '[]'::jsonb end) o
                      where o->>'id' = n->>'id')
  loop
    grades := coalesce((select array_agg(g) from jsonb_array_elements_text(
                case when jsonb_typeof(post->'grades') = 'array' then post->'grades' else '[]'::jsonb end) g), '{}');
    insert into public.notifications (user_id, kind, title, title_fr, body, body_fr)
    select u, 'family_update',
      left(coalesce(nullif(trim(post->>'titleEn'), ''), 'Family update'), 120),
      left(coalesce(nullif(trim(post->>'titleFr'), ''), nullif(trim(post->>'titleEn'), ''), 'Nouvelle information'), 120),
      left(coalesce(nullif(trim(post->>'bodyEn'), ''), 'A new update is on the Hub.'), 300),
      left(coalesce(nullif(trim(post->>'bodyFr'), ''), nullif(trim(post->>'bodyEn'), ''), 'Une nouvelle information est sur le Hub.'), 300)
    from public.hub_parents_of_grades(grades) u
    where u is distinct from me;
  end loop;
  return new;
end $fn$;

drop trigger if exists hub_notify_new_updates on public.app_storage;
create trigger hub_notify_new_updates after update on public.app_storage
  for each row execute function public.hub_notify_new_updates();

-- 3. School announcements (Dashboard) --------------------------------------------------------------------------------

create or replace function public.hub_notify_new_announcement()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  me uuid := auth.uid();
  grades text[];
begin
  if new.title = 'Lunch menu updated' then return new; end if;

  grades := case
    when new.audience is null or new.audience in ('', 'school') then '{}'::text[]
    when new.audience = 'lower' then array['Pre-N','PreK','Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5']
    when new.audience = 'upper' then array['Grade 6','Grade 7']
    else array[new.audience] end;

  insert into public.notifications (user_id, kind, title, title_fr, body, body_fr)
  select u, 'announcement',
    left(coalesce(nullif(trim(new.title), ''), 'School announcement'), 120),
    left(coalesce(nullif(trim(new.title_fr), ''), nullif(trim(new.title), ''), 'Annonce de l''école'), 120),
    left(coalesce(nullif(trim(new.body), ''), ''), 300),
    left(coalesce(nullif(trim(new.body_fr), ''), nullif(trim(new.body), ''), ''), 300)
  from (
    select * from public.hub_parents_of_grades(grades)
    union
    select p.id from public.profiles p
    where coalesce(new.show_staff, true) and p.role in ('admin', 'teacher', 'learning_assistant', 'accountant')
  ) r(u)
  where u is distinct from me;
  return new;
end $fn$;

drop trigger if exists hub_notify_new_announcement on public.announcements;
create trigger hub_notify_new_announcement after insert on public.announcements
  for each row execute function public.hub_notify_new_announcement();

revoke all on function public.hub_notify_new_updates(), public.hub_notify_new_announcement() from public, anon, authenticated;

-- 4. Check ---------------------------------------------------------------------------------------------------------------

select 'trigger' as what, tgname as detail from pg_trigger
where tgname in ('hub_notify_new_updates', 'hub_notify_new_announcement')
union all
select 'parents who would get a whole-school notice', count(*)::text from public.hub_parents_of_grades('{}');
