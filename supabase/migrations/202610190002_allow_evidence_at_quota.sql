create or replace function private.submit_report(p_title text,p_description text,p_category text,p_address text,p_latitude double precision,p_longitude double precision,p_photo_path text) returns jsonb language plpgsql security definer set search_path='' as $$
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
