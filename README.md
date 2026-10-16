# BrightSteps Hub

Private school portal for BrightSteps International School (hub.bischoolci.org): staff, parents and students sign in to see what concerns them.

- **Front end:** React + Vite, deployed on Vercel. Every push to `main` goes live in about a minute.
- **Back end:** Supabase (sign-in, Postgres database with row-level security, file storage, edge functions).
- **Email:** Resend, from notifications@bischoolci.org.

## Where things are

```
src/
  App.jsx                 the frame: roles, top bar, menu, bottom bar, which screen is shown
  styles.css              the Hub's styles
  main.jsx                start-up (storage layer, fonts)
  LoginGate.jsx           sign-in, first password, sign-out
  screens/                one file per screen (Dashboard, Students, Messages, Attendance, Calendar, ...)
  CanteenTab.jsx, IncidentsTab.jsx, LeaveTab.jsx, StaffCheckinTab.jsx,
  SchoolGradebook.jsx, AbsenceReport.jsx,
  TermReports.jsx                        newer screens with their own database tables
                                         (TermReports: term report cards built from the Gradebook)
  data/                   constants (grades, defaults), loading/saving the school data, country list
  lib/                    Supabase connection, translations (i18n.jsx), small helpers (format.js), attachments
  ui/                     shared pieces (common.jsx) and shared colours/styles (tokens.js)
public/                   logo, icons, manifest, robots.txt
supabase/                 SQL files run in the Supabase SQL Editor, and edge functions
vercel.json               security headers
```

## Who sees what

The database decides what each person receives, not the screens:

- **Admin:** everything.
- **Viewer:** everything except family messages and medical details; cannot save.
- **Teacher:** students of their grades, without parent contacts or medical details; behaviour notes for their own grades.
- **Learning assistant:** students of their grades, no message threads, no behaviour notes.
- **Accountant:** student names and grades, billing and fees.
- **Parent:** their own children only. **Student:** their own records and their own thread with teachers.

See `supabase/audit-fixes-2026-10.sql` for the current rules. What each role receives is decided by `hub_trim_core`; `hub_trim` sits in front of it and removes messages and medical details for viewers (`supabase/viewer-no-messages-medical.sql`). Future changes go in `hub_trim_core`.

## Translations

Parents can switch between English and French; all parent-facing text lives in `src/lib/i18n.jsx` (English first, then French). Staff screens are English only.
