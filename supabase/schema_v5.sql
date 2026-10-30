-- FoodDash v5: metode pembayaran dinamis, bukti pembayaran, pembatasan status, hapus order.
-- Jalankan SETELAH schema_v4.sql di Supabase SQL Editor.

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'E-Wallet',
  account_name text,
  account_number text,
  image_url text,
  active boolean not null default true,
  sort int not null default 1,
  created_at timestamptz not null default now()
);
alter table payment_methods enable row level security;
drop policy if exists pm_select on payment_methods;
create policy pm_select on payment_methods for select using (active or my_role()='admin');
drop policy if exists pm_admin on payment_methods;
create policy pm_admin on payment_methods for all to authenticated using (my_role()='admin') with check (my_role()='admin');

alter table orders add column if not exists payment_method_name text;
alter table orders add column if not exists payment_proof_url text;

-- Ganti RPC pemesanan agar menerima metode pembayaran buatan admin dan URL bukti.
drop function if exists place_order(jsonb,text,numeric,text,numeric,numeric);
create or replace function place_order(
  p_items jsonb, p_address text, p_distance numeric, p_payment text,
  p_proof text default null, p_lat numeric default null, p_lng numeric default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  sub numeric:=0; snap jsonb:='[]'; r record; m menu_items; oid uuid; q int;
  sb_ numeric; spk numeric; sf numeric; km numeric; fee numeric; method_name text;
begin
  if my_role()<>'customer' then raise exception 'Hanya customer yang dapat membuat pesanan'; end if;
  if coalesce(trim(p_address),'')='' then raise exception 'Alamat wajib diisi'; end if;
  if p_payment='COD' then method_name:='Bayar di tempat (COD)';
  else
    select name into method_name from payment_methods where id::text=p_payment and active=true;
    if method_name is null then raise exception 'Metode pembayaran tidak tersedia'; end if;
    if coalesce(trim(p_proof),'')='' then raise exception 'Bukti pembayaran wajib diunggah'; end if;
  end if;
  select value into sb_ from settings where key='ship_base';
  select value into spk from settings where key='ship_per_km';
  select value into sf from settings where key='service_fee';
  km:=greatest(least(coalesce(p_distance,1),50),0.5); fee:=coalesce(sb_,0)+coalesce(spk,0)*km;
  for r in select * from jsonb_to_recordset(p_items) as x(id uuid, qty int) loop
    q:=greatest(least(r.qty,20),1);
    select * into m from menu_items where id=r.id and available for update;
    if not found then raise exception 'Menu tidak tersedia'; end if;
    if m.stock<q then raise exception 'Stok % tinggal %',m.name,m.stock; end if;
    update menu_items set stock=stock-q where id=m.id;
    sub:=sub+m.price*q;
    snap:=snap||jsonb_build_object('id',m.id,'name',m.name,'price',m.price,'qty',q);
  end loop;
  if sub=0 then raise exception 'Keranjang kosong'; end if;
  insert into orders(customer_id,items,subtotal,delivery_fee,service_fee,total,address,payment_method,payment_method_name,payment_proof_url,distance_km,dest_lat,dest_lng)
  values(auth.uid(),snap,sub,fee,coalesce(sf,0),sub+fee+coalesce(sf,0),p_address,p_payment,method_name,p_proof,km,p_lat,p_lng)
  returning id into oid;
  insert into order_history(order_id,old_status,new_status,actor_id) values(oid,null,'PENDING',auth.uid());
  return oid;
end $$;
grant execute on function place_order(jsonb,text,numeric,text,text,numeric,numeric) to authenticated;

-- Status PENDING memang tidak boleh langsung menjadi PREPARING.
create or replace function advance_order(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path=public as $$
declare o orders; rl text:=my_role(); ok boolean:=false; it jsonb;
begin
  select * into o from orders where id=p_id for update;
  if not found then raise exception 'Order tidak ada'; end if;
  if rl='admin' then
    ok:=(o.status,p_status) in (('PREPARING','READY_FOR_PICKUP'))
      or (p_status='CANCELLED' and o.status in ('PENDING','PREPARING','READY_FOR_PICKUP'));
  elsif rl='customer' then
    ok:=o.customer_id=auth.uid() and o.status='PENDING' and p_status='CANCELLED';
  elsif rl='driver' then
    if o.status='READY_FOR_PICKUP' and p_status='DRIVER_ASSIGNED' and o.driver_id is null then
      ok:=true; update orders set driver_id=auth.uid() where id=p_id;
    else
      ok:=o.driver_id=auth.uid() and (o.status,p_status) in (('DRIVER_ASSIGNED','ON_DELIVERY'),('ON_DELIVERY','DELIVERED'));
    end if;
  end if;
  if not ok then raise exception 'Transisi % -> % tidak diizinkan',o.status,p_status; end if;
  if p_status='CANCELLED' then
    for it in select * from jsonb_array_elements(o.items) loop
      if it ? 'id' then update menu_items set stock=stock+(it->>'qty')::int where id=(it->>'id')::uuid; end if;
    end loop;
  end if;
  update orders set status=p_status where id=p_id;
  insert into order_history(order_id,old_status,new_status,actor_id) values(p_id,o.status,p_status,auth.uid());
end $$;
grant execute on function advance_order(uuid,text) to authenticated;

-- Hapus kartu order dari dashboard. Stok dipulihkan untuk order yang belum selesai/batal.
create or replace function admin_delete_order(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare o orders; it jsonb;
begin
  if my_role() is distinct from 'admin' then raise exception 'Hanya admin yang boleh menghapus pesanan'; end if;
  select * into o from orders where id=p_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
  if o.status not in ('DELIVERED','CANCELLED') then
    for it in select * from jsonb_array_elements(o.items) loop
      if it ? 'id' then update menu_items set stock=stock+(it->>'qty')::int where id=(it->>'id')::uuid; end if;
    end loop;
  end if;
  delete from order_history where order_id=p_id;
  delete from orders where id=p_id;
end $$;
grant execute on function admin_delete_order(uuid) to authenticated;

-- Realtime daftar metode pembayaran untuk customer.
do $$ begin alter publication supabase_realtime add table payment_methods; exception when duplicate_object then null; end $$;

-- Customer boleh mengunggah bukti pembayaran ke folder payment-proofs.
drop policy if exists media_ins on storage.objects;
create policy media_ins on storage.objects for insert to authenticated
with check (bucket_id='media' and (
  is_admin()
  or ((storage.foldername(name))[1]='avatars' and (storage.foldername(name))[2]=auth.uid()::text)
  or ((storage.foldername(name))[1]='payment-proofs' and my_role()='customer')
));
