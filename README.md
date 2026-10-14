# Studio Kasir frontend

Frontend Next.js untuk API barbershop di `../Back-end/apps`.

## Menjalankan lokal

1. Jalankan backend dari `Back-end/apps` dengan `bun run dev` (port default 3000). Database dan variabel lingkungan backend harus sudah dikonfigurasi.
2. Dari folder `front-end`, jalankan `bun run dev`. Frontend memakai port 3001.
3. Buka http://localhost:3001, masuk, lalu pilih bisnis dan outlet.

`BACKEND_URL` default adalah `http://localhost:3000`. Untuk alamat berbeda, salin `.env.example` ke `.env.local`, ubah nilainya, lalu restart Next.js. Saat memakai port/domain frontend lain, tambahkan origin tersebut ke `FRONTEND_ORIGINS` backend.

## Fitur yang tersedia

- Registrasi bisnis, login, pilihan bisnis, logout, dan pemulihan sesi setelah reload.
- Access token di memori; refresh token HttpOnly milik backend. Semua request melalui proxy `/api/v1` dengan path cookie backend tetap sama.
- Owner: ringkasan pendapatan, transaksi, margin, rata-rata transaksi, grafik harian, dan performa outlet.
- Daftar outlet yang diizinkan backend dan pembuatan outlet untuk owner.
- POS layanan dan produk: harga outlet, pilihan barber per item layanan, pelanggan, diskon, pembayaran tunai/non-tunai sesuai role, checkout, dan cetak bukti pembayaran.
- Buka shift, ringkasan kas, dan tutup shift dengan kas aktual.
- Riwayat transaksi dengan pencarian invoice dan pagination.
- Tampilan responsif, status loading, data kosong, error, dan akses menu sesuai role.

Untuk mencoba checkout, siapkan outlet aktif, layanan dan harga outlet, barber yang ditugaskan, serta persediaan bahan layanan sesuai aturan backend. Tidak ada data demo yang disisipkan ke dashboard. Nominal checkout dan stok tetap divalidasi server. Request ID checkout dipertahankan saat mencoba ulang payload yang sama untuk mencegah transaksi ganda.

## Batas integrasi saat ini

POS mendukung layanan dan produk, diskon, serta pelanggan. Pengelolaan layanan, barber, produk, pelanggan, kategori, dan persediaan dasar tersedia. Refund, komisi, pengeluaran, dan laporan lanjutan belum diimplementasikan. Data ringkasan dashboard memakai definisi penjualan selesai dari backend, sebelum penyesuaian refund.

## Verifikasi

```sh
bun run lint
bunx tsc --noEmit
bun run build
node --test tests/api.test.mjs
```

Untuk produksi, frontend dan backend perlu origin HTTPS yang dikonfigurasi dengan benar; backend memasang cookie refresh Secure ketika NODE_ENV=production.


## Integrasi tahap kedua

- Owner: tambah/edit/aktifkan/nonaktifkan layanan, barber, produk, pelanggan, serta kategori layanan dan produk.
- Harga layanan per outlet dan pengaturan penugasan barber.
- Kasir: layanan + produk dalam satu pesanan, lookup pelanggan, diskon nominal/persentase, dan catatan.
- Pembayaran non-tunai hanya tersedia untuk owner, sesuai aturan `PosService.checkout`.
- Persediaan: saldo, mutasi, pembuatan lokasi stok, stok awal, dan penerimaan barang.
- Peringatan sebelum meninggalkan keranjang. Saat respons checkout/penerimaan tidak dapat dipastikan, data dibekukan dan request ID yang sama digunakan untuk percobaan ulang; periksa riwayat/mutasi jika backend menyatakan ID sudah diproses.

Uji kontrak frontend terhadap schema Zod backend:

```sh
node --test tests/api.test.mjs tests/contracts.test.mjs
```

Fixture UI opsional, tanpa akses ke database asli:

```powershell
# Terminal 1, dari front-end:
node tests/ui-fixture.mjs
# Terminal 2:
$env:BACKEND_URL='http://127.0.0.1:3300'
$env:NEXT_DIST_DIR='.next-ui-test'
node node_modules/next/dist/bin/next dev --port 3301
```

Buka http://localhost:3301 untuk fixture. Gunakan http://localhost:3001 untuk API asli. Fixture hanya untuk smoke test UI, bukan pengganti validasi transaksi dan database backend. `pos-preview.png` menampilkan data fixture.

Modul owner utama sudah terintegrasi: laporan, kasir, outlet, shift, audit, dan dashboard tambahan.



## Resep layanan dan HPP outlet

Owner membuka **Layanan → Resep & HPP** pada layanan yang ingin diatur.

- Pilih produk aktif yang ditandai **Bahan layanan**, dengan kategori aktif.
- Setiap bahan hanya boleh muncul sekali. Jumlah per layanan harus positif, maksimal tiga desimal; satuan mengikuti produk (PCS, ML, GRAM).
- Simpan resep untuk mengganti resep utama layanan. Resep yang sudah ada dimuat kembali saat editor dibuka.
- Panel outlet memakai endpoint `material-cost` backend untuk resep tersimpan: harga layanan, estimasi HPP, margin sebelum biaya lainnya, saldo bahan, dan kondisi bahan/HPP.
- Simulasi 1–20 layanan menunjukkan kebutuhan dan kekurangan stok; perhitungan kuantitas menggunakan bilangan bulat berskala agar pecahan tetap tepat.
- Perubahan yang belum disimpan dilindungi ketika menutup editor, berpindah menu, atau memuat ulang halaman. Estimasi tetap diberi label sebagai resep tersimpan saat ada draft perubahan.

Backend memperbolehkan layanan tanpa resep. **Resep nonaktif membuat checkout layanan ditolak**; menonaktifkan resep bukan cara menjual layanan tanpa penggunaan bahan. Estimasi tidak memesan stok dan tidak menggantikan validasi saat checkout. Untuk estimasi outlet, siapkan harga layanan aktif dan lokasi stok outlet aktif; bahan memerlukan stok dan harga pokok rata-rata yang valid.

Pengujian UI resep menggunakan API fixture terpisah, bukan database asli. `recipe-preview.png` menampilkan data pengujian.


## Struk thermal

Struk tampil setelah checkout berhasil dan dapat dibuka ulang melalui **Transaksi → Lihat struk**. Pratinjau memakai data endpoint `/pos/transactions/:id/receipt`, dengan identitas outlet, tanggal/jam WIB, kasir, pelanggan, item/barber, subtotal, diskon, total, pembayaran, dan kembalian. Backend juga menyertakan pelanggan, catatan, serta subtotal item sebelum diskon agar diskon tidak terlihat dihitung dua kali.

Pilih thermal 58 atau 80 mm. Tombol Cetak struk membuka dialog cetak browser; pilih ukuran kertas yang sama, skala 100%, dan nonaktifkan header/footer browser. CSS cetak menampilkan hanya kertas struk. Nomor antrean dan pesanan tidak ditambahkan karena backend belum menyimpan data tersebut. Pencetakan fisik bergantung pada pengaturan printer dan belum diuji.

`receipt-preview.png` adalah pratinjau dengan transaksi fixture, bukan transaksi database asli.

Pilihan outlet pada form Lokasi Stok menampilkan seluruh outlet aktif, termasuk outlet yang sudah memiliki lokasi. Outlet baru dapat dibuatkan lokasi; lokasi yang sudah ada dapat dipilih melalui Gunakan lokasi ini, atau diaktifkan kembali jika nonaktif. Ini mengikuti aturan satu lokasi stok per outlet pada backend. Pemuatan pilihan dan kegagalannya ditampilkan secara eksplisit. `location-fix-preview.png` menunjukkan pengujian dengan fixture.

## Transfer stok dan stock opname

Menu **Transfer stok** tersedia untuk owner: buat draft dengan lokasi asal/tujuan berbeda, ajukan, setujui, lalu selesaikan. Stok baru berpindah ketika dokumen selesai. Owner juga dapat menolak pengajuan atau membatalkan draft/pengajuan.

Menu **Stock opname** tersedia untuk owner dan kasir. Isi hitung fisik secara eksplisit (nol diperbolehkan). Pengajuan merekam snapshot stok; persetujuan owner langsung menerapkan selisih. Kasir hanya dapat mengajukan atau membatalkan draft miliknya. Jika stok atau HPP berubah setelah pengajuan, backend menolak persetujuan; owner perlu menolak dokumen dan membuat opname baru.

Kedua menu menyediakan daftar, filter, pagination, detail status, konfirmasi tindakan, serta perlindungan draft yang belum disimpan. Kuantitas mendukung tiga desimal. Backend belum menyediakan edit draft yang tersimpan; periksa isi sebelum menyimpan. Ketika respons penyimpanan tidak pasti, nomor dokumen dipertahankan agar pengguna dapat memeriksa daftar sebelum mencoba lagi.

Pengujian kontrak mencakup schema backend, izin tindakan, dan perhitungan selisih presisi. Smoke test memakai API fixture terpisah: transfer sampai selesai, persetujuan opname, serta penolakan snapshot yang kedaluwarsa. Tidak ada perubahan pada stok database asli melalui pengujian ini. `stock-opname-preview.png` menampilkan kasus konflik dengan data fixture.
## Refund transaksi

Owner dapat membuka **Transaksi → Ajukan refund** pada transaksi selesai, atau **Refund → Buat refund** lalu mencari invoice. Daftar refund mencakup seluruh bisnis dan mendukung filter status serta pagination.

Backend mendukung **refund penuh** sebesar grand total transaksi. Centang hanya item produk yang secara fisik dikembalikan dalam seluruh jumlah item dan layak jual; pemilihan produk tidak mengubah nominal refund. Bahan layanan tidak otomatis kembali. Simpan pengajuan terlebih dahulu (PENDING), lalu pilih Selesaikan refund atau Tolak refund.

Aplikasi mencatat pengembalian dana dan tidak mengirim pembayaran otomatis. Penyelesaian membutuhkan konfirmasi eksplisit bahwa dana sudah dikembalikan; referensi pembayaran opsional. Refund tunai membutuhkan shift owner aktif pada outlet transaksi. Penyelesaian membatalkan transaksi asal, mengembalikan produk yang dipilih ke stok outlet, dan membatalkan komisi terkait sesuai aturan backend. Penolakan tidak mengubah transaksi asal. Backend membatasi satu dokumen refund per transaksi, termasuk jika refund ditolak.

Form yang belum disimpan dilindungi saat navigasi dan reload. Respons penyimpanan yang tidak pasti mempertahankan nomor/isian; periksa dokumen di daftar sebelum mengulang. Kegagalan tindakan memuat ulang detail; tindakan dinonaktifkan jika status terbaru belum dapat dipastikan.

Pengujian kontrak menggunakan schema backend asli dan mock service untuk memastikan owner-only serta syarat shift tunai. Smoke test browser menggunakan fixture terpisah, meliputi pengajuan, produk return, penyelesaian, referensi dan pembatalan transaksi; database asli tidak dimutasi. `refund-preview.png` menampilkan data fixture.

## Komisi capster

Menu **Komisi capster** tersedia untuk owner, dengan tiga tab:

- **Laporan komisi**: rekap per capster dan rincian per layanan, mengikuti outlet aktif serta tanggal pencatatan WIB. Diperoleh (EARNED) mencakup komisi sudah/belum dibayar; Dibatalkan (VOIDED) dipisahkan. Tanggal kosong berarti seluruh periode.
- **Aturan & simulasi**: persentase nilai layanan setelah diskon atau nominal tetap per layanan. Nilai komisi dibatasi pendapatan bersih item. Aturan berlaku untuk transaksi berikutnya; entry historis memakai snapshot aturan saat checkout. Menghapus aturan menghentikan entry otomatis berikutnya. Simulasi menggunakan aturan tersimpan dan layanan outlet aktif.
- **Pembayaran komisi**: pilih capster dan periode untuk komisi belum dibayar dari seluruh outlet. Pratinjau menampilkan komisi kotor, potongan refund dan nilai bersih. Recovery refund lama tetap dihitung meski di luar periode. Backend membatasi 500 entry per pembayaran; persempit periode jika melebihi batas.

Pencatatan pembayaran tidak mengirim uang otomatis. Konfirmasi eksplisit dana sudah diterima wajib; transfer membutuhkan referensi. Nomor COM-requestId dipertahankan saat respons belum pasti. Periksa riwayat/detail sebelum retry atau membuat request baru; request yang sama tidak dapat dipakai dua kali. Jangan mengirim dana lagi ketika hanya status pencatatan yang belum pasti.

Backend menerima field opsional `expected` berisi grossAmount, recoveryAmount dan payableAmount dari pratinjau. Frontend mengirimnya untuk menolak perubahan nominal di dalam transaksi database sebelum pembayaran tercatat. Client lama tanpa field tersebut tetap kompatibel. Tidak memerlukan migrasi database.

Pengujian kontrak/service meliputi aturan, diskon, batas komisi, recovery di luar periode, entry belum dibayar, perubahan nominal, request duplikat, dan hak owner. Smoke test UI menggunakan fixture terpisah untuk laporan, simpan aturan, simulasi, pembayaran dengan potongan, detail dan pratinjau ulang setelah pembayaran. `commission-preview.png` adalah data fixture; database asli tidak diubah selama pengujian.

## Pengeluaran operasional dan kas shift

Owner membuka **Pengeluaran** untuk mengelola kategori, mencatat biaya bisnis/outlet, melihat rekap biaya aktif, memfilter daftar dan membuka detail. Kategori dapat diedit atau dinonaktifkan. Ringkasan mengikuti outlet/tanggal, seluruh kategori dan biaya ACTIVE; filter kategori/status hanya berlaku pada daftar. Tanggal memakai WIB sesuai backend.

Biaya **CASH dengan outlet** memerlukan shift owner aktif pada outlet tersebut dan otomatis membuat CASH_OUT. Jangan membuat kas keluar manual kedua. Biaya bisnis tanpa outlet dibayar di luar laci; non-tunai juga tidak memutasi laci. Biaya yang sudah terkait mutasi kas tidak dapat diedit. Untuk membatalkan: kembalikan uang secara fisik, balikkan mutasi dari menu Kas masuk/keluar pada shift owner outlet yang sama, lalu perbarui detail biaya dan batalkan dokumennya. Riwayat tetap tersimpan. Biaya yang tidak terkait kas dapat diedit; update mengirim hanya field berubah dan tidak dapat mengubah biaya menjadi CASH outlet.

Menu **Kas masuk/keluar** tersedia untuk owner/kasir. Tab Shift saya mengikuti shift aktif pengguna dan outlet shift tersebut. Saldo yang diharapkan memakai endpoint ringkasan shift backend, termasuk saldo awal, penjualan/refund tunai dan mutasi. Kasir hanya membuat CASH_IN/CASH_OUT. Owner dapat membuat penyesuaian dan OWNER_DEPOSIT, yang berarti **setoran keluar dari laci ke owner**. Owner juga melihat riwayat outlet aktif dan melakukan reversal. Mutasi reversal tidak bisa dibalik ulang.

Aplikasi hanya mencatat transaksi, tidak memindahkan dana otomatis. Reversal membutuhkan konfirmasi pergerakan uang sesuai arah pembalikan. Request biaya/mutasi/reversal dipertahankan ketika respons belum pasti, isian dikunci dan retry memakai data yang sama. Backend menangani retry identik tanpa catatan ganda. Periksa nomor EXP-requestId, CM-requestId, atau CM-REV-requestId pada daftar sebelum membuat request baru. Form belum disimpan dilindungi pada navigasi dan reload.

Backend menambahkan relasi mutasi/reversal pada respons pengeluaran dan kas, serta outlet pada shift aktif. Respons create expense diambil ulang setelah mutasi otomatis dibuat agar detail langsung lengkap. Tidak memerlukan migrasi database.

40 pengujian kontrak/service mencakup nominal desimal, payload schema asli, perubahan field, hak kasir, idempotensi, outlet reversal dan syarat reversal sebelum pembatalan biaya. Smoke test browser memakai fixture terpisah untuk biaya tunai → kas keluar → reversal → void, kategori baru, edit biaya non-tunai, kas masuk manual, dan layout mobile. Database asli tidak dimutasi selama pengujian. `expense-preview.png` dan `cash-preview.png` menampilkan data fixture.

## Integrasi modul owner yang tersisa

- **Laporan**: laba-rugi, penjualan per outlet, nilai persediaan saat ini, laporan mutasi stok, kas harian dan detail per tanggal/outlet. Filter menggunakan tanggal WIB dan pilihan outlet tersendiri, termasuk outlet nonaktif untuk riwayat. Nilai persediaan tidak memakai tanggal historis. Kas harian memakai tanggal shift dibuka, maksimal 31 tanggal kalender; laporan periode lain mengikuti batas backend. Laba-rugi memakai tanggal transaksi/refund/komisi/biaya sesuai catatan perhitungan, tanpa mengurangi payout komisi dua kali.
- **Tim kasir**: membuat akun dengan password awal minimal 12 karakter dan minimal satu outlet aktif, mengedit nama/telepon, mengubah status, dan mengganti penempatan outlet. Daftar kosong mencabut penempatan. Email/password tidak dikirim pada edit. Password hanya berada dalam form sementara dan dihapus setelah simpan berhasil. Jika pembuatan belum pasti, form terkunci; periksa email pada daftar sebelum membuat ulang.
- **Outlet**: daftar/filter semua status, detail, buat/edit identitas dan kontak, nonaktifkan/aktifkan. Dropdown outlet operasional diperbarui setelah perubahan. Form kasir hanya menempatkan ke outlet aktif; penempatan outlet nonaktif yang lama harus dilepas sebelum simpan.
- **Pemantauan shift**: daftar aktif atau riwayat, filter outlet/status, detail shift dan laporan kas per shift. Rekonsiliasi membedakan hasil hitung ulang, snapshot closing, kas aktual serta selisih. Peringatan backend ditampilkan; shift terbuka diberi label angka sementara. Owner tidak menutup shift orang lain lewat halaman ini karena backend tidak menyediakan tindakan tersebut.
- **Audit aktivitas**: daftar/filter tanggal, aksi, actorId, entityType/entityId, detail data perubahan, serta rekap aksi dan jenis data. Ringkasan tanggal mencakup semua aktivitas; filter actor/aksi/data hanya berlaku pada daftar. Detail dapat mengisi filter pengguna. Data audit ditampilkan sebagai teks, bukan konten HTML aktif.
- **Dashboard**: layanan/produk terlaris dan performa capster dengan periode/outlet yang sama dengan ringkasan utama.

Semua halaman tambahan dibatasi owner di navigasi/render, dan backend tetap memvalidasi peran/tenant. Form identitas/penempatan dilindungi saat navigasi dan reload. Endpoint detail/rekap alternatif yang memberikan data sama digunakan melalui alur yang sesuai; endpoint teknis health/test tidak dijadikan menu bisnis.

45 pengujian mencakup kontrak akun kasir/outlet, periode laporan, validasi penempatan sebelum mutasi, serta filter audit tenant/WIB selain pengujian operasional sebelumnya. Smoke test memakai fixture lokal terpisah: lima jenis laporan, detail kas shift, audit, dashboard tambahan, buat/edit/status kasir, cabut/pasang penempatan, serta buat/edit/status outlet. Database bisnis asli tidak dimutasi selama pengujian. Pratinjau laporan `reports-preview.png` menggunakan data fixture.


## Langganan Premium

Owner diarahkan ke pilihan paket sebelum fitur bisnis dibuka jika status langganan FREE, EXPIRED, atau NOT_STARTED. Kasir tanpa akses aktif mendapat arahan menghubungi owner. Menu Langganan tersedia untuk owner yang sudah aktif. Error API dengan kode SUBSCRIPTION_REQUIRED, SUBSCRIPTION_EXPIRED, dan SUBSCRIPTION_NOT_STARTED kembali menutup akses fitur; penolakan izin biasa tidak dianggap masalah langganan.

Halaman mengambil harga/durasi/promo/pelatihan dari GET /subscriptions/plans, status dari /current, dan riwayat dari /orders (50 terbaru). Pembuatan pesanan menggunakan requestId tetap untuk retry hasil tak pasti. Detail diambil ulang melalui /orders/:id. Hanya PENDING yang menawarkan submit-payment atau cancel. Mengirim referensi bukan aktivasi: status AWAITING_VERIFICATION menunggu admin; akses hanya dibuka setelah server menyatakan ACTIVE.

Backend saat ini belum menyediakan tujuan rekening, tautan checkout, atau instruksi pembayaran. UI meminta owner menghubungi admin penyedia aplikasi menggunakan nomor pesanan, tanpa menciptakan data rekening atau menganggap pembayaran berhasil. Verifikasi admin tetap melalui mekanisme administrasi backend, tidak diekspos sebagai aksi owner. current() diselaraskan dengan premium middleware untuk tanggal mulai di masa depan.

Validasi tambahan mencakup kode penolakan subscription, isolasi error izin biasa, kontrak payload ketat (harga tidak dikirim oleh browser), serta status FREE/NOT_STARTED/ACTIVE/EXPIRED. Pengujian memakai mock, tanpa pembayaran atau perubahan database nyata.

## Platform Superadmin

- Login admin: `/platform/login`; konsol langganan: `/platform`.
- UI terpisah dari workspace owner/kasir dan tidak dibungkus pemeriksaan Premium. Akses konsol wajib diverifikasi melalui `GET /platform/subscriptions/me`; keputusan tetap divalidasi ulang backend.
- Backend masih memakai `/auth/login` → `/auth/select-business` dan refresh cookie yang sama. Akun Superadmin memerlukan keanggotaan bisnis aktif untuk membentuk sesi sesuai tenantMiddleware. Halaman login terpisah, tetapi bukan sistem kredensial/cookie independen. Gunakan profil browser berbeda jika harus memakai akun bisnis dan admin berbeda secara bersamaan.
- Daftar memakai filter status, businessId UUID opsional, dan pagination backend. Default AWAITING_VERIFICATION. Detail menampilkan identitas pemohon, referensi pembayaran, nilai tagihan, periode aktivasi dalam WIB, dan admin pemeriksa.
- Approve/reject hanya ditawarkan untuk AWAITING_VERIFICATION dan mengirim `{confirmed:true}` setelah konfirmasi pemeriksaan oleh operator. Frontend tidak mengirim nominal, operator, atau tanggal aktivasi. Operator dan transaksi aktivasi ditentukan server.
- Setelah tindakan, detail serta daftar dimuat ulang. Bila hasil tidak pasti, UI mengambil status terbaru; jika gagal dibaca, aksi dikunci hingga berhasil diperiksa. Tidak ada approval/rejection otomatis.
- Validasi: 52 pengujian kontrak/client/service dengan mock lulus, lint komponen admin lulus, build produksi mencakup `/platform` dan `/platform/login`. Tidak ada pembayaran nyata yang disetujui atau ditolak selama pengembangan. Pemeriksaan visual lewat browser belum dilakukan.
