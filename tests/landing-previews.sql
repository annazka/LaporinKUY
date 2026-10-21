-- Run on an authorized development database after the migrations. Always rolls back.
begin;
insert into auth.users(id,email,raw_app_meta_data)
values ('71000000-0000-4000-8000-000000000001','landing-preview-fixture@example.invalid','{}');
insert into storage.objects(bucket_id,name,owner_id) values
('report-photos','71000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001.jpg','71000000-0000-4000-8000-000000000001'),
('report-photos','71000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000002.jpg','71000000-0000-4000-8000-000000000001'),
('report-photos','71000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000003.jpg','71000000-0000-4000-8000-000000000001');
insert into public.reports(id,title,description,category,address,latitude,longitude,photo_path)
values ('73000000-0000-4000-8000-000000000001','Fixture pratinjau jalan','Data sementara untuk pengujian akses foto publik.','Jalan berlubang','Fixture Jakarta Selatan',-6.21,106.84,'71000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001.jpg');
insert into public.report_updates(report_id,kind,message,progress,photo_path)
values ('73000000-0000-4000-8000-000000000001','progress','Foto bukti pembaruan tetap privat.',0,'71000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000002.jpg');
do $$ begin
 if (select public from storage.buckets where id='report-photos') then raise exception 'Bucket must stay private'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if (select count(*) from storage.objects where bucket_id='report-photos' and name like '71000000-0000-4000-8000-000000000001/%') <> 1 then
  raise exception 'Anonymous users must see only the initial photo attached to a report';
 end if;
 if not exists(select 1 from storage.objects where name='71000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001.jpg') then
  raise exception 'Initial report preview is unavailable';
 end if;
end $$;
reset role;
rollback;
