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
