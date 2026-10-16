-- BrightSteps Hub: 2026–2027 terms and breaks
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
--   Term 1  Mon 7 Sep 2026  – Tue 15 Dec 2026
--   Term 2  Mon 11 Jan 2027 – Fri 26 Mar 2027
--   Term 3  Mon 12 Apr 2027 – Tue 8 Jun 2027
--   Breaks (on the calendar for everyone): October (already there), Christmas,
--   February (2 days), Easter. A break already on the calendar on those dates
--   is not added again.

-- 1. Settings: school year and the three terms ------------------------------------------------------------

update public.app_storage
set value = jsonb_set(jsonb_set(value::jsonb,
      '{settings,academicYear}', '{"startDate": "2026-09-07", "endDate": "2027-06-08"}'::jsonb),
      '{settings,terms}', '[
        {"name": "Term 1", "startDate": "2026-09-07", "endDate": "2026-12-15"},
        {"name": "Term 2", "startDate": "2027-01-11", "endDate": "2027-03-26"},
        {"name": "Term 3", "startDate": "2027-04-12", "endDate": "2027-06-08"}
      ]'::jsonb)::text,
    updated_at = now()
where key = 'brightsteps-hub-data' and shared = true;

-- 2. Breaks on the calendar --------------------------------------------------------------------------------------

with breaks(id, title, starts, ends, description) as (values
  ('christmas-break-2026', 'Christmas Break', '2026-12-16', '2027-01-08',
   'No school from Wednesday 16 December to Friday 8 January. School resumes on Monday 11 January. / Pas d''école du mercredi 16 décembre au vendredi 8 janvier. Reprise des cours le lundi 11 janvier.'),
  ('february-break-2027', 'February Break', '2027-02-18', '2027-02-19',
   'No school on Thursday 18 and Friday 19 February. / Pas d''école le jeudi 18 et le vendredi 19 février.'),
  ('easter-break-2027', 'Easter Break', '2027-03-29', '2027-04-09',
   'No school from Monday 29 March (Easter Monday) to Friday 9 April. School resumes on Monday 12 April. / Pas d''école du lundi 29 mars (lundi de Pâques) au vendredi 9 avril. Reprise des cours le lundi 12 avril.')
), current_events as (
  select coalesce(value::jsonb->'events', '[]'::jsonb) as ev
  from public.app_storage where key = 'brightsteps-hub-data' and shared = true
), to_add as (
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'title', b.title, 'type', 'Holiday', 'date', b.starts, 'endDate', b.ends,
      'grades', '[]'::jsonb, 'audience', 'everyone', 'description', b.description)), '[]'::jsonb) as add
  from breaks b, current_events c
  where not exists (
    select 1 from jsonb_array_elements(c.ev) e
    where e->>'id' = b.id
       or (coalesce(e->>'date', '') between b.starts and b.ends
           and (e->>'type' = 'Holiday' or e->>'title' ~* '(break|holiday|vacances|cong)'))
  )
)
update public.app_storage
set value = jsonb_set(value::jsonb, '{events}', coalesce(value::jsonb->'events', '[]'::jsonb) || (select add from to_add))::text,
    updated_at = now()
where key = 'brightsteps-hub-data' and shared = true
  and jsonb_array_length((select add from to_add)) > 0;

-- 3. Check: the terms, then every break on the calendar this school year ---------------------------------------

select 'term' as what, t->>'name' as title, t->>'startDate' as starts, t->>'endDate' as ends
from public.app_storage, jsonb_array_elements(value::jsonb->'settings'->'terms') t
where key = 'brightsteps-hub-data' and shared = true
union all
select 'calendar', e->>'title', e->>'date', coalesce(e->>'endDate', e->>'date')
from public.app_storage, jsonb_array_elements(value::jsonb->'events') e
where key = 'brightsteps-hub-data' and shared = true
  and (e->>'type' = 'Holiday' or e->>'title' ~* '(break|holiday|vacances|cong)')
  and e->>'date' between '2026-09-01' and '2027-06-30'
order by 1 desc, 3;
