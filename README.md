# LaporKUY

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

Untuk proyek Supabase baru, jalankan berkas SQL dalam `supabase/migrations` secara berurutan. Proyek LaporKUY yang disiapkan pada sesi ini sudah menerima migrasi. Jangan menjalankan ulang migrasi awal pada database yang sama.

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

- Gemini berjalan otomatis saat foto JPG, PNG, atau WebP dipilih (maksimal 4 MB), termasuk di halaman /ai-test setelah login. Pratinjau tampil selama unggah dan analisis. Pergantian foto membatalkan proses lama; Coba Lagi memakai foto yang masih dipilih. Hasil berhasil digunakan ulang untuk gambar identik, tanpa memanggil AI kembali. Foto dikirim ke Google melalui server, tanpa membuka API key. Hasil menampilkan jenis kerusakan, tingkat kerusakan, prioritas, alasan, dan model. Analisis ini belum disimpan ke laporan dan tidak otomatis mengubah keputusan operator.
- Atur GEMINI_API_KEY pada environment server. GEMINI_MODEL sebaiknya ditetapkan pada model yang sudah diuji. Produksi menggunakan gemini-3.6-flash setelah permintaan gambar ke 3.8 dan 3.7 melewati timeout. Jika kosong sistem memilih model Flash stabil tertinggi dari models.list; daftar model tidak menjamin latensi analisis gambar. Preview memerlukan key tersendiri jika ingin menguji analisis di Preview.
- scripts/gemini-smoke.mjs merupakan perintah pengujian nyata sekali jalan, bukan bagian build default. Memakai foto instrumen publik dari dokumentasi Google sebagai kasus negatif, serta gagal jika foto tersebut dianggap kerusakan infrastruktur. Perintah ini memerlukan akses internet dan API key pada environment.
- Pembatasan AI (6 analisis baru per menit per pengguna), deduplikasi permintaan, dan cache hasil 10 menit hanya per instance server. Gambar dan cache tidak dibagikan antar pengguna. Kuota lintas instance perlu ditambahkan sebelum peluncuran luas. Batas waktu keseluruhan endpoint 55 detik, di bawah durasi fungsi 60 detik; pembatalan klien diteruskan ke penyedia jika tidak ada peminta lain.
- Pengelompokan radius 25 meter masih perlu peninjauan operator. Belum ada pemisahan atau penggabungan ulang lewat dashboard.
- Peta memakai embed OpenStreetMap untuk satu laporan terpilih, bukan layer multi-marker Leaflet.
- Konfirmasi akhir saat ini oleh pelapor utama. Mekanisme verifikator pengganti setelah 3 hari belum diaktifkan.
- Belum ada notifikasi email/push harian, SLA per jenis kerusakan, moderasi multiakun, atau pencairan voucher nyata.
- Kode voucher saat ini hanya merupakan bukti penukaran simulasi. Belum ada pemindaian dan penandaan voucher terpakai oleh mitra.
- Pemeriksaan build, TypeScript, aturan tanggal, database, dan advisory keamanan tersedia.

## Latar Bundaran HI dan waktu WIB

Antarmuka tetap monokrom. Gerakan video mengikuti kecepatan asli; fase dipilih berdasarkan WIB.

Fase malam memakai satu bagian 22 detik dari rekaman asli proyek, disimpan di `public/media/sources/bundaran-hi-night-original.mp4`. File sumber 88,2 detik itu sendiri sudah mengulang bagian sekitar 22 detik. Overlap akhir–awal 3 detik menghasilkan satu loop 19 detik pada 30 fps. Gerakan tidak kembali ke awal setiap satu detik. Tidak ada penggandaan potongan pendek untuk memperpanjang durasi malam.

Pagi, siang, dan sore masih bersumber dari video AI 10 detik: gerakan uniknya hanya sekitar 0,7–2 detik per fase. File hasil 8 detik berisi pengulangan potongan tersebut, sehingga ketiga fase ini **masih membutuhkan rekaman yang lebih panjang** untuk menghilangkan pengulangan cepat. Menggandakan durasi file atau menambah crossfade tidak menambah gerakan unik.

Jalankan `python scripts/generate-phase-loops.py --phase night` untuk membangun ulang malam saja, atau hilangkan `--phase` untuk semua fase. Generator mempertahankan frame rate sumber dan memakai overlap smoothstep, tanpa memperlambat atau membalik gerakan. Output diperiksa sebelum menggantikan video aktif.

`lib/video-clock.mjs` memilih perpaduan klip berdasarkan waktu aktual Asia/Jakarta: malam 18.00–05.00, pagi 05.00–10.00, siang 10.00–15.00, sore 15.00–18.00. Peralihan memakai smoothstep selama satu jam sebelum sampai satu jam setelah batas fase (04.00–06.00, 09.00–11.00, 14.00–16.00, 17.00–19.00). Pergantian hari tetap pada klip malam yang sama tanpa reset. Perpaduan diperbarui pada frame tampilan (hingga 30 kali/detik) dari waktu aktual, serta langsung saat tab aktif kembali; gerakan video tidak mengikuti pemetaan 10 detik menjadi 24 jam.

Video dijeda ketika tab tersembunyi, atas pilihan pengguna, atau jika preferensi reduced motion aktif. Tombol Putar video melanjutkan gerakan dan dapat mengaktifkan autoplay yang diblokir browser. Sinkronisasi fase WIB tetap otomatis saat gerakan dijeda. Poster sesuai fase tetap tampil bila video gagal dimuat. Efek blur dan overlay gelap saat scroll dipertahankan.

Generator memeriksa jumlah frame, membandingkan perubahan luminans di sambungan dengan dua frame sumber yang memang bersebelahan, dan menyimpan hasil beserta SHA-256 aset di `tests/fixtures/video-loop-metrics.json`. `npm test` memeriksa batas diskontinuitas serta kecocokan hash. Ini mengukur sambungan, bukan mengklaim rekaman pendek memiliki gerakan unik tanpa pengulangan.
