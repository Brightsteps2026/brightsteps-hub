-- BrightSteps Hub: canteen receipts
-- Run once in Supabase > SQL Editor. Safe to run again. Deletes nothing.
--
--   * Every canteen pass gets a receipt number (BIS-C-0001, BIS-C-0002, ...)
--     and the date it was paid, set automatically the moment it is marked paid.
--   * receipt_emailed_at records when the receipt email went to the parents,
--     so the same receipt is never emailed twice by accident.

-- 1. New columns ----------------------------------------------------------------
alter table public.canteen_passes add column if not exists receipt_no integer;
alter table public.canteen_passes add column if not exists paid_at timestamptz;
alter table public.canteen_passes add column if not exists receipt_emailed_at timestamptz;

create sequence if not exists public.canteen_receipt_seq;

-- 2. Number and date the receipt when a pass becomes paid ------------------------
create or replace function public.canteen_set_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.paid is true and (tg_op = 'INSERT' or old.paid is distinct from true) then
    if new.receipt_no is null then
      new.receipt_no := nextval('public.canteen_receipt_seq');
    end if;
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists canteen_set_receipt on public.canteen_passes;
create trigger canteen_set_receipt
  before insert or update of paid on public.canteen_passes
  for each row execute function public.canteen_set_receipt();

-- 3. Passes already paid before today get a number too ---------------------------
update public.canteen_passes
set receipt_no = nextval('public.canteen_receipt_seq'),
    paid_at = coalesce(paid_at, least(start_date::timestamptz, now()))
where paid is true and receipt_no is null;

-- 4. Check: paid passes still without a number. Expect 0.
select count(*) as paid_without_receipt
from public.canteen_passes
where paid is true and receipt_no is null;
