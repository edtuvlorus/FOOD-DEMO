-- FoodDash v10: perbaiki RLS upload bukti pembayaran di Supabase Storage.
-- Jalankan setelah schema_v9.sql menggunakan SQL Editor dengan role database berwenang.
-- Customer hanya dapat upload ke folder payment-proofs/<auth.uid()>/ miliknya.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- Hapus policy lama yang mungkin membatasi upload berdasarkan role/profile
-- atau memakai struktur folder yang berbeda.
drop policy if exists media_ins on storage.objects;
drop policy if exists payment_proof_upload on storage.objects;
drop policy if exists payment_proof_insert on storage.objects;

create policy payment_proof_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'payment-proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- File bukti tetap dapat ditampilkan melalui URL publik bucket media.
drop policy if exists media_sel on storage.objects;
create policy media_sel
on storage.objects
for select
using (bucket_id = 'media');
