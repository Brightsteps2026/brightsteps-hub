-- BrightSteps Hub: add Tie-Dye Day (Friday 30 October 2026, all grades, everyone can see it)
-- Run once in Supabase > SQL Editor. Safe to run again (it won't add the day twice).
-- It then shows in "Next up" on the Dashboard and on the Calendar tab.

update public.app_storage
set value = jsonb_set(value::jsonb, '{events}',
      coalesce(value::jsonb->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'id', 'tie-dye-day-2026',
        'title', 'Tie-Dye Day',
        'type', 'Event',
        'date', '2026-10-30',
        'grades', '[]'::jsonb,
        'audience', 'everyone',
        'description', 'Tie-Dye Day on Friday 30 October. / Journée Tie-Dye le vendredi 30 octobre.'
      )))::text,
    updated_at = now()
where key = 'brightsteps-hub-data' and shared = true
  and not exists (
    select 1 from jsonb_array_elements(coalesce(value::jsonb->'events', '[]'::jsonb)) e
    where e->>'id' = 'tie-dye-day-2026'
  );

-- Check: late-October events (Tie-Dye Day should be listed on 2026-10-30)
select e->>'title' as title, e->>'date' as starts, e->>'type' as type, e->>'audience' as who_sees_it
from public.app_storage, jsonb_array_elements(value::jsonb->'events') e
where key = 'brightsteps-hub-data' and shared = true
  and e->>'date' between '2026-10-24' and '2026-11-05'
order by e->>'date';
