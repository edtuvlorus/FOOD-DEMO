# FoodDash Demo (Customer / Driver / Admin)
Next.js 14 + Supabase, siap deploy ke Vercel.

## Setup
1. Supabase: buat project, buka SQL Editor, jalankan isi `supabase/schema.sql`.
2. Supabase Auth: matikan "Confirm email" (biar gampang tes).
3. Push semua file repo ini ke GitHub.
4. Vercel: Add New Project, pilih repo ini, framework otomatis Next.js. Isi Environment Variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   lalu Deploy.
5. Buka situs, daftar akun customer dan driver. Untuk admin: daftar akun biasa, lalu jalankan SQL `update profiles set role='admin' ...` (baris terakhir schema.sql).
