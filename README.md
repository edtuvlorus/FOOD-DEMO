# FoodDash (Customer / Driver / Admin)
Next.js 14 + Supabase, siap deploy ke Vercel. Tampilan oranye bergaya aplikasi burger (mobile-first).

## Setup
1. Supabase SQL Editor, jalankan berurutan: `supabase/schema.sql`, `supabase/auth_patch.sql`, lalu **`supabase/schema_v2.sql`** dan **`supabase/schema_v3.sql`** (lokasi toko, lokasi driver, estimasi tiba) (chat, kategori, banner, ongkir, stok, upload foto).
2. Authentication > Providers > Email: matikan "Confirm email". Untuk fitur lupa password, isi Authentication > URL Configuration > Redirect URLs dengan `https://DOMAIN-ANDA/reset` (dan `http://localhost:3000/reset`).
3. `npm install` lalu `npm run dev`, atau push ke GitHub dan deploy di Vercel (env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
4. Admin: jalankan `supabase/seed_admin.sql` di SQL Editor, lalu login di `/login` atau buka `/admin`. Customer dan driver mendaftar lewat halaman login.

## Alur pesanan
Customer pesan (PENDING) → Admin konfirmasi (PREPARING) → Admin serahkan ke driver (READY_FOR_PICKUP) → Driver ambil (DRIVER_ASSIGNED) → Mulai antar (ON_DELIVERY) → Selesai (DELIVERED). Semua status tersinkron realtime ke customer, driver, dan admin. Chat customer–driver aktif setelah driver mengambil order.


## Pelacakan driver
Setelah driver mengambil order, lokasinya dibagikan ke customer (izin lokasi browser harus diizinkan; HTTPS wajib, Vercel sudah HTTPS). Customer melihat motor bergerak dan estimasi tiba. Admin mengatur lokasi toko di tab Toko, Ongkir & Banner.
