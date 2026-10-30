-- FoodDash v2: jalankan di Supabase SQL Editor SETELAH schema.sql (+ auth_patch.sql). Aman dijalankan berulang.

-- 1) Profil: no WA, foto, alamat
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists address text;

-- 2) Kategori, banner, pengaturan ongkir
create table if not exists categories(id uuid primary key default gen_random_uuid(), name text not null unique, sort int default 0);
create table if not exists banners(id uuid primary key default gen_random_uuid(), title text, subtitle text, image_url text, sort int default 0, active boolean default true);
create table if not exists settings(key text primary key, value numeric not null);
insert into settings(key,value) values('ship_base',5000),('ship_per_km',2000),('service_fee',2000) on conflict do nothing;

-- 3) Produk: kategori, foto, stok, deskripsi, rating
alter table menu_items add column if not exists category_id uuid references categories(id) on delete set null;
alter table menu_items add column if not exists description text;
alter table menu_items add column if not exists image_url text;
alter table menu_items add column if not exists stock int not null default 100;
alter table menu_items add column if not exists rating numeric(2,1) default 4.5;

-- 4) Order: metode bayar, jarak
alter table orders add column if not exists payment_method text default 'COD';
alter table orders add column if not exists distance_km numeric default 1;

-- 5) Chat customer <-> driver per order
create table if not exists messages(id bigserial primary key, order_id uuid not null references orders(id) on delete cascade, sender_id uuid not null references profiles(id), body text not null check (length(body)<=1000), created_at timestamptz default now());
create index if not exists messages_order on messages(order_id, created_at);

-- 6) RLS
alter table categories enable row level security; alter table banners enable row level security; alter table settings enable row level security; alter table messages enable row level security;
drop policy if exists c_sel on categories; create policy c_sel on categories for select using (true);
drop policy if exists c_all on categories; create policy c_all on categories for all using (is_admin()) with check (is_admin());
drop policy if exists b_sel on banners; create policy b_sel on banners for select using (true);
drop policy if exists b_all on banners; create policy b_all on banners for all using (is_admin()) with check (is_admin());
drop policy if exists s_sel on settings; create policy s_sel on settings for select using (true);
drop policy if exists s_all on settings; create policy s_all on settings for all using (is_admin()) with check (is_admin());
drop policy if exists m_all on menu_items; create policy m_all on menu_items for all using (is_admin()) with check (is_admin());
drop policy if exists m_sel on menu_items; create policy m_sel on menu_items for select using (true);

-- Profil: boleh lihat lawan transaksi (customer<->driver di order yang sama)
create or replace function can_see_profile(pid uuid) returns boolean language sql security definer stable set search_path=public as $$
 select pid=auth.uid() or is_admin() or exists(select 1 from orders o where (o.customer_id=pid and o.driver_id=auth.uid()) or (o.driver_id=pid and o.customer_id=auth.uid())) $$;
drop policy if exists p_sel on profiles; create policy p_sel on profiles for select using (can_see_profile(id));
drop policy if exists p_upd on profiles; create policy p_upd on profiles for update using (id=auth.uid()) with check (id=auth.uid());
-- Role tidak bisa diubah user sendiri (SQL Editor tetap bisa)
create or replace function protect_role() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then new.role:=old.role; end if; return new; end $$;
drop trigger if exists protect_role_t on profiles; create trigger protect_role_t before update on profiles for each row execute function protect_role();

-- Chat hanya untuk customer & driver dari order tsb (driver sudah ambil order)
drop policy if exists msg_sel on messages;
create policy msg_sel on messages for select using (exists(select 1 from orders o where o.id=order_id and (o.customer_id=auth.uid() or o.driver_id=auth.uid())) or is_admin());
drop policy if exists msg_ins on messages;
create policy msg_ins on messages for insert with check (sender_id=auth.uid() and exists(select 1 from orders o where o.id=order_id and o.driver_id is not null and (o.customer_id=auth.uid() or o.driver_id=auth.uid())));

-- 7) place_order v2: ongkir = dasar + per km (dari tabel settings), cek & kurangi stok
drop function if exists place_order(jsonb,text);
create or replace function place_order(p_items jsonb, p_address text, p_distance numeric, p_payment text) returns uuid language plpgsql security definer set search_path=public as $$
declare sub numeric:=0; snap jsonb:='[]'; r record; m menu_items; oid uuid; q int; sb_ numeric; spk numeric; sf numeric; km numeric; fee numeric;
begin
 if my_role()<>'customer' then raise exception 'Hanya customer'; end if;
 if coalesce(trim(p_address),'')='' then raise exception 'Alamat wajib diisi'; end if;
 if p_payment not in ('COD','CARD','EWALLET') then raise exception 'Metode bayar tidak valid'; end if;
 select value into sb_ from settings where key='ship_base'; select value into spk from settings where key='ship_per_km'; select value into sf from settings where key='service_fee';
 km:=greatest(least(coalesce(p_distance,1),50),0.5); fee:=coalesce(sb_,0)+coalesce(spk,0)*km;
 for r in select * from jsonb_to_recordset(p_items) as x(id uuid, qty int) loop
  q:=greatest(least(r.qty,20),1);
  select * into m from menu_items where id=r.id and available for update;
  if not found then raise exception 'Menu tidak tersedia'; end if;
  if m.stock<q then raise exception 'Stok % tinggal %', m.name, m.stock; end if;
  update menu_items set stock=stock-q where id=m.id;
  sub:=sub+m.price*q; snap:=snap||jsonb_build_object('id',m.id,'name',m.name,'price',m.price,'qty',q);
 end loop;
 if sub=0 then raise exception 'Keranjang kosong'; end if;
 insert into orders(customer_id,items,subtotal,delivery_fee,service_fee,total,address,payment_method,distance_km) values(auth.uid(),snap,sub,fee,coalesce(sf,0),sub+fee+coalesce(sf,0),p_address,p_payment,km) returning id into oid;
 insert into order_history(order_id,old_status,new_status,actor_id) values(oid,null,'PENDING',auth.uid());
 return oid;
end $$;

-- 8) advance_order: sama seperti sebelumnya + stok dikembalikan jika dibatalkan
create or replace function advance_order(p_id uuid, p_status text) returns void language plpgsql security definer set search_path=public as $$
declare o orders; rl text:=my_role(); ok boolean:=false; it jsonb;
begin
 select * into o from orders where id=p_id for update;
 if not found then raise exception 'Order tidak ada'; end if;
 if rl='admin' then ok:=(o.status,p_status) in (('PENDING','PREPARING'),('PREPARING','READY_FOR_PICKUP')) or (p_status='CANCELLED' and o.status in ('PENDING','PREPARING','READY_FOR_PICKUP'));
 elsif rl='customer' then ok:=o.customer_id=auth.uid() and o.status='PENDING' and p_status='CANCELLED';
 elsif rl='driver' then
  if o.status='READY_FOR_PICKUP' and p_status='DRIVER_ASSIGNED' and o.driver_id is null then ok:=true; update orders set driver_id=auth.uid() where id=p_id;
  else ok:=o.driver_id=auth.uid() and (o.status,p_status) in (('DRIVER_ASSIGNED','ON_DELIVERY'),('ON_DELIVERY','DELIVERED')); end if;
 end if;
 if not ok then raise exception 'Transisi % -> % tidak diizinkan', o.status, p_status; end if;
 if p_status='CANCELLED' then for it in select * from jsonb_array_elements(o.items) loop
   if it ? 'id' then update menu_items set stock=stock+(it->>'qty')::int where id=(it->>'id')::uuid; end if; end loop; end if;
 update orders set status=p_status where id=p_id;
 insert into order_history(order_id,old_status,new_status,actor_id) values(p_id,o.status,p_status,auth.uid());
end $$;

-- 9) Realtime untuk chat
do $$ begin alter publication supabase_realtime add table messages; exception when duplicate_object then null; end $$;

-- 10) Storage foto (produk, banner, avatar)
insert into storage.buckets(id,name,public) values('media','media',true) on conflict (id) do nothing;
drop policy if exists media_sel on storage.objects; create policy media_sel on storage.objects for select using (bucket_id='media');
drop policy if exists media_ins on storage.objects; create policy media_ins on storage.objects for insert to authenticated with check (bucket_id='media' and (is_admin() or ((storage.foldername(name))[1]='avatars' and (storage.foldername(name))[2]=auth.uid()::text)));
drop policy if exists media_del on storage.objects; create policy media_del on storage.objects for delete to authenticated using (bucket_id='media' and (is_admin() or ((storage.foldername(name))[1]='avatars' and (storage.foldername(name))[2]=auth.uid()::text)));

-- 11) Contoh kategori & produk burger (opsional)
insert into categories(name,sort) values('Combo',1),('Burger',2),('Minuman',3) on conflict do nothing;

-- 12) Hapus user dari Authentication tidak lagi error (foreign key cascade)
alter table orders drop constraint if exists orders_customer_id_fkey;
alter table orders add constraint orders_customer_id_fkey foreign key (customer_id) references profiles(id) on delete cascade;
alter table orders drop constraint if exists orders_driver_id_fkey;
alter table orders add constraint orders_driver_id_fkey foreign key (driver_id) references profiles(id) on delete set null;
alter table order_history drop constraint if exists order_history_order_id_fkey;
alter table order_history add constraint order_history_order_id_fkey foreign key (order_id) references orders(id) on delete cascade;
alter table messages drop constraint if exists messages_sender_id_fkey;
alter table messages add constraint messages_sender_id_fkey foreign key (sender_id) references profiles(id) on delete cascade;
