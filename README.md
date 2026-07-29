# BrightSteps Hub — Real Deployable Project

This is the same BrightSteps Hub you've been using, converted into a real project that can run on its own website, outside of Claude. Everything I could set up ahead of time is done. The steps below need your own accounts, since I can't create those for you.

## What's already done

- A real React project (Vite), ready to build and deploy
- All the same features: Dashboard, Students, Staff, Attendance, Portfolio, Assessment, Gradebook, Planning, Calendar, Admissions, Assignments, Reports, Behavior, Resources, Accreditation, AI Assistant, Settings
- A storage layer that mirrors what you've been using, now backed by a real database (Supabase) instead of Claude's internal storage
- A ready-to-run SQL file that sets up the one database table this app needs

## What you need to do (about 20 minutes)

### 1. Create a Supabase project
- Go to supabase.com and sign up (free tier is enough for this size school)
- Create a new project, pick any name and a database password (save it somewhere)
- Once it's ready, open the SQL Editor in the left sidebar
- Copy everything from `supabase/schema.sql` in this project and run it
- Go to Settings > API, copy the "Project URL" and the "anon public" key

### 2. Configure the app
- In this project folder, copy `.env.example` to a new file named `.env`
- Paste your Project URL and anon key into it

### 3. Put this project on GitHub
- Create a free GitHub account if you don't have one
- Create a new repository and upload this whole folder to it
  (a developer or anyone comfortable with git can do `git init`, `git add .`, `git commit`, `git push` in a few minutes)

### 4. Deploy on Vercel
- Go to vercel.com and sign up with your GitHub account
- Click "New Project," select the repository you just created
- Before deploying, add your two environment variables (the same ones from your `.env` file) in Vercel's project settings
- Click Deploy. Vercel gives you a live URL when it finishes, usually under a minute

That's it. From that point, the app lives at its own real web address, and anyone with the link can open it, no Claude required.

## Important limitations to know about

- **No real user logins yet.** Right now, everyone who has the link sees everything, the same as it worked inside Claude. See `ROLES_AND_PERMISSIONS.md` for the exact spec of who should see what. Adding real logins (Supabase Auth) and enforcing that spec with Row Level Security policies is the next real piece of work, best handed to a developer.
- **The AI Assistant tab will not work as is.** It was calling Claude through Anthropic's platform for free while inside Claude. Once deployed on its own, it needs your own Anthropic API key and a small secure backend function to call it safely (API keys should never sit directly in browser code). Until that's set up, that one tab just won't respond, everything else works normally.
- **File uploads still aren't supported.** Same as before, Resources only holds links, not uploaded files.

## Making future edits

Once this is deployed, you have two paths for changes:
- Come back to this Claude conversation, describe the change, and I'll update this same project's code, then you redeploy (Vercel redeploys automatically every time you push new code to GitHub)
- Or hand the project to a developer to work on directly

## Project structure

```
src/
  App.jsx              the whole application (same as before)
  main.jsx             starting point, loads the storage layer first
  lib/
    supabaseClient.js   connects to your Supabase project
    windowStorage.js    makes storage work the same way it did inside Claude
supabase/
  schema.sql            run this once in Supabase's SQL Editor
ROLES_AND_PERMISSIONS.md  the access control spec for a developer to implement
```
