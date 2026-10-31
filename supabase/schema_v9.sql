-- FoodDash v9: perbaikan role, pemesanan berulang, sesi persisten, dan aksi driver.
-- Jalankan SEKALI di Supabase SQL Editor dengan role database yang berwenang (biasanya postgres).
-- Tidak menghapus data pesanan/menu/profil.

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.my_role() to authenticated;

-- Pastikan daftar order siap diambil dapat dibaca driver.
drop policy if exists o_sel on public.orders;
create policy o_sel on public.orders
for select to authenticated
using (
  customer_id = auth.uid()
  or driver_id = auth.uid()
  or public.my_role() = 'admin'
  or (status = 'READY_FOR_PICKUP' and public.my_role() = 'driver')
);

-- Pemesanan berulang: tidak ada batasan satu order per customer.
-- Validasi role berdasarkan profil user yang sedang login, bukan role input dari browser.
create or replace function public.place_order(
  p_items jsonb,
  p_address text,
  p_distance numeric,
  p_payment text,
  p_proof text default null,
  p_lat numeric default null,
  p_lng numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sub numeric := 0;
  snap jsonb := '[]'::jsonb;
  r record;
  m public.menu_items;
  oid uuid;
  q int;
  sb_ numeric;
  spk numeric;
  sf numeric;
  km numeric;
  fee numeric;
  method_name text;
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan. Silakan masuk kembali.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'customer'
  ) then
    raise exception 'Akun ini bukan customer. Periksa role akun pada tabel profiles.';
  end if;

  if coalesce(trim(p_address), '') = '' then
    raise exception 'Alamat wajib diisi';
  end if;

  if p_payment = 'COD' then
    method_name := 'Bayar di tempat (COD)';
  else
    select pm.name into method_name
    from public.payment_methods pm
    where pm.id::text = p_payment and pm.active = true;
    if method_name is null then
      raise exception 'Metode pembayaran tidak tersedia';
    end if;
    if coalesce(trim(p_proof), '') = '' then
      raise exception 'Bukti pembayaran wajib diunggah';
    end if;
  end if;

  select value into sb_ from public.settings where key = 'ship_base';
  select value into spk from public.settings where key = 'ship_per_km';
  select value into sf from public.settings where key = 'service_fee';

  km := greatest(least(coalesce(p_distance, 1), 50), 0.5);
  fee := coalesce(sb_, 0) + coalesce(spk, 0) * km;

  for r in
    select * from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as x(id uuid, qty int)
  loop
    q := greatest(least(coalesce(r.qty, 1), 20), 1);
    select * into m
    from public.menu_items
    where id = r.id and available = true
    for update;

    if not found then
      raise exception 'Menu tidak tersedia';
    end if;
    if coalesce(m.stock, 0) < q then
      raise exception 'Stok % tinggal %', m.name, coalesce(m.stock, 0);
    end if;

    update public.menu_items set stock = stock - q where id = m.id;
    sub := sub + m.price * q;
    snap := snap || jsonb_build_array(
      jsonb_build_object('id', m.id, 'name', m.name, 'price', m.price, 'qty', q)
    );
  end loop;

  if sub <= 0 then
    raise exception 'Keranjang kosong';
  end if;

  insert into public.orders(
    customer_id, items, subtotal, delivery_fee, service_fee, total, address,
    payment_method, payment_method_name, payment_proof_url,
    distance_km, dest_lat, dest_lng
  )
  values (
    auth.uid(), snap, sub, fee, coalesce(sf, 0), sub + fee + coalesce(sf, 0),
    p_address, p_payment, method_name, p_proof, km, p_lat, p_lng
  )
  returning id into oid;

  insert into public.order_history(order_id, old_status, new_status, actor_id)
  values (oid, null, 'PENDING', auth.uid());

  return oid;
end;
$$;

grant execute on function public.place_order(jsonb, text, numeric, text, text, numeric, numeric)
to authenticated;

-- Transisi status lengkap; setiap order dapat melewati seluruh tahapan.
-- Driver hanya dapat mengambil order yang belum dimiliki driver lain.
create or replace function public.advance_order(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  rl text;
  ok boolean := false;
  it jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan. Silakan masuk kembali.';
  end if;

  rl := public.my_role();

  select * into o
  from public.orders
  where id = p_id
  for update;

  if not found then
    raise exception 'Pesanan tidak ditemukan';
  end if;

  if rl = 'admin' then
    ok :=
      (o.status = 'PENDING' and p_status = 'PREPARING')
      or (o.status = 'PREPARING' and p_status = 'READY_FOR_PICKUP')
      or (p_status = 'CANCELLED' and o.status not in ('DELIVERED', 'CANCELLED'));

  elsif rl = 'customer' then
    ok := o.customer_id = auth.uid()
      and o.status = 'PENDING'
      and p_status = 'CANCELLED';

  elsif rl = 'driver' then
    if o.status = 'READY_FOR_PICKUP'
       and p_status = 'DRIVER_ASSIGNED'
       and o.driver_id is null then
      ok := true;
      update public.orders
      set driver_id = auth.uid()
      where id = p_id and driver_id is null;
      if not found then
        raise exception 'Pesanan sudah diambil driver lain. Muat ulang daftar order.';
      end if;
    else
      ok := o.driver_id = auth.uid()
        and (
          (o.status = 'DRIVER_ASSIGNED' and p_status = 'ON_DELIVERY')
          or (o.status = 'ON_DELIVERY' and p_status = 'DELIVERED')
        );
    end if;
  end if;

  if not ok then
    raise exception 'Aksi tidak diizinkan untuk role % pada status % ke %',
      coalesce(rl, 'tidak ditemukan'), o.status, p_status;
  end if;

  -- Pulihkan stok hanya sekali ketika order dibatalkan.
  if p_status = 'CANCELLED' and o.status not in ('DELIVERED', 'CANCELLED') then
    for it in
      select * from jsonb_array_elements(coalesce(o.items, '[]'::jsonb))
    loop
      if it ? 'id' then
        update public.menu_items
        set stock = coalesce(stock, 0) + greatest(coalesce((it->>'qty')::int, 0), 0)
        where id = (it->>'id')::uuid;
      end if;
    end loop;
  end if;

  update public.orders
  set status = p_status,
      driver_id = case when p_status = 'CANCELLED' then null else driver_id end
  where id = p_id;

  insert into public.order_history(order_id, old_status, new_status, actor_id)
  values (p_id, o.status, p_status, auth.uid());
end;
$$;

grant execute on function public.advance_order(uuid, text) to authenticated;

-- Realtime membantu customer/admin/driver melihat perubahan tanpa login ulang.
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then
  null;
when undefined_object then
  null;
end $$;
