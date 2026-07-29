-- Run this once inside your Supabase project's SQL Editor.
-- It creates the single table the app uses to store all of its data.
-- This mirrors how the app worked inside Claude: one JSON document per key.

create table if not exists app_storage (
  key text primary key,
  value text not null,
  shared boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Row Level Security is enabled but wide open for now (phase 1: get it live).
-- Phase 2 should replace these policies with real role based rules,
-- see ROLES_AND_PERMISSIONS.md for the target design.

alter table app_storage enable row level security;

create policy "Allow all reads for now"
  on app_storage for select
  using (true);

create policy "Allow all writes for now"
  on app_storage for insert
  with check (true);

create policy "Allow all updates for now"
  on app_storage for update
  using (true);

create policy "Allow all deletes for now"
  on app_storage for delete
  using (true);
