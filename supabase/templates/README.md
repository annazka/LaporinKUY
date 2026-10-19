# Email konfirmasi pendaftaran

Subject: `Konfirmasi email Anda — LaporinKUY`

Tempel isi `confirmation.html` pada Authentication → Emails → Confirm sign up di dashboard Supabase, lalu simpan. Template memakai `TokenHash` Supabase dan membuka halaman LaporinKUY terlebih dahulu. Pengguna menekan tombol konfirmasi di halaman tersebut agar pemindai tautan email tidak otomatis menghabiskan token. Jangan mengganti variabel template dengan token nyata.

URL Auth yang diperlukan:
- Site URL: `https://laporinkuy.vercel.app`
- Redirect URL: `https://laporinkuy.vercel.app/auth/confirm`

Status: template disiapkan; belum diterapkan pada dashboard Supabase karena login dashboard belum selesai. Tidak ada email uji yang dikirim.
