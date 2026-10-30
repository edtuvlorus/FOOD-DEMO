'use client';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// Publishable key aman dipakai di sisi klien (akses dibatasi oleh RLS). Env var tetap diprioritaskan jika diisi.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bbdywafwcymsiehomggh.supabase.co';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_vfyUL-6CbqrFGi0GJjru7Q_R75EWL-O';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
export const rp = n => 'Rp'+Number(n).toLocaleString('id-ID');
export function useGuard(role){
  const [me,setMe]=useState(null); const r=useRouter();
  useEffect(()=>{(async()=>{
    const {data:{user}}=await sb.auth.getUser(); if(!user) return r.replace('/login');
    const {data:p}=await sb.from('profiles').select('*').eq('id',user.id).single();
    if(!p||p.role!==role) return r.replace(p?'/'+p.role:'/login'); setMe(p);
  })()},[]);
  return me;
}
export function useOrders(me){
  const [orders,set]=useState(null); const [err,setErr]=useState('');
  const load=async()=>{const {data,error}=await sb.from('orders').select('*').order('created_at',{ascending:false}); error?setErr(error.message):set(data)};
  useEffect(()=>{ if(!me) return; load(); const ch=sb.channel('o').on('postgres_changes',{event:'*',schema:'public',table:'orders'},load).subscribe(); return()=>sb.removeChannel(ch)},[me]);
  const act=async(id,s)=>{const {error}=await sb.rpc('advance_order',{p_id:id,p_status:s}); setErr(error?error.message:''); load()};
  return {orders,err,act,load};
}
export function Bar({me,title}){ const r=useRouter(); return <header><b>{title}</b><span>{me.name} <button onClick={async()=>{await sb.auth.signOut();r.replace('/login')}}>Logout</button></span></header> }
export function OrderCard({o,children}){ return <div className="card"><div><b>#{o.id.slice(0,6)}</b> <span className="tag">{o.status}</span></div><small>{o.items.map(i=>i.qty+'x '+i.name).join(', ')}</small><div>{rp(o.total)} • {o.address}</div><div className="row">{children}</div></div> }
