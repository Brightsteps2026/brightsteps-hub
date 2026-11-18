-- BrightSteps Hub: bus screen photos come from each student's Hub profile photo (18 Nov 2026)
-- Already applied. Safe to run again. Deletes nothing.
create or replace function public.sync_student_photos_from_hub()
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update public.students s
     set photo_path = b.path
    from (
      select e->>'id' as bid,
             nullif(coalesce(e->'photo'->>'path', case when jsonb_typeof(e->'photo') = 'string' then e->>'photo' end), '') as path
      from public.app_storage a, jsonb_array_elements(a.value::jsonb->'students') e
      where a.key = 'brightsteps-hub-data' and a.shared = true
    ) b
   where s.legacy_id = b.bid
     and s.photo_path is distinct from b.path;
end $fn$;
revoke all on function public.sync_student_photos_from_hub() from public, anon, authenticated;

create or replace function public.trg_sync_student_photos_from_hub()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.key = 'brightsteps-hub-data' and new.shared = true then
    perform public.sync_student_photos_from_hub();
  end if;
  return new;
end $fn$;

drop trigger if exists sync_student_photos_after_hub_save on public.app_storage;
create trigger sync_student_photos_after_hub_save after insert or update on public.app_storage
  for each row execute function public.trg_sync_student_photos_from_hub();

select public.sync_student_photos_from_hub();
