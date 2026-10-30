-- FoodDash v6: perbaikan RLS upload bukti pembayaran. Jalankan SETELAH schema_v5.sql.
-- File bukti disimpan di media/payment-proofs/<auth.uid()>/<filename>.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- Hapus policy upload lama agar aturan upload tidak bergantung pada policy v5.
drop policy if exists media_ins on storage.objects;
drop policy if exists payment_proof_upload on storage.objects;

-- Hanya akun customer yang sudah memiliki profil customer boleh upload ke folder miliknya.
create policy payment_proof_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'payment-proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'customer'
  )
);

-- Bucket media bersifat public agar URL foto yang disimpan dapat ditampilkan.
-- Policy select publik hanya untuk bucket media.
drop policy if exists media_sel on storage.objects;
create policy media_sel
on storage.objects
for select
using (bucket_id = 'media');
