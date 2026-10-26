-- Additive admin capabilities. Apply on an authorized development database first.
-- Existing report RPCs and public/owner-only read policies are unchanged.
begin;
create table public.operator_voucher_events(
 id uuid primary key default gen_random_uuid(),voucher_id uuid not null references public.vouchers(id),
 actor_id uuid not null references auth.users(id),kind text not null check(kind in('voucher_create','voucher_stock')),
 message text not null,created_at timestamptz not null default now()
);
alter table public.operator_voucher_events enable row level security;
grant select on public.operator_voucher_events to authenticated;
revoke insert,update,delete on public.operator_voucher_events from anon,authenticated;
create policy operator_voucher_events_read on public.operator_voucher_events for select to authenticated
using((select auth.jwt()->'app_metadata'->>'role')='operator');

create function private.operator_admin_overview() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'operator' then raise exception 'Akses khusus operator.';end if;
 return jsonb_build_object(
  'redemptions',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from(select id,voucher_id,code,created_at from public.redemptions order by created_at desc limit 200)r),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from(select id,voucher_id,null::uuid as report_id,kind,message,created_at,0 as progress,null::text as photo_path,null::date as previous_target,null::date as new_target from public.operator_voucher_events order by created_at desc limit 200)e),'[]'::jsonb)
 );
end;$$;
create function public.operator_admin_overview() returns jsonb language sql security invoker set search_path='' as $$select private.operator_admin_overview();$$;

create function private.operator_manage_voucher(p_action text,p_id uuid default null,p_delta integer default null,p_name text default null,p_description text default null,p_category text default null,p_cost integer default null,p_stock integer default null,p_valid_until date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.vouchers;result uuid;
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'operator' then raise exception 'Akses khusus operator.';end if;
 if p_action='stock' then
  if p_delta is null or p_delta=0 or abs(p_delta::bigint)>10000 then raise exception 'Perubahan stok tidak valid.';end if;
  select * into v from public.vouchers where id=p_id for update;
  if not found then raise exception 'Voucher tidak ditemukan.';end if;
  if v.stock::bigint+p_delta<0 or v.stock::bigint+p_delta>1000000 then raise exception 'Stok tidak mencukupi atau melewati batas.';end if;
  update public.vouchers set stock=stock+p_delta where id=p_id;
  insert into public.operator_voucher_events(voucher_id,actor_id,kind,message)values(p_id,auth.uid(),'voucher_stock',format('Stok voucher %s berubah dari %s menjadi %s.',v.name,v.stock,v.stock+p_delta));
  return p_id;
 elsif p_action='create' then
  if p_name is null or length(trim(p_name)) not between 3 and 140 or p_description is null or length(trim(p_description)) not between 10 and 1000 or p_category is null or length(trim(p_category)) not between 1 and 80 or p_cost is null or p_cost not between 1 and 1000000 or p_stock is null or p_stock not between 0 and 1000000 or p_valid_until is null or p_valid_until<(now() at time zone 'Asia/Jakarta')::date then raise exception 'Data voucher tidak valid.';end if;
  insert into public.vouchers(name,description,cost,stock,category,valid_until)values(trim(p_name),trim(p_description),p_cost,p_stock,trim(p_category),p_valid_until)returning id into result;
  insert into public.operator_voucher_events(voucher_id,actor_id,kind,message)values(result,auth.uid(),'voucher_create',format('Voucher %s dibuat dengan %s poin dan %s stok.',trim(p_name),p_cost,p_stock));
  return result;
 end if;
 raise exception 'Tindakan tidak valid.';
end;$$;
create function public.operator_manage_voucher(p_action text,p_id uuid default null,p_delta integer default null,p_name text default null,p_description text default null,p_category text default null,p_cost integer default null,p_stock integer default null,p_valid_until date default null)
returns uuid language sql security invoker set search_path='' as $$select private.operator_manage_voucher(p_action,p_id,p_delta,p_name,p_description,p_category,p_cost,p_stock,p_valid_until);$$;
revoke all on function private.operator_admin_overview(),public.operator_admin_overview(),private.operator_manage_voucher(text,uuid,integer,text,text,text,integer,integer,date),public.operator_manage_voucher(text,uuid,integer,text,text,text,integer,integer,date)from public,anon;
grant execute on function private.operator_admin_overview(),public.operator_admin_overview(),private.operator_manage_voucher(text,uuid,integer,text,text,text,integer,integer,date),public.operator_manage_voucher(text,uuid,integer,text,text,text,integer,integer,date)to authenticated;

commit;
