# FoodDash (Customer / Driver / Admin)
Next.js 14 + Supabase, siap deploy ke Vercel. Tampilan oranye bergaya aplikasi burger (mobile-first).

## Setup
1. Supabase SQL Editor, jalankan berurutan: `supabase/schema.sql`, `supabase/auth_patch.sql`, `supabase/schema_v2.sql`, `supabase/schema_v3.sql`, `supabase/schema_v4.sql`, `supabase/schema_v5.sql`, lalu `supabase/schema_v6.sql`.
2. Authentication > Providers > Email: matikan "Confirm email". Untuk fitur lupa password, isi Authentication > URL Configuration > Redirect URLs dengan `https://DOMAIN-ANDA/reset` (dan `http://localhost:3000/reset`).
3. `npm install` lalu `npm run dev`, atau push ke GitHub dan deploy di Vercel (env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
4. Admin: jalankan `supabase/seed_admin.sql` di SQL Editor, lalu login di `/login` atau buka `/admin`. Customer dan driver mendaftar lewat halaman login.

## Alur pesanan
Customer pesan (PENDING) → Admin konfirmasi (PREPARING) → Admin serahkan ke driver (READY_FOR_PICKUP) → Driver ambil (DRIVER_ASSIGNED) → Mulai antar (ON_DELIVERY) → Selesai (DELIVERED). Semua status tersinkron realtime ke customer, driver, dan admin. Chat customer–driver aktif setelah driver mengambil order.


## Pelacakan driver
Setelah driver mengambil order, lokasinya dibagikan ke customer (izin lokasi browser harus diizinkan; HTTPS wajib, Vercel sudah HTTPS). Customer melihat motor bergerak dan estimasi tiba. Admin mengatur lokasi toko di tab Toko, Ongkir & Banner.


## Perbaikan bukti pembayaran (v6)
Jalankan `supabase/schema_v6.sql` di Supabase SQL Editor setelah schema v5. File bukti pembayaran customer disimpan di `media/payment-proofs/<user-id>/...`. Metode COD tidak meminta bukti pembayaran dan mengirim `payment_proof_url` sebagai `null`; metode non-COD tetap wajib mengunggah bukti.


## Perbaikan lokasi toko (v7)

Jika tombol **Simpan lokasi toko** menampilkan error RLS pada tabel `store`:

1. Buka Supabase → SQL Editor.
2. Jalankan seluruh isi `supabase/schema_v7.sql`.
3. Pastikan akun halaman admin memiliki `role = 'admin'` pada tabel `profiles`.
4. Muat ulang halaman admin, isi latitude dan longitude, lalu simpan kembali.

Alamat teks saja belum cukup untuk perhitungan ongkir; aplikasi juga memerlukan koordinat latitude dan longitude. Koordinat dapat diambil dari Google Maps atau tombol **Pakai lokasi saya sekarang**.


## Revisi admin pesanan (v8)

### Fitur admin
- **Konfirmasi pesanan:** `PENDING` menjadi `PREPARING`.
- **Siapkan untuk driver:** `PREPARING` menjadi `READY_FOR_PICKUP`.
- **Cancel pesanan:** admin dapat membatalkan semua pesanan aktif yang belum selesai. Stok produk dikembalikan dan penugasan driver dilepas.
- **Cetak struk PDF:** mengunduh struk dari setiap kartu pesanan.
- **Hapus pesanan:** menghapus pesanan permanen melalui fungsi admin yang sudah tersedia.

### Instalasi
1. Jalankan `supabase/schema_v8.sql` di Supabase SQL Editor setelah `schema_v7.sql`.
2. Deploy source code v8 ke GitHub/Vercel.
3. Tes pesanan baru: konfirmasi → siapkan untuk driver → cetak struk.
4. Tes cancel pesanan aktif dan pastikan stok kembali.

Catatan: pesanan `DELIVERED` tidak bisa dibatalkan, tetapi kartu pesanan tetap dapat dihapus admin.


## Revisi berulang & status driver (v9)

Jalankan `supabase/schema_v9.sql` **setelah schema_v8.sql** melalui Supabase SQL Editor menggunakan role database yang berwenang (`postgres`), bukan role `authenticated`.

Perbaikan:
- Customer dapat membuat banyak pesanan selama masih memiliki stok; tidak ada batas satu pesanan per akun.
- Pemeriksaan role pesanan membaca profil akun yang sedang login dan memberikan pesan error yang lebih jelas jika profil/role tidak cocok.
- Admin dapat mengonfirmasi `PENDING → PREPARING` lalu `PREPARING → READY_FOR_PICKUP` untuk setiap order.
- Driver dapat mengambil order yang belum diambil, lalu memperbarui `DRIVER_ASSIGNED → ON_DELIVERY → DELIVERED`.
- Tombol driver menunggu hasil RPC, menampilkan status proses, dan memuat ulang daftar setelah berhasil/gagal.
- Sesi Supabase tetap disimpan di browser dan token dipantau otomatis; tidak perlu login ulang setiap berpindah tab/halaman. Tombol Keluar tetap mengakhiri sesi.

### Jika muncul "Hanya customer yang dapat membuat pesanan"
Periksa `profiles` untuk akun customer yang sedang login. Baris profil harus memiliki `id` sama dengan `auth.users.id` dan `role = 'customer'`. Jangan ubah role admin/driver menjadi customer.

### Uji setelah migrasi
1. Login sebagai customer, buat dua order berbeda tanpa logout.
2. Login sebagai admin, konfirmasi order pertama dan kedua hingga status `READY_FOR_PICKUP`.
3. Login sebagai driver, ambil order pertama; tombol harus berubah ke **Mulai antar** lalu **Selesai diantar**.
4. Ambil order kedua dan ulangi alurnya. Order yang sudah diambil driver lain tidak bisa diambil lagi.
5. Refresh browser; sesi tetap aktif selama belum menekan **Keluar** dan token/session Supabase masih valid.

## Upload bukti pembayaran gagal RLS (v10)

Jika upload menampilkan `new row violates row-level security policy`, jalankan `supabase/schema_v10.sql` di Supabase SQL Editor **setelah schema_v9.sql**. Jalankan dengan role database yang berwenang (umumnya `postgres`), bukan `authenticated`.

Policy v10 membolehkan pengguna yang sudah login mengunggah hanya ke `media/payment-proofs/<ID-user-auth>/...`. Path upload di frontend sudah menggunakan format tersebut. Policy tidak mengizinkan pengguna mengunggah ke folder bukti milik pengguna lain.

Setelah migrasi, deploy source code v10 dan coba upload bukti lagi. Jika tetap gagal, cek bahwa akun customer punya sesi login aktif dan bucket `media` tersedia.

## Revisi v11 — Alur pesanan stabil
Jalankan `supabase/schema_v11.sql` setelah schema sebelumnya. Alur final:
1. Customer pesan + bayar/upload bukti (jika non-COD) → `PENDING`.
2. Admin konfirmasi → `PREPARING`; admin siap pickup → `READY_FOR_PICKUP`.
3. Driver mengambil order → `DRIVER_ASSIGNED`.
4. Driver mulai antar → `ON_DELIVERY`.
5. Driver menyelesaikan → `DELIVERED`.

Status dipantau lewat realtime/polling pada customer, admin, dan driver. Tab dashboard juga disimpan di browser agar refresh tidak kembali ke halaman awal. Admin dapat membuka bukti pembayaran dalam popup.

## Per-account page persistence (v14)
- Admin, driver, and customer dashboard tabs are saved with the authenticated Supabase user ID as part of the localStorage key.
- Different accounts on the same browser no longer share the last-opened tab.
- On refresh, the app waits until the authenticated profile is loaded, then restores that account's own tab. A new account starts at its role's default tab.
- Route access remains role-guarded: admin -> `/admin`, driver -> `/driver`, customer -> `/customer`; logging in redirects according to the role stored in `profiles`.
