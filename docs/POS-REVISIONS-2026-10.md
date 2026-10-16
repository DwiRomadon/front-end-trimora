# Revisi POS — Oktober 2026

## Mengaktifkan di server

Deploy backend dan frontend pada jadwal yang sama. Checkout sekarang mewajibkan pelanggan dan menggunakan master diskon per item. Frontend versi lama perlu diperbarui/reload.

Backup database sesuai prosedur server, kemudian dari folder `Back-end/apps`:

```bash
bunx --bun prisma migrate deploy --config prisma7.config.ts
bunx --bun prisma generate --config prisma7.config.ts
pm2 restart kasir-be --update-env
```

Gunakan nama proses backend yang sebenarnya jika bukan `kasir-be`. Migration baru: `20261016090000_pos_customer_discounts_product_commissions`. Migration menambah alamat customer, nama diskon pada item, master diskon, dan aturan komisi produk. Tidak menghapus transaksi/komisi historis. Jangan menjalankan `migrate dev` atau reset di production.

Dari folder `front-end`, pastikan `BACKEND_URL=http://127.0.0.1:7001` tersedia saat build:

```bash
bun run build
pm2 restart kasir-fe --update-env
```

Frontend production berjalan di port 7002. Akses publik melalui HTTPS. Migration belum diterapkan ke database bisnis oleh perubahan kode ini.

## Alur owner dan kasir

1. **Owner → Master diskon**: tambah nama, cakupan layanan/produk/keduanya, persentase atau nominal. Nonaktifkan diskon untuk menghentikan pemakaian berikutnya. Nominal diterapkan sekali per baris, bukan dikali jumlah. Persentase dihitung dari subtotal baris. Diskon melebihi subtotal ditolak.
2. **Owner → Komisi produk → Aturan komisi produk**: aktifkan komisi hanya untuk produk yang membayar komisi. Pilih persentase nilai bersih setelah diskon atau nominal per unit. Produk tanpa aturan aktif masuk seluruhnya ke outlet. Komisi dibatasi nilai bersih item. Aturan awal untuk semua produk adalah tanpa komisi; owner perlu mengaturnya.
3. **Kasir → POS**: isi nama pelanggan. HP dan alamat opsional; data baru disimpan dalam transaksi database yang sama dengan checkout. Gunakan pencarian pelanggan tersimpan untuk kunjungan ulang. Nomor HP yang sudah terdaftar harus dipilih melalui pencarian. Nama yang sama tanpa HP tidak otomatis digabung karena bisa merupakan orang berbeda.
4. Pilih layanan/produk, capster, serta diskon tiap item. Produk berkomisi wajib memiliki penerima komisi. Perubahan capster pada katalog berlaku untuk item berikutnya.
5. Pilih metode pembayaran. QRIS ditampilkan dan dibukukan sebagai GoPay. Referensi dibuat otomatis; kasir tetap harus memastikan dana sudah diterima. Ini pencatatan pembayaran, bukan integrasi verifikasi gateway GoPay.
6. **Owner → Buku kas**: saldo catatan otomatis dari penjualan, refund, kas manual, pengeluaran, dan pembayaran komisi. Biaya yang sudah terhubung ke kas tidak dihitung dua kali. Saldo awal shift bukan pendapatan baru. Filter akun memisahkan tunai/GoPay/transfer/debit/e-wallet. Buku kas mencakup seluruh bisnis, bukan satu outlet.
7. **Owner → Rekap pelanggan**: filter bulan WIB dan outlet. Kunjungan adalah transaksi unik per capster; pelanggan unik berdasarkan ID pelanggan tersimpan. Dua layanan dalam satu transaksi pada capster yang sama dihitung satu kunjungan. Transaksi yang dibatalkan dikecualikan.

Aturan komisi layanan lama tidak menghasilkan komisi pada penjualan baru. Histori, pembayaran komisi lama, dan pemulihan komisi akibat refund tetap dipertahankan. Endpoint mutasi/simulasi aturan layanan lama memberikan HTTP 410 dan petunjuk pindah ke aturan produk.

## Putian POS 58 mm Bluetooth

Ukuran default struk adalah 58 mm, dengan pilihan 80 mm. Cetak langsung mengirim raster ESC/POS (384 dot untuk 58 mm); dukungan model printer harus diuji secara fisik.

**Android**

1. Nyalakan printer, isi kertas, uji FEED/self-test sesuai manual.
2. Pair printer melalui Bluetooth Android. Gunakan PIN dari manual printer.
3. Pasang RawBT dari toko aplikasi. Pilih printer dan ukuran 58 mm di RawBT, lalu lakukan test print dari aplikasi tersebut.
4. Buka struk di Trimora → **Android · cetak via RawBT**. Jika RawBT tidak terbuka, periksa instalasi dan izin aplikasinya.

**Laptop**

1. Pair printer di pengaturan Bluetooth sistem; putuskan printer dari HP/aplikasi lain.
2. Gunakan Chrome/Edge desktop melalui HTTPS atau localhost.
3. Buka struk → **Laptop · pilih printer & cetak**, lalu pilih port printer. Baud rate harus mengikuti manual/self-test (tersedia 9600, 19200, 38400, 115200).
4. Jika port tidak muncul, model tersebut mungkin tidak mengekspos Bluetooth SPP/serial. Alternatif: pasang driver printer dan gunakan **Cetak sistem**.
5. Pada dialog cetak sistem pilih printer fisik, kertas 58 mm, skala 100%, matikan header/footer. Tombol ini membuka dialog cetak OS; tidak melakukan pairing Bluetooth.

RawBT khusus Android. Untuk iPhone, gunakan dukungan aplikasi/driver resmi model printer atau laptop. Printer biasanya hanya menerima satu koneksi aktif.

Pesan “data dikirim” bukan konfirmasi kertas keluar. Periksa hasil fisik sebelum mencetak ulang. Jangan membuat transaksi baru hanya karena struk belum keluar; cetak ulang dari riwayat transaksi.

Referensi implementasi: [Chrome — Bluetooth Classic melalui Web Serial](https://developer.chrome.com/blog/serial-over-bluetooth), [contoh integrasi RawBT dari pengembang](https://github.com/402d/DemoRawBtPrinter/blob/master/app/src/main/java/ru/a402d/demorawbt/MainActivity.java).

## Pemeriksaan pengembangan

`bun run test` menjalankan kontrak API, checkout, diskon, komisi produk, rekap pelanggan, dan byte raster printer. Pengujian PostgreSQL opsional memakai `TRIMORA_TEST_DATABASE=1` dengan `node --test --test-name-pattern='cash book SQL' tests/pos-revisions.test.mjs` dari frontend. Test tersebut memakai konfigurasi backend, membuat tabel TEMP, lalu rollback; tidak menjalankan migration pada tabel bisnis.

Sebelum dipakai kasir: lakukan transaksi uji terkontrol, periksa customer tersimpan, diskon item, penerima komisi, buku kas, dan cetak fisik. Uji pairing Bluetooth dan hasil kertas tidak dapat dibuktikan hanya melalui tes kode.
