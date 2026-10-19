create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table public.reports (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 8 and 140),
 description text not null check(length(description) between 20 and 3000), category text not null check(category in ('Jalan berlubang','Trotoar','Drainase','Lampu jalan','Fasilitas umum')),
 address text not null check(length(address) between 8 and 300),latitude double precision not null check(latitude between -6.5 and -6.05),longitude double precision not null check(longitude between 106.65 and 107.0),photo_path text not null,
 status text not null default 'submitted' check(status in ('submitted','verified','scheduled','in_progress','awaiting_confirmation','completed','rejected')),
 priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),progress integer not null default 0 check(progress between 0 and 100),support_count integer not null default 0 check(support_count>=0),
 start_date date,target_date date,last_update_at timestamptz,created_at timestamptz not null default now(),check(target_date>=start_date)
);
create index reports_created_idx on public.reports(created_at desc);
create index reports_open_location_idx on public.reports(category,latitude,longitude) where status not in ('completed','rejected');
create table public.submissions(id uuid primary key default gen_random_uuid(),report_id uuid not null references public.reports(id),user_id uuid not null references auth.users(id),photo_path text not null,description text not null,is_primary boolean not null default false,rewarded boolean not null default false,created_at timestamptz not null default now(),unique(report_id,user_id));
create index submissions_user_idx on public.submissions(user_id);
create table public.report_updates(id uuid primary key default gen_random_uuid(),report_id uuid not null references public.reports(id),kind text not null,message text not null,photo_path text,progress integer not null check(progress between 0 and 100),previous_target date,new_target date,created_at timestamptz not null default now());
create index report_updates_report_idx on public.report_updates(report_id,created_at desc);
create table public.point_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),report_id uuid references public.reports(id),amount integer not null,reason text not null,created_at timestamptz not null default now(),unique(user_id,report_id));
create index point_ledger_user_idx on public.point_ledger(user_id);
create table public.vouchers(id uuid primary key default gen_random_uuid(),name text not null,description text not null,cost integer not null check(cost>0),stock integer not null check(stock>=0),category text not null,valid_until date not null);
create table public.redemptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),voucher_id uuid not null references public.vouchers(id),code text not null unique default ('KUY-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))),created_at timestamptz not null default now());
create index redemptions_user_idx on public.redemptions(user_id);
create index redemptions_voucher_idx on public.redemptions(voucher_id);
alter table public.reports enable row level security;
alter table public.submissions enable row level security;
alter table public.report_updates enable row level security;
alter table public.point_ledger enable row level security;
alter table public.vouchers enable row level security;
alter table public.redemptions enable row level security;
grant select on public.reports,public.report_updates,public.vouchers to anon,authenticated;
grant select on public.submissions,public.point_ledger,public.redemptions to authenticated;
revoke insert,update,delete on public.reports,public.submissions,public.report_updates,public.point_ledger,public.vouchers,public.redemptions from anon,authenticated;
create policy reports_read on public.reports for select to anon,authenticated using(true);
create policy updates_read on public.report_updates for select to anon,authenticated using(true);
create policy vouchers_read on public.vouchers for select to anon,authenticated using(true);
create policy submissions_own on public.submissions for select to authenticated using(user_id=(select auth.uid()));
create policy points_own on public.point_ledger for select to authenticated using(user_id=(select auth.uid()));
create policy redemptions_own on public.redemptions for select to authenticated using(user_id=(select auth.uid()));

-- Privileged operations live outside the API schema. Every operation checks identity.
create function private.submit_report(p_title text,p_description text,p_category text,p_address text,p_latitude double precision,p_longitude double precision,p_photo_path text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid; existing boolean:=false; count_active integer;
begin
 if uid is null then raise exception 'Silakan masuk terlebih dahulu.';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if p_photo_path not like uid::text||'/%' or not exists(select 1 from storage.objects where bucket_id='report-photos' and name=p_photo_path and owner_id=uid::text) then raise exception 'Foto bukti tidak valid.';end if;
 if p_latitude not between -6.5 and -6.05 or p_longitude not between 106.65 and 107.0 then raise exception 'Lokasi harus berada di Jakarta.';end if;
 if length(p_title) not between 8 and 140 or length(p_description) not between 20 and 3000 or length(p_address) not between 8 and 300 then raise exception 'Judul, deskripsi, atau alamat belum lengkap.';end if;
 select count(*) into count_active from public.submissions s join public.reports r on r.id=s.report_id where s.user_id=uid and r.status not in('completed','rejected');
 -- Serialize nearby same-category creation to avoid concurrent duplicate main reports.
 perform pg_advisory_xact_lock(hashtextextended(p_category,1));
 select id into rid from public.reports r where r.category=p_category and r.status not in('completed','rejected','awaiting_confirmation') and (power((r.latitude-p_latitude)*111320,2)+power((r.longitude-p_longitude)*110650,2))<=625 order by created_at limit 1 for update;
 if count_active>=10 and (rid is null or not exists(select 1 from public.submissions where report_id=rid and user_id=uid))then raise exception 'Maksimal 10 laporan aktif. Tunggu salah satu laporan selesai.';end if;
 if rid is null then
 insert into public.reports(title,description,category,address,latitude,longitude,photo_path) values(p_title,p_description,p_category,p_address,p_latitude,p_longitude,p_photo_path) returning id into rid;
 insert into public.submissions(report_id,user_id,photo_path,description,is_primary) values(rid,uid,p_photo_path,p_description,true);
 insert into public.report_updates(report_id,kind,message,progress)values(rid,'submitted','Laporan diterima. Menunggu verifikasi operator.',0);
 else
 existing:=true;
 if exists(select 1 from public.submissions where report_id=rid and user_id=uid)then
 update public.submissions set photo_path=p_photo_path,description=p_description where report_id=rid and user_id=uid;
 return jsonb_build_object('id',rid,'duplicate',true,'already_counted',true);
 end if;
 insert into public.submissions(report_id,user_id,photo_path,description)values(rid,uid,p_photo_path,p_description);
 update public.reports set support_count=support_count+1 where id=rid;
 end if;
 return jsonb_build_object('id',rid,'duplicate',existing,'already_counted',false);
end;$$;
create function public.submit_report(p_title text,p_description text,p_category text,p_address text,p_latitude double precision,p_longitude double precision,p_photo_path text)returns jsonb language sql security invoker set search_path='' as $$select private.submit_report(p_title,p_description,p_category,p_address,p_latitude,p_longitude,p_photo_path);$$;

create function private.operator_update(p_report_id uuid,p_action text,p_message text,p_progress integer,p_start date,p_target date,p_priority text,p_photo_path text)returns void language plpgsql security definer set search_path='' as $$
declare r public.reports; next_status text;old_target date;
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'operator' then raise exception 'Akses khusus operator.';end if;
 select * into r from public.reports where id=p_report_id for update;if not found then raise exception 'Laporan tidak ditemukan.';end if;
 if length(trim(p_message))<10 or length(p_message)>3000 then raise exception 'Isi keterangan minimal 10 karakter.';end if;
 if r.status in('completed','rejected')then raise exception 'Laporan sudah ditutup.';end if;
 if p_photo_path is not null and (p_photo_path not like auth.uid()::text||'/%' or not exists(select 1 from storage.objects where bucket_id='report-photos' and name=p_photo_path and owner_id=auth.uid()::text))then raise exception 'Foto tidak valid.';end if;
 old_target:=r.target_date; next_status:=r.status;
 if p_action='verify' then
 if r.status<>'submitted' then raise exception 'Laporan sudah diverifikasi.';end if;
 if p_start is null or p_target is null or p_target<p_start or p_target<(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal mulai dan target selesai wajib valid.';end if;
 next_status:='scheduled';
 elsif p_action='progress' then
 if r.status not in('scheduled','in_progress')then raise exception 'Laporan belum siap diperbarui.';end if;
 if r.start_date>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal mulai perbaikan belum tiba.';end if;
 if p_progress<r.progress or p_progress>99 then raise exception 'Progres harus meningkat atau tetap, maksimal 99 persen.';end if;
 next_status:='in_progress';p_start:=r.start_date;p_target:=r.target_date;
 elsif p_action='reschedule' then
 if r.status not in('scheduled','in_progress')or p_target is null or p_target<greatest(r.start_date,(now() at time zone 'Asia/Jakarta')::date)then raise exception 'Target baru tidak valid.';end if;
 p_start:=r.start_date;p_progress:=r.progress;
 elsif p_action='finish' then
 if r.status not in('scheduled','in_progress')or p_photo_path is null then raise exception 'Unggah foto hasil perbaikan sebelum menyelesaikan pekerjaan.';end if;
 next_status:='awaiting_confirmation';p_progress:=100;p_start:=r.start_date;p_target:=r.target_date;
 elsif p_action='reject' then
 if r.status<>'submitted' then raise exception 'Hanya laporan yang belum diverifikasi dapat ditolak.';end if;
 next_status:='rejected';p_progress:=0;p_start:=null;p_target:=null;
 else raise exception 'Aksi tidak valid.';
 end if;
 update public.reports set status=next_status,priority=p_priority,progress=p_progress,start_date=p_start,target_date=p_target,last_update_at=now()where id=p_report_id;
 insert into public.report_updates(report_id,kind,message,photo_path,progress,previous_target,new_target)values(p_report_id,p_action,p_message,p_photo_path,p_progress,case when p_action='reschedule'then old_target end,case when p_action in('verify','reschedule')then p_target end);
end;$$;
create function public.operator_update(p_report_id uuid,p_action text,p_message text,p_progress integer,p_start date,p_target date,p_priority text,p_photo_path text)returns void language sql security invoker set search_path='' as $$select private.operator_update(p_report_id,p_action,p_message,p_progress,p_start,p_target,p_priority,p_photo_path);$$;

create function private.confirm_report(p_report_id uuid,p_accept boolean,p_message text)returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();r public.reports;
begin
 if uid is null then raise exception 'Silakan masuk terlebih dahulu.';end if;
 select * into r from public.reports where id=p_report_id for update;
 if not found or r.status<>'awaiting_confirmation'then raise exception 'Laporan belum menunggu konfirmasi.';end if;
 if not exists(select 1 from public.submissions where report_id=p_report_id and user_id=uid and is_primary)then raise exception 'Konfirmasi hanya untuk pelapor utama.';end if;
 if not p_accept and length(trim(p_message))<10 then raise exception 'Jelaskan kendala minimal 10 karakter.';end if;
 update public.reports set status=case when p_accept then 'completed' else 'in_progress'end,progress=case when p_accept then 100 else 90 end where id=p_report_id;
 if p_accept then
 -- Lock participant ledgers in a stable order for atomic awards/redemptions.
 perform pg_advisory_xact_lock(hashtextextended(s.user_id::text,2)) from public.submissions s where s.report_id=p_report_id order by s.user_id;
 insert into public.point_ledger(user_id,report_id,amount,reason)select user_id,report_id,case when is_primary then 100 else 20 end,'Reward simulasi laporan tuntas'from public.submissions where report_id=p_report_id and not rewarded on conflict(user_id,report_id)do nothing;
 update public.submissions set rewarded=true where report_id=p_report_id;
 end if;
 insert into public.report_updates(report_id,kind,message,progress)values(p_report_id,case when p_accept then 'completed'else 'reopened'end,case when p_accept then 'Pelapor utama mengonfirmasi hasil perbaikan. Poin simulasi diberikan.'else p_message end,case when p_accept then 100 else 90 end);
end;$$;
create function public.confirm_report(p_report_id uuid,p_accept boolean,p_message text)returns void language sql security invoker set search_path='' as $$select private.confirm_report(p_report_id,p_accept,p_message);$$;

create function private.redeem_voucher(p_voucher_id uuid)returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();v public.vouchers;balance bigint;result text;
begin
 if uid is null then raise exception 'Silakan masuk terlebih dahulu.';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,2));
 select * into v from public.vouchers where id=p_voucher_id for update;
 if not found or v.stock<1 or v.valid_until<(now() at time zone 'Asia/Jakarta')::date then raise exception 'Voucher tidak tersedia.';end if;
 select coalesce(sum(amount),0)into balance from public.point_ledger where user_id=uid;
 if balance<v.cost then raise exception 'Poin kamu belum cukup.';end if;
 update public.vouchers set stock=stock-1 where id=p_voucher_id;
 insert into public.point_ledger(user_id,amount,reason)values(uid,-v.cost,'Penukaran simulasi: '||v.name);
 insert into public.redemptions(user_id,voucher_id)values(uid,p_voucher_id)returning code into result;
 return result;
end;$$;
create function public.redeem_voucher(p_voucher_id uuid)returns text language sql security invoker set search_path='' as $$select private.redeem_voucher(p_voucher_id);$$;
revoke all on all functions in schema private from public,anon;
grant execute on all functions in schema private to authenticated;
revoke execute on function public.submit_report(text,text,text,text,double precision,double precision,text),public.operator_update(uuid,text,text,integer,date,date,text,text),public.confirm_report(uuid,boolean,text),public.redeem_voucher(uuid)from public,anon;
grant execute on function public.submit_report(text,text,text,text,double precision,double precision,text),public.operator_update(uuid,text,text,integer,date,date,text,text),public.confirm_report(uuid,boolean,text),public.redeem_voucher(uuid)to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('report-photos','report-photos',false,4194304,array['image/jpeg','image/png','image/webp']);
create policy own_photo_upload on storage.objects for insert to authenticated with check(bucket_id='report-photos'and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy own_photo_read on storage.objects for select to authenticated using(bucket_id='report-photos'and (owner_id=(select auth.uid())::text or exists(select 1 from public.reports r where r.photo_path=name) or exists(select 1 from public.report_updates u where u.photo_path=name)));
insert into public.vouchers(name,description,cost,stock,category,valid_until)values
 ('Jelajah museum','Voucher simulasi kunjungan museum. Belum terhubung dengan mitra.',200,50,'Edukasi','2027-12-31'),
 ('Akhir pekan di taman','Voucher simulasi rekreasi Jakarta. Belum terhubung dengan mitra.',300,30,'Rekreasi','2027-12-31'),
 ('Bergerak bersama','Voucher simulasi fasilitas olahraga. Belum terhubung dengan mitra.',150,40,'Olahraga','2027-12-31');
