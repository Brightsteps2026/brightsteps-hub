# Retiring the shared school-data blob — plan

Written 16 Oct 2026, for Myriam's approval. Nothing in this plan has been done yet.

## Where things stand

The Hub keeps almost everything in one shared record (`app_storage`, key `brightsteps-hub-data`), about 20 sections:
students (with their message threads inside each student), attendance, portfolio, assignments, resources,
announcements, events, billing, fee schedule, admissions, staff, behaviour, reports, plans, standards, rubrics,
accreditation, classes, settings and the activity log.

Every save rewrites the whole record. The database then trims it differently for each role (`hub_trim`) and
merges each save back (`save_hub_data_core`). This works, but:

- one wrong merge can affect every section at once;
- every privacy rule lives in two very large functions, which is hard to check;
- the record grows all year (messages, attendance), so the Hub gets slower;
- newer features (Gradebook, report cards, canteen, leave, check-in) already use their own tables, and the
  students table is only a copy kept in step by a trigger.

## The approach: one section at a time, always reversible

For each section:

1. Create its own table, with access rules per role (like the Gradebook tables).
2. Copy the data across and run a comparison query: the counts and contents must match.
3. Switch the screen(s) for that section to the table.
4. Keep the old section in the blob, untouched and read-only, for two weeks.
   If anything is wrong, switch the screen back. No data is lost.
5. After two weeks without problems, remove the section from the blob and from the trim and merge functions.

Changes are made on weekends or during school breaks, never in the middle of a school day.

## Order

| Stage | What moves | Why this order |
|---|---|---|
| 0 | Daily automatic backup of the whole blob (kept 30 days) | Safety net before anything else |
| 1 | Messages (parent–teacher threads, student threads, read status) | Your top priority: messages must always arrive. Today they live inside each student's record, so every message rewrites the whole school record. |
| 2 | Students become the real source (Students screen saves to the students, guardians and medical tables; the trigger runs the other way) | Everything else points to students |
| 3 | Attendance | Grows every day; feeds absence alerts and report cards |
| 4 | Portfolio, assignments, resources, announcements, events | Families see these; each gets clear per-family rules |
| 5 | Billing, fee schedule, admissions, staff | Accountant and admin only |
| 6 | Behaviour, plans, standards, rubrics, accreditation, classes, old reports | Staff only, low risk |
| 7 | Blob keeps settings only; the large trim and merge functions are removed | Done |

## What it costs

- Roughly one working session per stage, plus a SQL script for you to run each time.
- Stages 1 and 2 are the largest; stages 5–6 are small.
- No change for staff or families, except that saving becomes faster and messages more reliable.

## What needs a decision from Myriam

- Approve the plan and the order (especially messages before students).
- When stage 1 can happen (a weekend or the next break).
