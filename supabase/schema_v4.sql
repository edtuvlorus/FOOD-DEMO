-- FoodDash v4: jalankan SETELAH schema_v3.sql. Aman dijalankan berulang.
-- Isi: (1) perbaikan error RLS tabel store, (2) alamat tersimpan customer.

-- 1) Perbaikan: 'new row violates row-level security policy for table "store"'
-- Simpan lokasi toko lewat fungsi security definer (cek role admin di dalam fungsi),
-- sehingga tidak bergantung pada upsert + policy RLS dari klien.
create table if not exists store(id int primary key default 1 check (id=1), name text, address text, lat numeric, lng numeric);
insert into store(id,name) values(1,'FoodDash') on conflict do nothing;
alter table store enable row level security;
drop policy if exists st_sel on store; create policy st_sel on store for select using (true);
drop policy if exists st_all on store;
drop policy if exists st_ins on store; create policy st_ins on store for insert to authenticated with check (my_role()='admin');
drop policy if exists st_upd on store; create policy st_upd on store for update to authenticated using (my_role()='admin') with check (my_role()='admin');
drop policy if exists st_del on store; create policy st_del on store for delete to authenticated using (my_role()='admin');

create or replace function save_store(p_name text, p_address text, p_lat numeric, p_lng numeric) returns void language plpgsql security definer set search_path=public as $$
begin
  if my_role() is distinct from 'admin' then raise exception 'Hanya admin yang boleh mengubah lokasi toko (login sebagai admin)'; end if;
  if p_lat is null or p_lng is null or abs(p_lat)>90 or abs(p_lng)>180 then raise exception 'Koordinat tidak valid'; end if;
  insert into store(id,name,address,lat,lng) values(1,coalesce(nullif(trim(p_name),''),'FoodDash'),nullif(trim(p_address),''),p_lat,p_lng)
  on conflict (id) do update set name=excluded.name, address=excluded.address, lat=excluded.lat, lng=excluded.lng;
end $$;
grant execute on function save_store(text,text,numeric,numeric) to authenticated;

-- 2) Alamat tersimpan customer
create table if not exists addresses(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  label text not null check (length(label)<=40),
  address text not null check (length(address)<=300),
  lat numeric, lng numeric, distance_km numeric,
  is_default boolean not null default false,
  created_at timestamptz default now());
create index if not exists addresses_user on addresses(user_id);
alter table addresses enable row level security;
drop policy if exists ad_sel on addresses; create policy ad_sel on addresses for select to authenticated using (user_id=auth.uid());
drop policy if exists ad_ins on addresses; create policy ad_ins on addresses for insert to authenticated with check (user_id=auth.uid());
drop policy if exists ad_upd on addresses; create policy ad_upd on addresses for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists ad_del on addresses; create policy ad_del on addresses for delete to authenticated using (user_id=auth.uid());
