-- BrightSteps Hub: security check, 16 Oct 2026 (READ ONLY, changes nothing)
-- Run in Supabase > SQL Editor, then download the result as CSV and send it to Claude.

-- A. Who can read files (photos, portfolio, attachments)
select 'A file rule' as check,
  policyname || ' | ' || cmd || ' | ' || roles::text || ' | ' || coalesce(qual, '') || ' | ' || coalesce(with_check, '') as detail
from pg_policies where schemaname = 'storage' and tablename = 'objects'
union all
select 'A bucket', id || ' | public=' || public::text || ' | files=' ||
  (select count(*) from storage.objects o where o.bucket_id = b.id)::text
from storage.buckets b
union all
select 'A top folders', bucket_id || ' | ' || split_part(name, '/', 1) || ' = ' || count(*)
from storage.objects group by bucket_id, split_part(name, '/', 1)
union all
-- B. Guardian links and profiles (flagged in September)
select 'B rule', tablename || ' | ' || policyname || ' | ' || cmd || ' | ' || roles::text || ' | ' || coalesce(qual, '')
from pg_policies where schemaname = 'public' and tablename in ('student_guardians', 'profiles', 'students', 'student_medical')
union all
select 'B view', table_name || ' | security_invoker=' ||
  coalesce((select (option_value = 'true')::text from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false')
from information_schema.views v
join pg_class c on c.relname = v.table_name
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where v.table_schema = 'public'
union all
select 'B viewer account', coalesce(full_name, '(no name)') from public.profiles where role = 'viewer'
union all
-- C. Tables anyone signed in could read with row rules switched off
select 'C RLS off', relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
-- D. Functions that run with full rights and that anyone (even signed out) can call
select 'D open function', p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
union all
-- E. Signed-out access to tables
select 'E anon can read', table_name
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and privilege_type = 'SELECT'
order by 1, 2;
