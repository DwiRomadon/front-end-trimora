# Integrasi absensi

Menu **Absensi** tersedia untuk owner dan kasir; akun BARBER masuk langsung ke **Absensi saya**.

## Persiapan owner
1. Pastikan anggota tim ditugaskan ke outlet aktif melalui Tim kasir / Tim barber.
2. Di Absensi → Akun barber, buat akun masuk untuk barber yang belum memiliki akun.
3. Di Lokasi GPS, isi koordinat outlet dan radius 20–1000 meter.
4. Buat Template shift jika jam kerja berulang, lalu buat Jadwal kerja untuk anggota tim yang ditugaskan di outlet tersebut.
5. Lihat Rekap kehadiran dengan filter tanggal, outlet, dan status. Rentang maksimal 31 hari.

## Operasional
- Kasir: pilih jadwal hari ini dan Absen masuk. Browser meminta lokasi presisi; ketelitian harus maksimal 50 meter. Ulangi dengan Absen pulang saat selesai.
- Owner / kasir: buka Tampilkan QR barber dan pilih outlet. Kasir harus sudah absen masuk GPS. Tutup sesi QR setelah digunakan atau sebelum pergantian petugas.
- Barber: masuk dengan akun sendiri, pilih jadwal dan pindai QR aktif menggunakan kamera.
- QR diperbarui setiap 10 detik dan dibuat lokal di browser. Token tidak dikirim ke layanan pembuat QR eksternal.
- Halaman menyimpan identitas sesi QR (bukan token) di sessionStorage sesuai bisnis dan pengguna untuk melanjutkan sesi setelah reload pada tab yang sama.
- Semua jam menggunakan WIB, termasuk shift lintas tengah malam. Kehadiran terpisah dari buka/tutup shift kasir dan saldo kas.

## Koreksi
Owner membuka Detail / koreksi pada rekap. Jam masuk/pulang hanya bisa dikoreksi jika sebelumnya sudah tercatat, disertai alasan minimal 10 karakter. Riwayat koreksi tersedia pada detail. Jadwal yang telah memiliki absensi tidak dapat diubah atau dibatalkan.

## Batas API dan pengujian lapangan
- Endpoint pribadi mengembalikan maksimal 100 jadwal dan 100 absensi terakhir. Tampilan awal memprioritaskan hari ini dan shift yang belum selesai; aktifkan Tampilkan seluruh jadwal untuk melihat sisanya.
- Backend belum menyediakan daftar / pemulihan sesi QR aktif. Jika identitas sesi hilang karena tab/storage dihapus atau permintaan pembukaan terputus setelah server berhasil, perlu penutupan sesi oleh backend/operator atau menunggu sesi kedaluwarsa. Jangan membuat sesi berulang tanpa memeriksa kondisi ini.
- GPS dan kamera membutuhkan HTTPS pada perangkat pengguna; localhost hanya berlaku pada perangkat server itu sendiri.
- Verifikasi lapangan: izin GPS ditolak, lokasi di luar radius, GPS tidak akurat, absen ganda, absen pulang, QR kedaluwarsa, QR outlet berbeda, kamera ditolak, dan reload sesi QR.
- Uji perangkat fisik serta tampilan browser belum dilakukan pada integrasi ini. Tes otomatis memakai kontrak backend dan mock; tidak menulis data presensi nyata.
