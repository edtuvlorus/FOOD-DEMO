-- FoodDash v7: perbaikan simpan lokasi toko.
-- Jalankan di Supabase SQL Editor SETELAH schema_v6.sql.

create table if not exists public.store (
  id integer primary key default 1 check (id = 1),
  name text,
  address text,
  lat numeric,
  lng numeric
);

insert into public.store (id, name)
values (1, 'FoodDash')
on conflict (id) do nothing;

alter table public.store enable row level security;

drop policy if exists st_sel on public.store;
create policy st_sel on public.store for select using (true);

drop policy if exists st_ins on public.store;
create policy st_ins on public.store
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists st_upd on public.store;
create policy st_upd on public.store
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create or replace function public.save_store(
  p_name text, p_address text, p_lat numeric, p_lng numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan. Silakan login ulang.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Akun ini belum memiliki role admin. Pastikan role akun di tabel profiles adalah admin.';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'Koordinat toko tidak valid. Isi latitude dan longitude dengan angka yang benar.';
  end if;

  insert into public.store (id, name, address, lat, lng)
  values (
    1,
    coalesce(nullif(trim(p_name), ''), 'FoodDash'),
    nullif(trim(p_address), ''),
    p_lat,
    p_lng
  )
  on conflict (id) do update
  set name = excluded.name,
      address = excluded.address,
      lat = excluded.lat,
      lng = excluded.lng;
end;
$$;

grant usage on schema public to authenticated;
grant select on public.store to anon, authenticated;
grant execute on function public.save_store(text, text, numeric, numeric) to authenticated;
