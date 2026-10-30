-- FoodDash v8: admin confirm/cancel all active orders.
-- Jalankan setelah schema_v7.sql di Supabase SQL Editor.

create or replace function public.advance_order(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  rl text := public.my_role();
  ok boolean := false;
  it jsonb;
begin
  select * into o from public.orders where id = p_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;

  if rl = 'admin' then
    ok :=
      (o.status = 'PENDING' and p_status = 'PREPARING')
      or (o.status = 'PREPARING' and p_status = 'READY_FOR_PICKUP')
      or (p_status = 'CANCELLED' and o.status not in ('DELIVERED', 'CANCELLED'));
  elsif rl = 'customer' then
    ok := o.customer_id = auth.uid()
      and o.status = 'PENDING' and p_status = 'CANCELLED';
  elsif rl = 'driver' then
    if o.status = 'READY_FOR_PICKUP' and p_status = 'DRIVER_ASSIGNED' and o.driver_id is null then
      ok := true;
      update public.orders set driver_id = auth.uid() where id = p_id;
    else
      ok := o.driver_id = auth.uid()
        and (o.status, p_status) in (('DRIVER_ASSIGNED', 'ON_DELIVERY'), ('ON_DELIVERY', 'DELIVERED'));
    end if;
  end if;

  if not ok then
    raise exception 'Perubahan status % ke % tidak diizinkan', o.status, p_status;
  end if;

  if p_status = 'CANCELLED' and o.status not in ('DELIVERED', 'CANCELLED') then
    for it in select * from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) loop
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
