# LaporinKUY

Website pelaporan jalan berlubang Jakarta, dengan akun warga dan operator. Dibangun menggunakan Next.js App Router, React, TypeScript, Tailwind CSS, serta Supabase Auth, Postgres, dan Storage. Hosting menggunakan Vercel.

## Fitur versi awal

- Beranda, pendaftaran, login, dashboard warga, daftar dan pencarian laporan, peta lokasi, detail dan riwayat progres.
- Foto bukti privat, alamat, koordinat GPS atau manual. Cakupan awal Jakarta daratan.
- Penggabungan otomatis sementara berdasarkan kategori dan radius 25 meter, tanpa AI. Laporan tambahan dari akun berbeda menjadi upvote. Akun yang sama memperbarui bukti tanpa tambahan upvote.
- Maksimal 10 laporan aktif per akun. Tidak menerapkan pembagian 7 diproses dan 3 pending.
- Operator memverifikasi laporan, menentukan prioritas, tanggal mulai, dan target selesai.
- Operator mengisi progres harian, kendala, dan bukti. Penanda harian menggunakan zona waktu Asia/Jakarta, termasuk sesudah target terlewati.
- Target lama dan alasan perubahan disimpan dalam riwayat. Laporan terlambat ditandai berdasarkan tanggal, tanpa pekerjaan cron.
- Foto hasil wajib sebelum pekerjaan masuk tahap menunggu konfirmasi. Pelapor utama dapat menerima hasil atau meminta pemeriksaan ulang.
- Poin sementara untuk pengujian, 100 bagi pelapor utama dan 20 bagi pelapor tambahan. Nilai ini belum menjadi keputusan produk final. Pemberian poin dan penukaran memakai transaksi serta penguncian database.
- Voucher simulasi dengan kuota, batas berlaku, kode unik, dan saldo poin. Tidak ada afiliasi dengan penyedia tiket atau layanan publik.

## Menjalankan

Gunakan Node.js 22.13 atau lebih baru.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Isi `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` pada `.env.local`. Keduanya juga harus tersedia pada environment Vercel. Tidak menggunakan service role key di website.

Untuk proyek Supabase baru, jalankan berkas SQL dalam `supabase/migrations` secara berurutan. Proyek LaporinKUY yang disiapkan pada sesi ini sudah menerima migrasi. Jangan menjalankan ulang migrasi awal pada database yang sama.

```bash
npm run typecheck
npm test
npm run build
```

`tests/database.sql` berisi pengujian integrasi dengan fixture sementara dan rollback. Jalankan hanya pada lingkungan pengembangan yang memang diizinkan untuk pengujian. Pengujian tersebut tidak membuat akun demo permanen.

## Menetapkan operator

Pendaftaran umum selalu membuat user. Operator tidak dapat dipilih pada formulir. Setelah pemilik akun mendaftar dan mengonfirmasi email, pengelola proyek menetapkan `app_metadata.role` menjadi `operator` menggunakan Supabase Admin API atau SQL Editor, dengan email yang sudah diverifikasi. Jangan menggunakan `user_metadata` untuk hak akses. Akun perlu keluar lalu masuk kembali setelah perubahan role agar token diperbarui.

Contoh SQL untuk dijalankan pengelola proyek, ganti email dengan akun operator yang benar.

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'operator')
where email = 'operator-yang-sudah-diverifikasi@example.com';
```

Setelan Authentication URL pada Supabase harus mengarah ke domain Vercel yang dipakai, terutama untuk tautan konfirmasi email. Gunakan penyedia SMTP sendiri sebelum menerima pendaftaran publik dalam jumlah besar.

## Hak akses

Data laporan dan riwayat dapat dibaca publik. Identitas pelapor tidak ada pada tabel laporan publik. Submission, saldo poin, dan kode voucher hanya dapat dibaca pemiliknya. Bucket foto privat. Foto laporan dan pembaruan yang sudah terkait laporan dapat dilihat pengguna login melalui endpoint yang memeriksa RLS. Foto unggahan yang belum terkait hanya dapat diakses pemiliknya. Hindari unggahan data pribadi.

Perubahan laporan, progres, poin, dan voucher dilakukan lewat RPC dengan pemeriksaan identitas. Fungsi berhak khusus ada pada schema `private`, bukan schema API. Tabel tidak mengizinkan pengguna melakukan insert, update, atau delete langsung. Session memakai cookie HttpOnly dan pemeriksaan pengguna pada Supabase. Form mutasi memeriksa Origin.

## Batas versi awal

- Gemini dan pemeriksaan semantik foto belum terhubung. UI menyatakannya secara eksplisit. Sistem tidak mengklaim hasil AI.
- Pengelompokan radius 25 meter masih perlu peninjauan operator. Belum ada pemisahan atau penggabungan ulang lewat dashboard.
- Peta memakai embed OpenStreetMap untuk satu laporan terpilih, bukan layer multi-marker Leaflet.
- Konfirmasi akhir saat ini oleh pelapor utama. Mekanisme verifikator pengganti setelah 3 hari belum diaktifkan.
- Belum ada notifikasi email/push harian, SLA per jenis kerusakan, moderasi multiakun, atau pencairan voucher nyata.
- Kode voucher saat ini hanya merupakan bukti penukaran simulasi. Belum ada pemindaian dan penandaan voucher terpakai oleh mitra.
- Pemeriksaan build, TypeScript, aturan tanggal, database, dan advisory keamanan tersedia. Pemeriksaan visual browser belum dijalankan pada lingkungan pembuatan.
