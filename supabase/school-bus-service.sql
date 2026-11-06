-- BrightSteps Hub: School Bus Service (November 2026)
-- Run once in Supabase > SQL Editor. Safe to run again. Adds new tables only; changes nothing existing.
--
--   * bus_riders: which students use the bus, their area (zone), on/off switch, home location.
--   * bus_payments: one row per student per month, with an automatic receipt number
--     (BIS-T-0001, BIS-T-0002, ...) the moment it is marked paid.
--
-- Who sees what:
--   * Admin: everything, can change everything.
--   * Parent: only their own children who are switched ON for the bus
--     (area, home location, payments, receipts). A parent can save their own child's
--     home location, nothing else.
--   * Everyone else (teachers, assistants, accountant, viewer, students): nothing.
--
-- Monthly prices (Myriam, 6 Nov 2026):
--   Grand-Bassam, Modeste, Rosier: 55 000 FCFA   ·   Yaou: 65 000 FCFA

-- 1. Areas and prices ------------------------------------------------------------
create or replace function public.bus_zone_fee(p_zone text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_zone
    when 'bassam'  then 55000
    when 'modeste' then 55000
    when 'rosier'  then 55000
    when 'yaou'    then 65000
  end
$$;

-- 2. Students on the bus ---------------------------------------------------------
create table if not exists public.bus_riders (
  student_id  uuid primary key references public.students(id) on delete cascade,
  zone        text not null default 'bassam' check (zone in ('bassam','modeste','rosier','yaou')),
  active      boolean not null default false,
  home_link   text check (home_link is null or length(home_link) <= 500),
  home_lat    double precision check (home_lat is null or home_lat between -90 and 90),
  home_lng    double precision check (home_lng is null or home_lng between -180 and 180),
  home_note   text check (home_note is null or length(home_note) <= 300),
  home_set_at timestamptz,
  home_set_by uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.bus_riders enable row level security;

drop policy if exists "Admin manages bus riders" on public.bus_riders;
create policy "Admin manages bus riders" on public.bus_riders
  for all to authenticated
  using (public.hub_my_role() = 'admin')
  with check (public.hub_my_role() = 'admin');

drop policy if exists "Parents see their own children on the bus" on public.bus_riders;
create policy "Parents see their own children on the bus" on public.bus_riders
  for select to authenticated
  using (active and public.is_my_child(student_id));

create or replace function public.bus_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bus_riders_touch on public.bus_riders;
create trigger bus_riders_touch before update on public.bus_riders
  for each row execute function public.bus_touch();

-- A parent saves their own child's home location (and nothing else).
create or replace function public.bus_set_my_home(
  p_student uuid, p_link text, p_lat double precision, p_lng double precision, p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from bus_riders r
    where r.student_id = p_student and r.active and is_my_child(p_student)
  ) then
    raise exception 'Not allowed';
  end if;
  update bus_riders
     set home_link = nullif(left(trim(coalesce(p_link, '')), 500), ''),
         home_lat = p_lat,
         home_lng = p_lng,
         home_note = nullif(left(trim(coalesce(p_note, '')), 300), ''),
         home_set_at = now(),
         home_set_by = auth.uid()
   where student_id = p_student;
end;
$$;

-- 3. Monthly payments ------------------------------------------------------------
create sequence if not exists public.bus_receipt_seq;

create table if not exists public.bus_payments (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students(id) on delete cascade,
  month              date not null check (extract(day from month) = 1),
  zone               text not null check (zone in ('bassam','modeste','rosier','yaou')),
  amount             integer not null check (amount >= 0),
  paid               boolean not null default false,
  method             text check (method is null or length(method) <= 60),
  paid_at            timestamptz,
  receipt_no         integer,
  receipt_emailed_at timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  unique (student_id, month)
);

alter table public.bus_payments enable row level security;

drop policy if exists "Admin manages bus payments" on public.bus_payments;
create policy "Admin manages bus payments" on public.bus_payments
  for all to authenticated
  using (public.hub_my_role() = 'admin')
  with check (public.hub_my_role() = 'admin');

drop policy if exists "Parents see their own children's bus payments" on public.bus_payments;
create policy "Parents see their own children's bus payments" on public.bus_payments
  for select to authenticated
  using (public.is_my_child(student_id));

-- Number and date the receipt when a payment becomes paid (same as the canteen).
create or replace function public.bus_set_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.paid is true and (tg_op = 'INSERT' or old.paid is distinct from true) then
    if new.receipt_no is null then
      new.receipt_no := nextval('public.bus_receipt_seq');
    end if;
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists bus_set_receipt on public.bus_payments;
create trigger bus_set_receipt
  before insert or update of paid on public.bus_payments
  for each row execute function public.bus_set_receipt();

-- 4. Nobody signed out can call these; only signed-in people (rules above still apply).
revoke all on function public.bus_set_my_home(uuid, text, double precision, double precision, text) from public, anon;
grant execute on function public.bus_set_my_home(uuid, text, double precision, double precision, text) to authenticated;
revoke all on function public.bus_set_receipt() from public, anon, authenticated;
revoke all on function public.bus_touch() from public, anon, authenticated;
revoke all on table public.bus_riders, public.bus_payments from anon;
