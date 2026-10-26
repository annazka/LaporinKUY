-- Run manually in the Supabase SQL Editor of the project used by Preview.
-- First create admin@laporkuy.online via Authentication > Users > Add user,
-- set the requested password there, and enable Auto Confirm User.
-- This script does not create or store a password or modify other accounts.
begin;
do $$
declare account_count integer;confirmed boolean;
begin
 select count(*),bool_and(email_confirmed_at is not null)into account_count,confirmed
 from auth.users where lower(email)='admin@laporkuy.online';
 if account_count<>1 then raise exception 'Buat tepat satu akun admin@laporkuy.online melalui Authentication > Users terlebih dahulu.';end if;
 if not confirmed then raise exception 'Konfirmasikan email akun admin terlebih dahulu.';end if;
 update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"operator"}'::jsonb
 where lower(email)='admin@laporkuy.online';
end;$$;
select email,raw_app_meta_data->>'role' as role,email_confirmed_at is not null as confirmed
from auth.users where lower(email)='admin@laporkuy.online';
commit;
-- Sign in after this step so the new JWT contains the operator role.
