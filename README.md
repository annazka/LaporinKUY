# LaporKUY

Website pelaporan jalan berlubang Jakarta, dengan akun warga dan operator. Dibangun menggunakan Next.js App Router, React, TypeScript, Tailwind CSS, serta Supabase Auth, Postgres, dan Storage. Hosting menggunakan Vercel.

## Fitur versi awal

- Beranda dengan slider foto laporan, pencarian dan filter status, pendaftaran, login, dashboard warga, detail dan riwayat progres. Halaman daftar laporan dipusatkan di `/#laporan`; halaman peta dan katalog rewards ditunda.
- Pratinjau foto awal laporan publik, foto bukti tambahan privat, alamat, koordinat GPS atau manual. Cakupan awal Jakarta daratan.
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

Data laporan dan riwayat dapat dibaca publik. Identitas pelapor tidak ada pada tabel laporan publik. Submission, saldo poin, dan kode voucher hanya dapat dibaca pemiliknya. Bucket foto tetap privat. Kebijakan `public_report_preview` mengizinkan pengunjung membaca hanya foto awal yang sudah direferensikan laporan publik. Endpoint `/api/report-preview/[id]` menyelesaikan path dari ID laporan, memvalidasi path dan jenis gambar, lalu membaca Storage dengan key publik dan RLS; tanpa service role. Foto pembaruan tetap memerlukan login melalui endpoint privat yang memeriksa RLS. Foto unggahan yang belum terkait hanya dapat diakses pemiliknya. Hindari unggahan data pribadi.

Perubahan laporan, progres, poin, dan voucher dilakukan lewat RPC dengan pemeriksaan identitas. Fungsi berhak khusus ada pada schema `private`, bukan schema API. Tabel tidak mengizinkan pengguna melakukan insert, update, atau delete langsung. Session memakai cookie HttpOnly dan pemeriksaan pengguna pada Supabase. Form mutasi memeriksa Origin. Access token tetap berumur pendek; refresh token memakai cookie persisten dengan masa berlaku bergulir satu tahun dan hanya dipakai server. Proxy memperbarui token sebelum render, sedangkan client memeriksa sesi saat aktif, tab kembali terlihat, dan koneksi pulih. Gangguan jaringan, rate limit, atau konfigurasi API tidak menghapus cookie. Cookie dihapus saat logout manual atau ketika Supabase secara pasti menolak sesi yang dicabut/kedaluwarsa. Pembaruan paralel digabung pada server dan diserialisasi antartab bila Web Locks tersedia; logout membatalkan pembaruan client yang tertunda. Tidak ada token dalam localStorage. Setelah login, hero hanya menampilkan “Buat laporan” dan semua CTA autentikasi langsung menuju tujuan yang sah.

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

## Latar landing page

Landing memakai empat video Bundaran HI baru dari unggahan pengguna pada 22 Oktober 2026: `Pagi.mp4`, `Siang.mp4`, `Sore.mp4`, dan `malam.mp4`. Kamera diregistrasi dengan similarity transform (translasi, rotasi, skala seragam), dengan penghalusan estimasi rotasi/skala selama 21 frame di dalam setiap bagian rekaman yang berkesinambungan. Sore memiliki lonjakan kamera pada frame 153 (sekitar 6,4 detik); filter tidak melewati lonjakan itu. Pelacakan titik bangunan pada kedua tepi memperbaiki sisa gerak dengan satu similarity transform, tetap tanpa deformasi lokal. Homografi/perspektif per frame dihapus karena dapat membuat pinggir frame terasa melentur. Posisi badan/tiang patung menjadi acuan akhir untuk translasi seluruh frame. Crop tetap 8% untuk pagi/siang dan minimal 4% untuk sore/malam memangkas batas sumber; tidak ada penambalan pinggir dengan cermin/stretch, deformasi mesh, atau crop yang bergerak. Footage tetap utuh: tidak ada segmentasi kendaraan, plate diam, atau penambalan objek. Sore memakai frame sumber 153–239 (bagian akhir 6,375–10 detik), saat sudut kamera paling tenang. Bagian pembuka yang bergerak mundur dikeluarkan; mengunci patung pada bagian tersebut masih meninggalkan parallax besar pada jalan. Pengguna menyetujui gerakan diperlambat pada 23 Oktober 2026 untuk memperpanjang loop pagi, siang, dan sore. Sumber yang telah distabilkan diretime dengan interpolasi temporal ke 550 frame pada 30 fps (18,333 detik), baru ujung/awalnya dibaurkan dengan smoothstep selama 3 detik. Siklus ketiganya kini 460 frame, sekitar 15,333 detik, sama seperti malam. Pagi memakai frame sumber 96–191 (4–8 detik) dan siang memakai 0–95 (0–4 detik), masing-masing bagian 4 detik yang lebih tenang pada tepi. Keduanya sekitar 0,218× kecepatan sumber; sore tetap sekitar 0,198× dari 87 frame sumber yang kameranya paling diam. Pagi/siang memakai perpaduan temporal antarframe utuh (`mi_mode=blend`), sehingga tidak menambahkan deformasi geometris optical flow pada gedung/atap. Objek bergerak dapat sedikit lebih lembut, tetapi tidak disegmentasi atau dibekukan. Sore tetap memakai interpolasi kompensasi gerak yang sudah disetujui. Frame tambahan diinterpolasi sebelum dissolve agar optical flow tidak mengubah objek pada gambar yang sudah dibaurkan. Tiga frame lookahead ditambahkan pada sumber sebelum retiming, lalu hasil interpolasi dipangkas tepat 550 frame. Menambahkan padding dalam detik sesudah retiming dapat memangkas ujung hasil dan membuat fade belum selesai saat loop mengulang; jumlah frame dan FPS diperiksa sebelum dissolve. Tidak ada reverse, seek berulang, atau salinan siklus pendek di dalam file. Klip malam tidak diubah dan tetap pada kecepatan aslinya. Sisa translasi lokal patung sore dihaluskan lima frame sebelum retiming. Empat klip yang mengubah suasana dalam 10 detik tidak diputar berulang agar ambience tidak bersiklus lepas dari jam aktual.

`lib/video-clock.mjs` memilih fase berdasarkan waktu aktual Asia/Jakarta dan membaurkan video selama 12 detik (6 detik sebelum hingga 6 detik setelah batas 05.00, 10.00, 15.00, 18.00). Pembauran pendek dipilih karena sudut pengambilan sumber berbeda; pembauran berjam-jam membuat gedung/patung tampak ganda. File hasil diputar browser pada 1x; slow motion sudah dibuat di dalam aset pagi/siang/sore, terpisah dari pemilihan ambience oleh jam. Jam diperiksa kembali saat tab aktif. Framing video fixed tanpa parallax, zoom, atau pergeseran vertikal saat scroll; hanya blur dan overlay gelap yang bertambah. Langit tetap terlihat di hero. UI tetap monokrom. Tombol jeda, poster saat video gagal/reduced motion, serta penundaan pemutaran saat tab tersembunyi disediakan.

Untuk mengolah ulang, ekstrak sumber di luar `public/`, pasang `scripts/video-requirements.txt`, lalu jalankan `python3 scripts/prepare-backgrounds.py --sources /path/to/videos` (gunakan `PYTHONPATH` bila dependensi dipasang di direktori tersendiri). Script meregistrasi kamera melalui `stabilize-video.py`, mengunci posisi patung melalui `anchor-video-monument.py`, lalu mengekspor H.264 720p tanpa audio dengan faststart. Gunakan `--work-directory /path/to/work` untuk menyimpan cache interpolasi mahal dan hasil gagal yang perlu diperiksa; cache dicocokkan dengan hash footage input serta parameter retiming, dan diperiksa jumlah frame/FPS sebelum dipakai. `check-monument-anchor.py` memeriksa acuan utama dan bagian atas/bawah patung secara terpisah pada setiap frame hasil encoding, termasuk overlap dan sambungan loop. Pemeriksaan kamera ekspor memakai batas 0,5 piksel untuk acuan utama/gerak antarframe; deformasi regional tetap dilaporkan. Jalankan `--limit .01` untuk audit target pengguna yang lebih ketat. Target 0,01 piksel belum tercapai; lolos pemeriksaan dasar tidak berarti lolos target tersebut. Malam tetap memakai encoding CRF 18 yang disetujui. Ketiga ekspor slow motion memakai CRF 12, dengan rasio kualitas I/P/B setara untuk mengurangi perubahan tekstur kompresi di titik ulang; gerak lambat membuat perbedaan kualitas keyframe lebih mudah terlihat. Tidak ada pembatas VBV 4,5 Mbps dan satu GOP dipakai per siklus. `check-video-edge-shape.py` membandingkan sisa perubahan bentuk setelah fitting similarity di empat area tepi dengan versi pagi/siang sebelumnya, pada setiap frame keempat dan frame terakhir. Nilai ini adalah estimasi perpindahan nonrigid, termasuk parallax dan deformasi sumber, bukan jaminan setiap piksel diam. Rata-rata serta area terburuk harus membaik sebelum ekspor pagi/siang diganti. `check-video-motion.py` juga mengukur gerak bangunan kiri/tengah/kanan pada hasil decoding, termasuk sambungan loop. `check-video-framing.py` membandingkan setiap frame sore langsung dengan satu acuan tetap pada gedung kiri/kanan serta foreground; pemeriksaan antarframe saja dapat melewatkan gerak mundur yang lambat. Batas median drift regional adalah 0,75 piksel untuk gedung dan 5 piksel untuk foreground, sehingga bukan klaim bahwa seluruh piksel diam. Ekspor sore menyimpan hash dan pengukuran klip malam yang disetujui sebagai pembanding; tes menolak lonjakan kamera di bagian rekaman terpilih dan gerak tepi yang lebih buruk dari malam. Hash sumber/hasil, crop, koreksi dan metrik disimpan di `tests/fixtures/video-loop-metrics.json`. Pemeriksaan ini mengukur perpindahan geometris; deformasi lokal yang sudah ada dalam video generatif tidak dapat dihilangkan sepenuhnya oleh stabilisasi kamera. `generate-phase-loops.py` adalah generator arsip untuk sumber lama dan bukan pipeline aset saat ini.

## Laporan di landing page

`/#laporan` menampilkan seluruh laporan yang dimuat (batas pengambilan yang ada: 200), pencarian judul/alamat, dan filter status. Kartu menggunakan foto asli melalui endpoint pratinjau. Tidak ada gambar atau laporan contoh yang ditambahkan saat foto gagal dimuat; kartu menampilkan “Foto belum tersedia”.

Karusel 3D memakai kartu ringkas dan menghitung posisi dari proyeksi perspektif agar celah antar tepi kartu tetap 12 piksel, termasuk kartu miring di sisi kiri/kanan dan selama putaran. Ukuran viewport dan kartu diukur ulang saat resize. Putarannya kontinu dengan perspektif: kartu depan lebih besar dan kartu samping menjauh mengikuti lintasan melingkar. Dua belas slot visual dipakai ulang; isi diganti ketika slot berada di belakang dan tidak terlihat, sehingga seluruh laporan tetap mendapat giliran tanpa lompatan sambungan. Salinan visual tidak menambah hitungan data dan hanya salinan terlihat terdekat tiap laporan yang masuk urutan tab. Gerakan berhenti saat kursor berada di kartu, fokus keyboard, sentuhan, tab tersembunyi, atau karusel di luar layar; area kosong tidak menghentikannya. Tidak ada tombol jeda. Tampilan semua laporan tetap tersedia, dan preferensi reduced motion langsung memakai daftar statis. Pengguna login tetap dapat membuka landing page; masuk dan pembuatan laporan tetap mengikuti alur akun.

`/reports` mengarahkan ke `/#laporan`; `/map` dan `/rewards` mengarahkan ke `/`. Detail `/reports/[id]`, pembuatan laporan, API dan data poin tetap tersedia. Tidak ada pengganti peta atau rewards baru.

Jalankan migrasi `202610210001_landing_report_previews.sql` untuk akses foto awal publik. `tests/landing-previews.sql` memeriksa bahwa foto awal dapat dibaca anonim sementara foto pembaruan dan unggahan yang belum dikirim tetap privat; pengujian berakhir dengan rollback dan hanya boleh dijalankan pada database pengembangan yang diizinkan.

### Landing map and vouchers

The landing page now includes `#peta` and `#voucher`; legacy `/map` and `/rewards` redirect to these sections. Leaflet is imported automatically after the landing component mounts; the map and markers appear without a “Jelajahi peta” button or cover. A loading message and retry remain available when map tiles fail. OpenStreetMap tiles retain attribution; wheel zoom is disabled to preserve page scrolling. Markers and the adjacent accessible list use actual reports with valid Jakarta coordinates. The map sidebar shows newest reports first, based on `created_at`, with compact ages (`1m ago`, `5h ago`, `3d ago`, `7M ago`, `1y ago`). Ages refresh every minute and when returning to the tab; this does not recreate the map. Months/years in this elapsed-time label use 30/365 days. Status filters and an optional device-location filter (5 km approximate radius) operate on the reports loaded by the landing page. Device coordinates stay in browser memory. Map failures leave the report list usable.

Voucher cards read `public.vouchers`. Signed-in balances and redemption history read the user's existing RLS-protected ledger/redemptions; redemption uses the existing authorized `/api/rewards` endpoint and transactional `redeem_voucher` RPC. All offers are explicitly simulations. There are no fabricated fallback offers or balances when the backend is unavailable. Details open in a native modal; visitors open the existing landing authentication popup. Photos are illustrative, not verified partner/destination images: Unsplash IDs `1564399579883-451a5d44ec08`, `1519331379826-f10be5486c6f`, `1534438327276-14e5300c3a48` (local copies under `public/media/vouchers`).

UI and copy changes must follow [DESIGN.md](DESIGN.md). The landing page uses direct Indonesian headings, content-led feature rows, and readable helper text. Decorative hero badges, repeated all-caps eyebrows, slogan strips, mock avatar stacks/charts, cursor glows, and entrance animations were removed. Useful report metadata, real counts, simulation disclosures, map attribution, authentication, and the requested carousel/navigation interactions remain.


## Meja kendali admin

Tampilan dari `admin.html` terintegrasi sebagai React di `/operator`, dengan halaman masuk khusus `/operator/login`. Root `admin.laporkuy.online` diarahkan secara internal ke `/operator`; tidak diperlukan proyek Vercel atau penyedia login baru. Cookie tetap host-only: gunakan akun operator yang sama untuk login pada subdomain admin. Akun warga dan pengunjung tidak dapat memuat workspace atau menjalankan mutasi operator. Pemeriksaan role dilakukan pada server, serta RPC tetap memeriksa `app_metadata.role`.

Ringkasan, antrean, pencarian/filter, peta, foto bukti, drawer tindakan, dan riwayat membaca Supabase. Pembaruan menggunakan `operator_update` dan endpoint upload yang sudah ada. Penyelesaian tetap memerlukan foto dan konfirmasi pelapor; tidak ada simulasi keberhasilan. Statistik mengikuti maksimal 200 laporan dan 500 pembaruan yang dimuat, bukan seluruh database. Nama pelaksana dan hasil AI rinci belum tersedia pada skema laporan lama sehingga tidak direkayasa dalam UI. CSV melindungi isi sel dari formula spreadsheet.

Migrasi tambahan **`supabase/migrations/202610260001_operator_admin.sql` belum diterapkan otomatis**. Tinjau lalu uji pada database pengembangan yang diizinkan sebelum produksi. Migrasi menyediakan RPC operator untuk menambah voucher, menambah/mengurangi stok secara atomik, membaca 200 penukaran tanpa identitas warga, dan mencatat perubahan voucher. RLS, pemeriksaan role, penguncian baris, dan transaksi tetap melindungi perubahan stok dari penukaran bersamaan. Katalog tetap dapat dibaca tanpa migrasi; tombol pengelolaan dinonaktifkan sampai kapabilitas RPC tersedia. Gangguan koneksi ditampilkan sebagai kegagalan pemuatan, bukan dianggap sebagai migrasi yang hilang.

Semua perubahan disimpan di `uji-coba`. DNS yang valid belum memindahkan kode preview ke produksi; aktivasi dashboard di domain admin memerlukan promosi eksplisit ke `main`. Pengujian browser menggunakan backend tiruan untuk memeriksa role, verifikasi/progres/foto, kegagalan simpan, voucher, audit/CSV, subdomain dan tampilan ponsel. SQL baru harus divalidasi terpisah pada database pengembangan sebelum diterapkan. `tests/operator-admin.sql` menyediakan pengujian rollback untuk role, izin RPC, validasi stok, audit atomik, dan privasi penukaran; belum dijalankan terhadap database pada tugas ini.


### Username admin

Form `/operator/login` menerima username `admin` atau email operator. Username tersebut dipetakan **di server** ke `admin@laporkuy.online`; tidak ada password bawaan yang ditanam pada aplikasi. Password diverifikasi oleh Supabase dan cookie baru hanya diterbitkan bila hasil autentikasi memiliki `app_metadata.role = operator`. Akun warga dengan password yang benar tetap ditolak oleh alur login operator.

Pemilik proyek perlu membuat akun `admin@laporkuy.online` melalui Supabase Authentication → Users → Add user, memasukkan password yang dipilih secara langsung di dashboard, dan mengaktifkan Auto Confirm User. Sesudah itu jalankan `docs/setup-admin-account.sql` pada proyek yang dipakai Preview untuk menetapkan role operator. Skrip berhenti bila akun belum ada, ambigu, atau email belum terkonfirmasi; tidak menyimpan atau mengganti password. Akses Admin API dari lingkungan ini ditolak (401), jadi pembuatan akun dan pemberian role harus dilakukan oleh pemilik proyek melalui dashboard. Jangan memakai signup publik atau metadata dari browser untuk memberikan hak operator. Masuk kembali sesudah role ditetapkan agar JWT memuat hak akses yang baru.


### Dashboard admin ringkas dan peta

Navigasi admin hanya berada di sidebar, bersama akun, logout dan muat ulang. Deskripsi berulang, label dekoratif dan stepper laporan dihapus; status, tenggat, harga/stok, field formulir, pesan kesalahan dan riwayat aktual tetap tersedia. CSS admin tetap terisolasi dari landing page.

Peta Leaflet memakai tile standar OpenStreetMap secara langsung tanpa API key, dengan tampilan gelap monokrom. CARTO dihapus karena dapat mengirim gambar “API KEY REQUIRED” dengan respons sukses sehingga tidak memicu fallback. Tile baru dipasang setelah viewport laporan siap; kegagalan tile tidak meninggalkan pesan lama setelah peta berhasil dimuat. Bila tile gagal atau tidak selesai dalam 12 detik, tampil Coba lagi dan tautan OpenStreetMap; marker dan daftar laporan tetap bisa dipakai. Ukuran kanvas diperbarui saat resize dan listener/timer/layer dibersihkan saat pindah menu atau retry. Atribusi penyedia tetap tampil.

### Voucher akun dan saldo navbar

Pengguna yang sudah masuk dapat membuka `/profile/vouchers` melalui menu Voucher di navbar. Katalog memakai voucher dan alur penukaran yang sudah ada, dengan pencarian nama/deskripsi, kategori, ketersediaan (stok dan masa berlaku), serta filter sesuai saldo. Pratinjau landing page tetap menampilkan tiga voucher. Saldo di kiri profil dibaca dari ledger pemilik akun dengan cookie server dan RLS, memakai cache hanya selama satu render request. Penukaran menyegarkan saldo melalui `router.refresh()`; kegagalan pembacaan ditampilkan sebagai saldo belum tersedia dan menonaktifkan penukaran.
