-- Membuat / memperbarui akun admin langsung dari SQL Editor (aman dijalankan berulang).
-- Setelah ini login di /login (atau langsung buka /admin) dengan email & password di bawah.
create extension if not exists pgcrypto;
do $$
declare uid uuid; em text:='alifseribu2@gmail.com'; pw text:='Admin2026'; nm text:='rusmani';
begin
 select id into uid from auth.users where email=em;
 if uid is null then
  uid:=gen_random_uuid();
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
  values('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',em,crypt(pw,gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('name',nm),now(),now(),'','','','');
  insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  values(gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid::text,'email',em,'email_verified',true),'email',now(),now(),now());
 else
  update auth.users set encrypted_password=crypt(pw,gen_salt('bf')), email_confirmed_at=coalesce(email_confirmed_at,now()), raw_user_meta_data=jsonb_build_object('name',nm) where id=uid;
 end if;
 insert into profiles(id,name,role) values(uid,nm,'admin') on conflict (id) do update set name=nm, role='admin';
end $$;
