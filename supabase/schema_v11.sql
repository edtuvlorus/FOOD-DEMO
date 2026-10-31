-- FoodDash v11: alur pesanan final dan aman dari bentrok status.
-- Jalankan schema_v9.sql lalu schema_v10.sql, kemudian file ini di Supabase SQL Editor.

create or replace function public.advance_order(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  rl text;
  it jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan. Silakan masuk kembali.';
  end if;
  if p_status not in ('PREPARING','READY_FOR_PICKUP','DRIVER_ASSIGNED','ON_DELIVERY','DELIVERED','CANCELLED') then
    raise exception 'Status tidak valid';
  end if;

  rl := public.my_role();
  select * into o from public.orders where id = p_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;

  -- ADMIN: konfirmasi -> siap diambil, atau batalkan.
  if rl = 'admin' then
    if not (
      (o.status = 'PENDING' and p_status = 'PREPARING') or
      (o.status = 'PREPARING' and p_status = 'READY_FOR_PICKUP') or
      (p_status = 'CANCELLED' and o.status not in ('DELIVERED','CANCELLED'))
    ) then
      raise exception 'Status pesanan tidak dapat diubah dengan aksi ini';
    end if;

  -- CUSTOMER hanya boleh membatalkan sebelum admin mengonfirmasi.
  elsif rl = 'customer' then
    if not (o.customer_id = auth.uid() and o.status = 'PENDING' and p_status = 'CANCELLED') then
      raise exception 'Pesanan sudah tidak dapat dibatalkan';
    end if;

  -- DRIVER: ambil hanya order yang benar-benar READY dan belum punya driver.
  elsif rl = 'driver' then
    if o.status = 'READY_FOR_PICKUP' and p_status = 'DRIVER_ASSIGNED' then
      if o.driver_id is not null then raise exception 'Pesanan sudah diambil driver lain'; end if;
      update public.orders set driver_id = auth.uid() where id = p_id;
    elsif not (o.driver_id = auth.uid() and ((o.status = 'DRIVER_ASSIGNED' and p_status = 'ON_DELIVERY') or (o.status = 'ON_DELIVERY' and p_status = 'DELIVERED'))) then
      raise exception 'Aksi driver tidak sesuai dengan status pesanan';
    end if;
  else
    raise exception 'Role akun tidak diizinkan';
  end if;

  -- Stok hanya dikembalikan saat pembatalan pertama.
  if p_status = 'CANCELLED' then
    for it in select * from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) loop
      if it ? 'id' then
        update public.menu_items
        set stock = coalesce(stock,0) + greatest(coalesce((it->>'qty')::int,0),0)
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
