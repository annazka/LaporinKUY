-- Allow landing-page previews of initial photos already attached to public reports.
-- The bucket stays private. Unsubmitted uploads, additional submissions, and
-- operator update photos keep their existing authenticated/owner policies.
begin;
drop policy if exists public_report_preview on storage.objects;
create policy public_report_preview on storage.objects
for select to anon
using (
  bucket_id = 'report-photos'
  and exists (select 1 from public.reports r where r.photo_path = name)
);
commit;
