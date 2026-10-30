-- Jalankan di Supabase SQL Editor (aman dijalankan berulang)
-- 1) Trigger: setiap user baru di Authentication otomatis dibuat profilnya (nama & role tersimpan tetap)
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id,name,role)
  values(new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''), new.email),
         case when new.raw_user_meta_data->>'role'='driver' then 'driver' else 'customer' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user on auth.users;
create trigger on_auth_user after insert on auth.users for each row execute function handle_new_user();

-- 2) Backfill: user yang sudah ada di Authentication tapi belum punya profil
insert into profiles(id,name,role)
select u.id, coalesce(nullif(trim(u.raw_user_meta_data->>'name'),''), u.email),
       case when u.raw_user_meta_data->>'role'='driver' then 'driver' else 'customer' end
from auth.users u where not exists (select 1 from profiles p where p.id=u.id);
