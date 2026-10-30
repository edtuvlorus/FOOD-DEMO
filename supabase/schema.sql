-- Jalankan di Supabase SQL Editor
create table profiles(id uuid primary key references auth.users on delete cascade, name text, role text not null default 'customer' check (role in ('customer','driver','admin')));
create table menu_items(id uuid primary key default gen_random_uuid(), name text not null, price numeric(12,2) not null, emoji text, available boolean default true);
create table orders(id uuid primary key default gen_random_uuid(), customer_id uuid not null references profiles(id), driver_id uuid references profiles(id), items jsonb not null, subtotal numeric(12,2), delivery_fee numeric(12,2), service_fee numeric(12,2), total numeric(12,2), address text, status text not null default 'PENDING', created_at timestamptz default now());
create table order_history(id bigserial primary key, order_id uuid references orders(id), old_status text, new_status text, actor_id uuid, created_at timestamptz default now());
create index on orders(customer_id); create index on orders(driver_id); create index on orders(status);

create function is_admin() returns boolean language sql security definer stable as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
create function my_role() returns text language sql security definer stable as $$ select role from profiles where id=auth.uid() $$;

-- Role bukan input bebas: hanya customer/driver; admin diset manual via SQL
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin insert into profiles(id,name,role) values(new.id, coalesce(new.raw_user_meta_data->>'name',new.email), case when new.raw_user_meta_data->>'role'='driver' then 'driver' else 'customer' end); return new; end $$;
create trigger on_auth_user after insert on auth.users for each row execute function handle_new_user();

alter table profiles enable row level security; alter table menu_items enable row level security; alter table orders enable row level security; alter table order_history enable row level security;
create policy p_sel on profiles for select using (id=auth.uid() or is_admin());
create policy m_sel on menu_items for select using (true);
create policy o_sel on orders for select using (customer_id=auth.uid() or driver_id=auth.uid() or is_admin() or (status='READY_FOR_PICKUP' and my_role()='driver'));
create policy h_sel on order_history for select using (is_admin());

-- Harga dihitung ulang di server
create function place_order(p_items jsonb, p_address text) returns uuid language plpgsql security definer as $$
declare sub numeric:=0; snap jsonb:='[]'; r record; m menu_items; oid uuid; q int;
begin
 if my_role()<>'customer' then raise exception 'Hanya customer'; end if;
 for r in select * from jsonb_to_recordset(p_items) as x(id uuid, qty int) loop
  q:=greatest(least(r.qty,20),1);
  select * into m from menu_items where id=r.id and available;
  if not found then raise exception 'Menu tidak tersedia'; end if;
  sub:=sub+m.price*q; snap:=snap||jsonb_build_object('name',m.name,'price',m.price,'qty',q);
 end loop;
 if sub=0 then raise exception 'Keranjang kosong'; end if;
 insert into orders(customer_id,items,subtotal,delivery_fee,service_fee,total,address) values(auth.uid(),snap,sub,10000,2000,sub+12000,p_address) returning id into oid;
 insert into order_history(order_id,old_status,new_status,actor_id) values(oid,null,'PENDING',auth.uid());
 return oid;
end $$;

-- Validasi transisi status + atomic driver assignment (row lock)
create function advance_order(p_id uuid, p_status text) returns void language plpgsql security definer as $$
declare o orders; rl text:=my_role(); ok boolean:=false;
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
 update orders set status=p_status where id=p_id;
 insert into order_history(order_id,old_status,new_status,actor_id) values(p_id,o.status,p_status,auth.uid());
end $$;

alter publication supabase_realtime add table orders;
insert into menu_items(name,price,emoji) values('Nasi Goreng',25000,'🍛'),('Ayam Bakar',32000,'🍗'),('Mie Ayam',20000,'🍜'),('Es Teh',5000,'🧋'),('Sate Ayam',28000,'🍢');
-- Jadikan admin: update profiles set role='admin' where id=(select id from auth.users where email='EMAIL_ADMIN');
