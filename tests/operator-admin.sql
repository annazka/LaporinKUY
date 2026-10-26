-- Run only after the admin migration on an explicitly authorized development DB.
-- Fixture users, vouchers and audit events are rolled back. Do not run on production.
begin;
insert into auth.users(id,email,raw_app_meta_data)values
 ('90000000-0000-4000-8000-000000000001','operator-admin-test@example.invalid','{"role":"operator"}'),
 ('90000000-0000-4000-8000-000000000002','citizen-admin-test@example.invalid','{}');
do $$
declare vid uuid;denied boolean;data jsonb;today date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 if has_function_privilege('anon','public.operator_admin_overview()','EXECUTE')then raise exception 'Anonymous overview exposed';end if;
 if has_function_privilege('anon','public.operator_manage_voucher(text,uuid,integer,text,text,text,integer,integer,date)','EXECUTE')then raise exception 'Anonymous mutation exposed';end if;
 if has_table_privilege('authenticated','public.vouchers','INSERT')or has_table_privilege('authenticated','public.operator_voucher_events','INSERT')then raise exception 'Direct write exposed';end if;
 if not(select relrowsecurity from pg_class where oid='public.operator_voucher_events'::regclass)then raise exception 'Audit RLS disabled';end if;
 perform set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{}}',true);
 denied:=false;begin perform public.operator_admin_overview();exception when others then denied:=true;end;
 if not denied then raise exception 'Citizen read admin overview';end if;
 denied:=false;begin perform public.operator_manage_voucher('create',p_name=>'Not allowed',p_description=>'Ordinary users cannot create vouchers.',p_category=>'Edukasi',p_cost=>100,p_stock=>2,p_valid_until=>today+30);exception when others then denied:=true;end;
 if not denied then raise exception 'Citizen created a voucher';end if;
 perform set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"operator"}}',true);
 vid:=public.operator_manage_voucher('create',p_name=>'Integration fixture voucher',p_description=>'Voucher for isolated admin integration assertions.',p_category=>'Edukasi',p_cost=>100,p_stock=>2,p_valid_until=>today+30);
 perform public.operator_manage_voucher('stock',vid,5);
 if(select stock from public.vouchers where id=vid)<>7 then raise exception 'Stock increment failed';end if;
 denied:=false;begin perform public.operator_manage_voucher('stock',vid,-10);exception when others then denied:=true;end;
 if not denied or(select stock from public.vouchers where id=vid)<>7 then raise exception 'Negative stock was accepted';end if;
 if(select count(*)from public.operator_voucher_events where voucher_id=vid)<>2 then raise exception 'Audit not transactional';end if;
 if exists(select 1 from public.operator_voucher_events where voucher_id=vid and actor_id<>'90000000-0000-4000-8000-000000000001')then raise exception 'Actor not taken from session';end if;
 denied:=false;begin perform public.operator_manage_voucher('create',p_name=>'Invalid voucher',p_description=>'Cannot accept zero cost.',p_category=>'Edukasi',p_cost=>0,p_stock=>2,p_valid_until=>today+30);exception when others then denied:=true;end;
 if not denied then raise exception 'Invalid cost accepted';end if;
 data:=public.operator_admin_overview();
 if jsonb_typeof(data->'redemptions')<>'array'or jsonb_typeof(data->'events')<>'array' then raise exception 'Overview format invalid';end if;
 if jsonb_path_exists(data,'$.redemptions[*].user_id')then raise exception 'Citizen identity leaked';end if;
end;$$;
rollback;
