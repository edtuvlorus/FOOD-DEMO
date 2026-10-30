'use client';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
// Publishable key aman dipakai di sisi klien (akses dibatasi oleh RLS). Env var tetap diprioritaskan jika diisi.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bbdywafwcymsiehomggh.supabase.co';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_vfyUL-6CbqrFGi0GJjru7Q_R75EWL-O';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
export const rp = n => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
export const toast = (m, t = 'ok') => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('toast', { detail: { m, t } }));
export const STATUS = { PENDING: 'Menunggu konfirmasi', PREPARING: 'Sedang disiapkan', READY_FOR_PICKUP: 'Menunggu driver', DRIVER_ASSIGNED: 'Driver menuju resto', ON_DELIVERY: 'Dalam pengantaran', DELIVERED: 'Selesai', CANCELLED: 'Dibatalkan' };
export const FLOW = ['PENDING', 'PREPARING', 'READY_FOR_PICKUP', 'DRIVER_ASSIGNED', 'ON_DELIVERY', 'DELIVERED'];
export const PAYLABEL = { COD: 'Bayar di tempat (COD)', CARD: 'Kartu debit / kredit', EWALLET: 'E-wallet' };
export const isActive = o => !['DELIVERED', 'CANCELLED'].includes(o.status);

export function useGuard(role) {
  const [me, setMe] = useState(null); const r = useRouter();
  const reload = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser(); if (!user) return r.replace('/login');
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (!p || p.role !== role) return r.replace(p ? '/' + p.role : '/login'); setMe({ ...p, email: user.email });
  }, [role]);
  useEffect(() => { reload() }, [reload]);
  return { me, reload };
}
export function useOrders(me) {
  const [orders, set] = useState(null);
  const load = useCallback(async () => { const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }); error ? toast(error.message, 'err') : set(data) }, []);
  useEffect(() => { if (!me) return; load(); const ch = sb.channel('o' + Math.random()).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load).subscribe(); return () => { sb.removeChannel(ch) } }, [me, load]);
  const act = async (id, s, msg) => { const { error } = await sb.rpc('advance_order', { p_id: id, p_status: s }); error ? toast(error.message, 'err') : msg && toast(msg); load() };
  return { orders, act, load };
}
export function useList(table, orderCol, me) {
  const [rows, set] = useState(null);
  const load = useCallback(async () => { const { data, error } = await sb.from(table).select('*').order(orderCol); error ? (toast(error.message, 'err'), set([])) : set(data) }, [table, orderCol]);
  useEffect(() => { if (me) load() }, [me, load]);
  return [rows, load];
}
export function useSettings(me) {
  const [s, set] = useState({ ship_base: 5000, ship_per_km: 2000, service_fee: 2000 });
  const load = useCallback(async () => { const { data } = await sb.from('settings').select('*'); if (data) set(Object.fromEntries(data.map(x => [x.key, Number(x.value)]))) }, []);
  useEffect(() => { if (me) load() }, [me, load]);
  return [s, load];
}
export function useProfiles(ids) {
  const [map, set] = useState({}); const key = [...new Set((ids || []).filter(Boolean))].sort().join(',');
  useEffect(() => { if (!key) return; sb.from('profiles').select('id,name,phone,avatar_url,role').in('id', key.split(',')).then(({ data }) => data && set(m => ({ ...m, ...Object.fromEntries(data.map(p => [p.id, p])) }))) }, [key]);
  return map;
}
export async function uploadImage(file, folder) {
  if (!file) return null; if (file.size > 3 * 1024 * 1024) { toast('Ukuran foto maksimal 3 MB', 'err'); return null }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { contentType: file.type, upsert: true });
  if (error) { toast('Upload gagal: ' + error.message, 'err'); return null }
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}
