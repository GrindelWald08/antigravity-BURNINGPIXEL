# Burning Pixel - Jasa Pembuatan Website Profesional

Burning Pixel adalah platform layanan pembuatan website profesional, responsif, dan dioptimasi penuh untuk konversi bisnis serta Google SEO. Proyek ini dibangun menggunakan arsitektur Node.js dan HTML/CSS/JS statis, yang terintegrasi secara langsung dengan Supabase untuk manajemen database dan otentikasi pengguna, serta gerbang pembayaran Midtrans.

## Fitur Utama

- **Home Showcase**: Halaman depan interaktif dengan fitur showcase portofolio proyek dan katalog paket harga yang dapat difilter secara dinamis.
- **Sistem Checkout Terpadu**: Integrasi pembayaran otomatis menggunakan Midtrans Snap SDK via Supabase Edge Functions.
- **Portal Pelanggan**: Dashboard untuk melacak riwayat transaksi pesanan, mengubah profil, mengganti password, dan mencetak invoice.
- **Dashboard Admin**: Pengelolaan penuh status transaksi pesanan client, log aktivitas, serta modifikasi katalog paket harga dan item portofolio secara real-time.
- **Supabase Integration**: Manajemen autentikasi pengguna dan persistensi database yang aman.

## Struktur Direktori

- `css/` - Berkas styling kustom dengan tema dark slate & teal.
- `js/` - Script logika client-side untuk interaksi Supabase dan Midtrans.
- `supabase/` - Cloud Functions (Edge Functions) untuk memproses pembayaran Midtrans dan log aktivitas.
- `server.js` - Server web lokal Node.js & Express.
- `package.json` - Daftar dependensi Node.js.

## Menjalankan Proyek Secara Lokal

Ikuti langkah-langkah berikut untuk menjalankan server web lokal:

1. Pastikan Anda telah menginstal **Node.js** di komputer Anda.
2. Pasang dependensi yang diperlukan:
   ```sh
   npm install
   ```
3. Jalankan server lokal:
   ```sh
   npm start
   ```
4. Buka halaman browser di alamat:
   ```
   http://localhost:8080
   ```

## Deploy ke GitHub Pages

Proyek ini telah dikonfigurasi sepenuhnya agar dapat dideploy ke **GitHub Pages** secara langsung dari branch `main`:
1. Masuk ke halaman **Settings** di repositori GitHub Anda.
2. Buka menu **Pages** di panel samping kiri.
3. Pada bagian **Build and deployment**, pilih Source: **Deploy from a branch**.
4. Pilih branch **`main`** dan folder **`/ (root)`**, kemudian klik **Save**.
5. GitHub akan secara otomatis memproses deployment statis website Anda.
