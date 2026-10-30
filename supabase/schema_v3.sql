-- FoodDash v3: jalankan SETELAH schema_v2.sql. Aman dijalankan berulang.
-- Isi: lokasi toko, lokasi driver real-time, koordinat tujuan pesanan.

-- 1) Lokasi toko (satu baris, diatur admin)
create table if not exists store(id int primary key default 1 check (id=1), name text, address text, lat numeric, lng numeric);
insert into store(id,name) values(1,'FoodDash') on conflict do nothing;
alter table store enable row level security;
drop policy if exists st_sel on store; create policy st_sel on store for select using (true);
drop policy if exists st_all on store; create policy st_all on store for all using (is_admin()) with check (is_admin());

-- 2) Koordinat tujuan pesanan
alter table orders add column if not exists dest_lat numeric;
alter table orders add column if not exists dest_lng numeric;

-- 3) Lokasi driver per pesanan (dikirim driver, dibaca customer/admin)
create table if not exists driver_locations(
  order_id uuid primary key references orders(id) on delete cascade,
  driver_id uuid not null references profiles(id) on delete cascade,
  lat numeric not null, lng numeric not null, speed_kmh numeric,
  start_lat numeric, start_lng numeric, phase text,
  started_at timestamptz default now(), updated_at timestamptz default now());
alter table driver_locations enable row level security;
drop policy if exists dl_sel on driver_locations;
create policy dl_sel on driver_locations for select using (is_admin() or exists(select 1 from orders o where o.id=order_id and (o.customer_id=auth.uid() or o.driver_id=auth.uid())));

-- Driver mengirim lokasi. Titik awal direset setiap status berganti (mis. saat mulai antar)
create or replace function update_driver_location(p_order uuid, p_lat numeric, p_lng numeric, p_speed numeric) returns void language plpgsql security definer set search_path=public as $$
declare o orders; st text;
begin
 select * into o from orders where id=p_order;
 if not found or o.driver_id is distinct from auth.uid() or o.status not in ('DRIVER_ASSIGNED','ON_DELIVERY') then raise exception 'Tidak diizinkan'; end if;
 st:=o.status;
 insert into driver_locations(order_id,driver_id,lat,lng,speed_kmh,start_lat,start_lng,phase)
 values(p_order,auth.uid(),p_lat,p_lng,p_speed,p_lat,p_lng,st)
 on conflict (order_id) do update set lat=excluded.lat, lng=excluded.lng, speed_kmh=excluded.speed_kmh, updated_at=now(),
   start_lat=case when driver_locations.phase is distinct from st then excluded.lat else driver_locations.start_lat end,
   start_lng=case when driver_locations.phase is distinct from st then excluded.lng else driver_locations.start_lng end,
   started_at=case when driver_locations.phase is distinct from st then now() else driver_locations.started_at end,
   phase=st;
end $$;

-- Customer menyimpan titik tujuan (untuk estimasi waktu) pada pesanan miliknya yang masih aktif
create or replace function set_order_dest(p_order uuid, p_lat numeric, p_lng numeric) returns void language plpgsql security definer set search_path=public as $$
begin
 update orders set dest_lat=p_lat, dest_lng=p_lng where id=p_order and customer_id=auth.uid() and status not in ('DELIVERED','CANCELLED');
 if not found then raise exception 'Pesanan tidak ditemukan atau sudah selesai'; end if;
end $$;

-- 4) place_order v3: terima koordinat tujuan (opsional)
drop function if exists place_order(jsonb,text,numeric,text);
create or replace function place_order(p_items jsonb, p_address text, p_distance numeric, p_payment text, p_lat numeric default null, p_lng numeric default null) returns uuid language plpgsql security definer set search_path=public as $$
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
 insert into orders(customer_id,items,subtotal,delivery_fee,service_fee,total,address,payment_method,distance_km,dest_lat,dest_lng)
 values(auth.uid(),snap,sub,fee,coalesce(sf,0),sub+fee+coalesce(sf,0),p_address,p_payment,km,p_lat,p_lng) returning id into oid;
 insert into order_history(order_id,old_status,new_status,actor_id) values(oid,null,'PENDING',auth.uid());
 return oid;
end $$;

-- 5) Realtime lokasi driver
do $$ begin alter publication supabase_realtime add table driver_locations; exception when duplicate_object then null; end $$;
