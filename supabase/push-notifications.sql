-- BrightSteps Hub: phone notifications (push) — Oct 2026
-- Run once in Supabase > SQL Editor, AFTER stage1-messages.sql. Safe to run again. Deletes nothing.
--
-- What it does:
--   * Remembers which phones/computers asked for notifications (push_subscriptions).
--   * Every new bell notice (absence, report card, leave request, lunch menu...) and
--     every new Hub message becomes a phone notification for the people concerned,
--     if they turned notifications on. Message text is never shown, only who wrote.
--   * Notifications are sent by the "push" Edge Function. The database calls it at
--     once, and again every 5 minutes for anything not delivered yet (up to 1 hour).
--   * The secret the database uses to call the function is created here, inside the
--     database: nobody has to copy any key.

-- 1. Settings, phones and the queue ------------------------------------------------------------------

create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  secret text not null default (gen_random_uuid()::text || gen_random_uuid()::text),
  vapid_public text,
  vapid_private text,
  function_url text not null default 'https://dduneischfnehmkfnuik.supabase.co/functions/v1/push'
);
insert into public.push_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  title text not null,
  body text,
  url text not null default '/',
  created_at timestamptz not null default now(),
  attempts int not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz
);
create index if not exists push_outbox_pending on public.push_outbox (created_at) where sent_at is null;

-- Only the Edge Function (server key) touches these. Nobody can read them from the Hub.
alter table public.push_config enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_outbox enable row level security;
revoke all on public.push_config, public.push_subscriptions, public.push_outbox from anon, authenticated;

-- 2. Adding to the queue ---------------------------------------------------------------------------------------

-- Queues one notification per person who has notifications turned on.
create or replace function public.push_enqueue(p_users uuid[], p_title text, p_body text, p_url text default '/')
returns void language plpgsql volatile security definer set search_path = public as $fn$
begin
  insert into public.push_outbox (user_id, title, body, url)
  select distinct u, left(p_title, 120), left(p_body, 200), coalesce(p_url, '/')
  from unnest(p_users) u
  where u is not null and exists (select 1 from public.push_subscriptions s where s.user_id = u);
end $fn$;

-- Bell notices -> notifications. Parents see the English title, then the French one.
create or replace function public.push_from_notification()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare r text := (select role from public.profiles where id = new.user_id);
begin
  perform public.push_enqueue(array[new.user_id],
    coalesce(new.title, 'BrightSteps Hub'),
    case when r = 'parent' then coalesce(new.title_fr, left(new.body, 160)) else left(new.body, 160) end,
    '/');
  return new;
end $fn$;

drop trigger if exists push_from_notification on public.notifications;
create trigger push_from_notification after insert on public.notifications
  for each row execute function public.push_from_notification();

-- New messages -> the people on the other side of the thread (never the message text).
-- Messages copied from the old shared data (legacy_id) are not notified again.
create or replace function public.push_from_message()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  g text := public.hub_msg_student_grade(new.student_id);
  from_family boolean := new.author_role in ('parent', 'student');
  staff uuid[];
  family uuid[];
begin
  if new.legacy_id is not null then return new; end if;

  if from_family then
    select array_agg(p.id) into staff from public.profiles p
    where p.id <> coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (p.role = 'admin'
           or (p.role = 'teacher' and g = any(p.grades_assigned))
           or (new.thread = 'family' and p.role = 'learning_assistant' and g = any(p.grades_assigned)));
    perform public.push_enqueue(staff, 'New message from ' || new.author_name, 'Open the Hub to read it.', '/');
  else
    select array_agg(p.id) into family from public.profiles p
    where p.role = (case when new.thread = 'family' then 'parent' else 'student' end)
      and new.student_id = any(p.student_ids);
    perform public.push_enqueue(family,
      'New message from ' || new.author_name,
      case when new.thread = 'family' then 'Nouveau message de ' || new.author_name else 'Open the Hub to read it.' end,
      '/');
  end if;
  return new;
end $fn$;

drop trigger if exists push_from_message on public.hub_messages;
create trigger push_from_message after insert on public.hub_messages
  for each row execute function public.push_from_message();

-- 3. Sending: call the push function ----------------------------------------------------------------------------

create extension if not exists pg_net;

create or replace function public.push_kick()
returns void language plpgsql volatile security definer set search_path = public as $fn$
declare c record;
begin
  select secret, function_url into c from public.push_config where id = 1;
  perform net.http_post(
    url := c.function_url,
    body := '{"action": "deliver"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', c.secret)
  );
end $fn$;

create or replace function public.push_outbox_kick()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  perform public.push_kick();
  return null;
end $fn$;

drop trigger if exists push_outbox_kick on public.push_outbox;
create trigger push_outbox_kick after insert on public.push_outbox
  for each statement execute function public.push_outbox_kick();

-- The function takes up to 100 waiting notifications at a time (never the same one twice at once).
create or replace function public.push_claim(p_limit int default 100)
returns setof public.push_outbox language sql volatile security definer set search_path = public as $fn$
  update public.push_outbox o set claimed_at = now(), attempts = o.attempts + 1
  where o.id in (
    select id from public.push_outbox
    where sent_at is null and attempts < 3 and created_at > now() - interval '1 hour'
      and (claimed_at is null or claimed_at < now() - interval '2 minutes')
    order by id limit p_limit
    for update skip locked)
  returning o.*
$fn$;

-- Every 5 minutes: try again anything not delivered; clear notifications older than 7 days.
create or replace function public.push_retry()
returns void language plpgsql volatile security definer set search_path = public as $fn$
begin
  delete from public.push_outbox where created_at < now() - interval '7 days';
  if exists (select 1 from public.push_outbox where sent_at is null and attempts < 3 and created_at > now() - interval '1 hour') then
    perform public.push_kick();
  end if;
end $fn$;

create extension if not exists pg_cron;
select cron.schedule('hub-push-retry', '*/5 * * * *', 'select public.push_retry()');

revoke all on function public.push_enqueue(uuid[], text, text, text), public.push_from_notification(), public.push_from_message(),
  public.push_kick(), public.push_outbox_kick(), public.push_claim(int), public.push_retry() from public, anon, authenticated;
grant execute on function public.push_claim(int) to service_role;

-- 4. Check -------------------------------------------------------------------------------------------------------------

select 'push settings' as what, case when secret is not null then 'ready' else 'missing' end as detail from public.push_config
union all
select 'trigger', tgname from pg_trigger where tgname in ('push_from_notification', 'push_from_message', 'push_outbox_kick')
union all
select 'schedule', jobname from cron.job where jobname = 'hub-push-retry';
