# Email konfirmasi pendaftaran

Subject: `Konfirmasi email kamu — LaporKUY!`

Template baru: [confirmation.html](confirmation.html). Palet monokrom mengikuti website; logo PNG memakai alamat publik produksi dan penulisan merek LaporKUY!. CSS utama inline dan layout tabel agar dapat dibaca di klien email; nama merek tetap terbaca saat gambar diblokir. Warna mungkin disesuaikan oleh pengaturan klien email.

## Pemasangan

1. Buka Supabase proyek LaporKUY → Authentication → Emails → Confirm sign up.
2. Isi subject di atas dan ganti body dengan seluruh isi `confirmation.html`, lalu simpan.
3. Uji melalui pendaftaran akun pengembangan yang memang diizinkan. Jangan menggunakan atau menyebarkan token akun sungguhan di preview.

Template mempertahankan `{{ .TokenHash }}` serta callback `https://laporkuy.online/auth/confirm?token_hash=...&type=email`. Halaman hanya menyatakan sukses sesudah server memverifikasi token ke Supabase. Tidak mengubah akun yang sudah masuk dan tidak membutuhkan tombol konfirmasi kedua.

URL Auth yang dipertahankan:
- Site URL: `https://laporkuy.online`
- Redirect URL: `https://laporkuy.online/auth/confirm`

## Preview dan status

`/previews/confirmation-email.html` menampilkan contoh tanpa token aktif dan menyediakan unduhan template. File unduhan `/previews/confirmation-email-template.txt` harus tetap identik dengan `confirmation.html`.

Template baru disiapkan di repositori pada 28 Oktober 2026. Belum diterapkan ke pengaturan email Supabase: lingkungan hanya memiliki publishable key, tanpa akses Management API. Deployment Vercel tidak mengubah template email Supabase. SMTP Resend dan konfigurasi Auth yang sudah ada dipertahankan; tidak ada email uji yang dikirim otomatis.
