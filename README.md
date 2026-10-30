# FoodDash (Customer / Driver / Admin)
Next.js 14 + Supabase, siap deploy ke Vercel. Tampilan oranye bergaya aplikasi burger (mobile-first).

## Setup
1. Supabase SQL Editor, jalankan berurutan: `supabase/schema.sql`, `supabase/auth_patch.sql`, lalu **`supabase/schema_v2.sql`** (chat, kategori, banner, ongkir, stok, upload foto).
2. Authentication > Providers > Email: matikan "Confirm email". Untuk fitur lupa password, isi Authentication > URL Configuration > Redirect URLs dengan `https://DOMAIN-ANDA/reset` (dan `http://localhost:3000/reset`).
3. `npm install` lalu `npm run dev`, atau push ke GitHub dan deploy di Vercel (env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
4. Daftar akun customer dan driver lewat halaman login. Admin: daftar akun biasa, lalu jalankan di SQL Editor: `update profiles set role='admin' where id=(select id from auth.users where email='EMAIL_ADMIN');`

## Alur pesanan
Customer pesan (PENDING) → Admin konfirmasi (PREPARING) → Admin serahkan ke driver (READY_FOR_PICKUP) → Driver ambil (DRIVER_ASSIGNED) → Mulai antar (ON_DELIVERY) → Selesai (DELIVERED). Semua status tersinkron realtime ke customer, driver, dan admin. Chat customer–driver aktif setelah driver mengambil order.
