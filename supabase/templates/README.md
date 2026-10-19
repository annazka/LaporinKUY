# Email konfirmasi pendaftaran

Subject: `Konfirmasi email Anda — LaporKUY`

Tempel isi `confirmation.html` pada Authentication → Emails → Confirm sign up di dashboard Supabase, lalu simpan. Template memakai `TokenHash` Supabase dan membuka halaman LaporKUY terlebih dahulu. Halaman otomatis memverifikasi token saat dibuka dari email, lalu menampilkan “Email sudah dikonfirmasi” hanya setelah Supabase menyatakan verifikasi berhasil. Tidak ada tombol konfirmasi kedua. Jangan mengganti variabel template dengan token nyata.

URL Auth yang diperlukan:
- Site URL: `https://laporkuy.online`
- Redirect URL: `https://laporkuy.online/auth/confirm`

Status: domain laporkuy.online aktif di Vercel dan terverifikasi di Resend. Pengguna telah menyimpan SMTP Resend. Template dan URL Auth domain baru sudah diterapkan melalui dashboard Supabase. Tidak ada email uji yang dikirim otomatis.
