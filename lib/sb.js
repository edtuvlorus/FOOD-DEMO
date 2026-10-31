'use client';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
// Publishable key aman dipakai di sisi klien (akses dibatasi oleh RLS). Env var tetap diprioritaskan jika diisi.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bbdywafwcymsiehomggh.supabase.co';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_vfyUL-6CbqrFGi0GJjru7Q_R75EWL-O';
// Simpan sesi autentikasi per TAB, bukan localStorage bersama seluruh tab.
// Dengan sessionStorage, akun Admin/Driver/Customer di tab berbeda tidak saling menimpa.
const tabAuthStorage = {
  getItem: (key) => { try { return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null; } catch { return null; } },
  setItem: (key, value) => { try { if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value); } catch {} },
  removeItem: (key) => { try { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key); } catch {} },
};
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storage: tabAuthStorage, storageKey: 'fooddash-auth-session-v15' } });
export const rp = n => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
export const toast = (m, t = 'ok') => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('toast', { detail: { m, t } }));
export const STATUS = { PENDING: 'Menunggu konfirmasi', PREPARING: 'Sedang disiapkan', READY_FOR_PICKUP: 'Menunggu driver', DRIVER_ASSIGNED: 'Driver menuju resto', ON_DELIVERY: 'Dalam pengantaran', DELIVERED: 'Selesai', CANCELLED: 'Dibatalkan' };
export const FLOW = ['PENDING', 'PREPARING', 'READY_FOR_PICKUP', 'DRIVER_ASSIGNED', 'ON_DELIVERY', 'DELIVERED'];
export const PAYLABEL = { COD: 'Bayar di tempat (COD)', CARD: 'Kartu debit / kredit', EWALLET: 'E-wallet' };
export const isActive = o => !['DELIVERED', 'CANCELLED'].includes(o.status);

export function useGuard(role) {
  const [me, setMe] = useState(null); const r = useRouter();
  const reload = useCallback(async () => {
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) { setMe(null); r.replace('/login'); return null; }
    const { data: p, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error || !p) { setMe(null); toast(error?.message || 'Profil akun belum tersedia', 'err'); r.replace('/login'); return null; }
    if (p.role !== role) { setMe(null); r.replace('/' + p.role); return null; }
    const current = { ...p, email: user.email };
    setMe(current);
    return current;
  }, [role, r]);
  useEffect(() => {
    let alive = true;
    reload();
    // Supabase menyimpan sesi di browser dan memperbarui token otomatis.
    // Perubahan sesi dipantau agar dashboard tidak meminta login ulang saat token diperbarui.
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === 'SIGNED_OUT' || !session) {
        setMe(null);
        r.replace('/login');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        Promise.resolve().then(() => alive && reload());
      }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [reload, r]);
  return { me, reload };
}
export function useOrders(me) {
  const [orders, set] = useState(null);
  const load = useCallback(async () => { const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }); error ? toast(error.message, 'err') : set(data) }, []);
  useEffect(() => { if (!me) return; load(); const ch = sb.channel('o' + Math.random()).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load).subscribe(); return () => { sb.removeChannel(ch) } }, [me, load]);
  const act = async (id, s, msg) => {
    const { error } = await sb.rpc('advance_order', { p_id: id, p_status: s });
    if (error) { toast(error.message, 'err'); await load(); return false; }
    if (msg) toast(msg);
    await load();
    return true;
  };
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

// ---------- lokasi, peta, estimasi ----------
export const hav = (a, b) => { const R = 6371, t = x => x * Math.PI / 180, dLa = t(b.lat - a.lat), dLn = t(b.lng - a.lng), h = Math.sin(dLa / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) };
export const hasPt = p => !!p && p.lat != null && p.lng != null && p.lat !== '' && p.lng !== '' && !isNaN(+p.lat) && !isNaN(+p.lng);
export const pt = (lat, lng) => ({ lat: +lat, lng: +lng });
export function getPos() {
  return new Promise((res, rej) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return rej(new Error('Browser tidak mendukung lokasi'));
    navigator.geolocation.getCurrentPosition(p => res(p.coords), e => rej(new Error(e.code === 1 ? 'Izin lokasi ditolak. Aktifkan izin lokasi di browser.' : 'Lokasi tidak bisa diambil, coba lagi')), { enableHighAccuracy: true, timeout: 15000 });
  });
}
export function useStore(me) {
  const [s, set] = useState(null);
  const load = useCallback(async () => { const { data } = await sb.from('store').select('*').eq('id', 1).maybeSingle(); set(data || {}) }, []);
  useEffect(() => { if (me) load() }, [me, load]);
  return [s, load];
}
export function useDriverLoc(orderId, on) {
  const [loc, set] = useState(null);
  useEffect(() => {
    if (!orderId || !on) { set(null); return } let live = true;
    const load = async () => { const { data } = await sb.from('driver_locations').select('*').eq('order_id', orderId).maybeSingle(); live && set(data) };
    load(); const t = setInterval(load, 5000);
    const ch = sb.channel('dl' + orderId + Math.random()).on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: 'order_id=eq.' + orderId }, p => live && p.new && p.new.lat != null && set(p.new)).subscribe();
    return () => { live = false; clearInterval(t); sb.removeChannel(ch) };
  }, [orderId, on]);
  return loc;
}
// Pesan terakhir + jumlah belum dibaca per pesanan, notifikasi pesan baru
export function useChatMeta(me, orders, openId) {
  const ids = (orders || []).filter(o => o.driver_id).map(o => o.id).sort().join(',');
  const [msgs, setMsgs] = useState([]); const [seen, setSeen] = useState({}); const open = useRef(openId); open.current = openId; const mref = useRef([]); mref.current = msgs;
  useEffect(() => { if (!me) return; try { setSeen(JSON.parse(localStorage.getItem('seen_' + me.id) || '{}')) } catch { } }, [me?.id]);
  useEffect(() => {
    if (!me || !ids) return; let live = true;
    const load = async () => { const { data } = await sb.from('messages').select('*').in('order_id', ids.split(',')).order('created_at', { ascending: false }).limit(300); live && data && setMsgs(data) };
    load(); const t = setInterval(load, 8000);
    const ch = sb.channel('cm' + me.id + Math.random()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => { const m = p.new; if (!live) return; setMsgs(a => a.some(x => x.id === m.id) ? a : [m, ...a]); if (m.sender_id !== me.id && open.current !== m.order_id) toast('💬 Pesan baru: ' + m.body.slice(0, 50)) }).subscribe();
    return () => { live = false; clearInterval(t); sb.removeChannel(ch) };
  }, [me?.id, ids]);
  const markSeen = useCallback((orderId, ts) => {
    const lm = mref.current.find(m => m.order_id === orderId); const t = ts || (lm ? lm.created_at : new Date().toISOString());
    setSeen(s => { if (s[orderId] && new Date(s[orderId]) >= new Date(t)) return s; const n = { ...s, [orderId]: t }; try { localStorage.setItem('seen_' + me.id, JSON.stringify(n)) } catch { } return n });
  }, [me?.id]);
  const last = {}, unread = {}; msgs.forEach(m => { if (!last[m.order_id]) last[m.order_id] = m; if (m.sender_id !== me?.id && new Date(m.created_at) > new Date(seen[m.order_id] || 0)) unread[m.order_id] = (unread[m.order_id] || 0) + 1 });
  return { last, unread, total: Object.values(unread).reduce((a, b) => a + b, 0), markSeen };
}
