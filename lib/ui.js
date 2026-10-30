'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb, toast, uploadImage, FLOW, STATUS } from './sb';

const P = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10', cart: 'M6 6h15l-1.5 9h-12z M6 6L5 2H2 M9 20.5a.5.5 0 1 0 .01 0 M18 20.5a.5.5 0 1 0 .01 0',
  orders: 'M14 2H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2V8z M14 2v6h6 M8 13h6 M8 17h4', chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 .01 0', search: 'M11 3a8 8 0 1 0 .01 0 M21 21l-4.3-4.3', pin: 'M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 .01 0',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', back: 'M15 18l-6-6 6-6', star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  clock: 'M12 3a9 9 0 1 0 .01 0 M12 7v5l3 2', check: 'M20 6L9 17l-5-5', send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z', logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 10a4 4 0 1 0 .01 0', trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  bike: 'M5 18a3 3 0 1 0 .01 0 M19 18a3 3 0 1 0 .01 0 M8 18h8l-3-9h-3 M13 9l2-4h3', chart: 'M4 20V10 M10 20V4 M16 20v-8 M22 20H2', box: 'M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
  tag: 'M20 12l-8 8-9-9V3h8z M7.5 7.5h.01', file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6', x: 'M18 6L6 18M6 6l12 12', download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  truck: 'M1 3h15v13H1z M16 8h4l3 3v5h-7z M5.5 19.5a1.5 1.5 0 1 0 .01 0 M18.5 19.5a1.5 1.5 0 1 0 .01 0', settings: 'M12 15a3 3 0 1 0 .01 0 M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  image: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z M8.5 10a1.5 1.5 0 1 0 .01 0 M21 15l-5-5L5 21',
};
export const Icon = ({ n, s = 20, fill }) => <svg width={s} height={s} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={P[n]} /></svg>;

export function Toaster() {
  const [t, setT] = useState(null);
  useEffect(() => { let id; const f = e => { setT({ ...e.detail, k: Math.random() }); clearTimeout(id); id = setTimeout(() => setT(null), 3200) }; window.addEventListener('toast', f); return () => { window.removeEventListener('toast', f); clearTimeout(id) } }, []);
  return t ? <div key={t.k} className={'toast ' + (t.t === 'err' ? 'err' : '')} role="status">{t.m}</div> : null;
}
// efek riak (ripple) di semua tombol
export function Ripple() {
  useEffect(() => {
    const f = e => { const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return; const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) / 2, el = document.createElement('span'); el.className = 'rip'; el.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`; b.appendChild(el); setTimeout(() => el.remove(), 650) };
    document.addEventListener('pointerdown', f); return () => document.removeEventListener('pointerdown', f);
  }, []); return null;
}
export const Avatar = ({ p, s = 44 }) => <div className="av" style={{ width: s, height: s, fontSize: s / 2.6 }}>{p?.avatar_url ? <img src={p.avatar_url} alt="" /> : (p?.name || '?').slice(0, 1).toUpperCase()}</div>;
export const Empty = ({ icon = 'box', t }) => <div className="empty"><Icon n={icon} s={44} /><p style={{ marginTop: 8 }}>{t}</p></div>;
export function Sheet({ onClose, children, full, wide }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [onClose]);
  return <div className="ov" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className={'sheet ' + (full ? 'full ' : '') + (wide ? 'wide' : '')}>{children}</div></div>;
}
export function BottomNav({ items, tab, set, badges = {} }) {
  return <nav className="nav">{items.map(([k, l, ic]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => set(k)}><Icon n={ic} />{l}{badges[k] > 0 && <span className="badge">{badges[k]}</span>}</button>)}</nav>;
}
// Pelacak status seperti di mockup (centang oranye)
export function Steps({ status }) {
  const cancelled = status === 'CANCELLED'; const idx = FLOW.indexOf(status);
  if (cancelled) return <p className="tag bad">Pesanan dibatalkan</p>;
  const L = { PENDING: 'Pesanan dibuat', PREPARING: 'Dikonfirmasi & disiapkan', READY_FOR_PICKUP: 'Siap, menunggu driver', DRIVER_ASSIGNED: 'Driver mengambil pesanan', ON_DELIVERY: 'Dalam perjalanan', DELIVERED: 'Pesanan diterima' };
  return <div>{FLOW.map((s, i) => <div key={s} className={'step ' + (i <= idx ? 'done ' : '') + (i === idx && s !== 'DELIVERED' ? 'now' : '')}><span className="ck">{i <= idx && <Icon n="check" s={14} />}</span><b style={{ fontWeight: i <= idx ? 600 : 400 }}>{L[s]}</b></div>)}</div>;
}
// Peta ilustrasi dengan rute animasi
export function RouteMap({ status }) {
  const p = Math.max(0, FLOW.indexOf(status)) / 5; const pts = [[40, 170], [40, 110], [130, 110], [130, 50], [250, 50]];
  return <div className="map"><svg viewBox="0 0 300 210" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><rect width="300" height="210" fill="#EFEAE6" />
    {[30, 80, 130, 180].map(y => <rect key={y} x="0" y={y} width="300" height="9" fill="#fff" />)}{[20, 90, 170, 240].map(x => <rect key={x} x={x} y="0" width="9" height="210" fill="#fff" />)}
    <polyline className="route" points={pts.map(a => a.join(',')).join(' ')} fill="none" stroke="#F26A1F" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="250" cy="50" r="9" fill="#fff" stroke="#F26A1F" strokeWidth="4" /><g className="bike" style={{ transition: 'all 1s' }} transform={`translate(${40 + p * 190 - 12},${170 - p * 110 - 12})`}><circle cx="12" cy="12" r="14" fill="#F26A1F" /><g transform="translate(0 0)" stroke="#fff" strokeWidth="1.8" fill="none"><circle cx="7" cy="16" r="2.4" /><circle cx="17" cy="16" r="2.4" /><path d="M7 16h6l-2-6H9 M13 10l1.5-3H17" /></g></g></svg></div>;
}
export function Chat({ order, me, peer, onClose }) {
  const [msgs, setMsgs] = useState([]); const [t, setT] = useState(''); const end = useRef();
  useEffect(() => {
    let on = true; sb.from('messages').select('*').eq('order_id', order.id).order('created_at').then(({ data }) => on && setMsgs(data || []));
    const ch = sb.channel('m' + order.id + Math.random()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'order_id=eq.' + order.id }, p => setMsgs(m => m.some(x => x.id === p.new.id) ? m : [...m, p.new])).subscribe();
    return () => { on = false; sb.removeChannel(ch) };
  }, [order.id]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs]);
  const send = async () => {
    const body = t.trim(); if (!body) return; setT('');
    const { data, error } = await sb.from('messages').insert({ order_id: order.id, sender_id: me.id, body }).select().single();
    if (error) { setT(body); return toast(error.message, 'err') } setMsgs(m => m.some(x => x.id === data.id) ? m : [...m, data]);
  };
  return <Sheet full onClose={onClose}><div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 42px)' }}>
    <div className="row" style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)' }}><button className="icon" onClick={onClose}><Icon n="back" /></button><Avatar p={peer} /><div className="grow"><b>{peer?.name || 'Pengguna'}</b><br /><small>Pesanan #{order.id.slice(0, 6)} · {STATUS[order.status]}</small></div>
      {peer?.phone && <a href={'https://wa.me/' + peer.phone.replace(/\D/g, '').replace(/^0/, '62')} target="_blank" rel="noreferrer"><button className="icon" style={{ background: '#e6f7ee', color: 'var(--ok)' }}><Icon n="phone" /></button></a>}</div>
    <div className="chatbox">{msgs.length === 0 && <Empty icon="chat" t="Belum ada pesan. Mulai percakapan!" />}
      {msgs.map(m => <div key={m.id} className={'msg ' + (m.sender_id === me.id ? 'me' : '')}>{m.body}<small>{new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</small></div>)}<div ref={end} /></div>
    <div className="row"><input placeholder="Tulis pesan..." value={t} onChange={e => setT(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} style={{ margin: 0 }} /><button className="icon" style={{ background: 'var(--o)', color: '#fff' }} onClick={send}><Icon n="send" /></button></div>
  </div></Sheet>;
}
// Profil: foto, nama, no WA, alamat, ganti password, logout (dipakai 3 role)
export function ProfileView({ me, reload, address }) {
  const r = useRouter(); const [f, setF] = useState({ name: me.name || '', phone: me.phone || '', address: me.address || '' }); const [pw, setPw] = useState({ a: '', b: '' }); const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => { if (!f.name.trim()) return toast('Nama wajib diisi', 'err'); setBusy(true); const { error } = await sb.from('profiles').update({ name: f.name.trim(), phone: f.phone.trim(), address: f.address.trim() }).eq('id', me.id); setBusy(false); error ? toast(error.message, 'err') : (toast('Profil disimpan'), reload()) };
  const photo = async e => { const url = await uploadImage(e.target.files[0], 'avatars/' + me.id); if (!url) return; const { error } = await sb.from('profiles').update({ avatar_url: url }).eq('id', me.id); error ? toast(error.message, 'err') : (toast('Foto diperbarui'), reload()) };
  const chpw = async () => { if (pw.a.length < 6) return toast('Password minimal 6 karakter', 'err'); if (pw.a !== pw.b) return toast('Konfirmasi password tidak sama', 'err'); const { error } = await sb.auth.updateUser({ password: pw.a }); error ? toast(error.message, 'err') : (toast('Password berhasil diganti'), setPw({ a: '', b: '' })) };
  return <div className="view">
    <div className="c mt"><label style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}><Avatar p={me} s={96} /><span className="icon" style={{ position: 'absolute', right: -4, bottom: -4, width: 32, height: 32, borderRadius: '50%', background: 'var(--o)', color: '#fff', display: 'grid', placeItems: 'center' }}><Icon n="camera" s={16} /></span><input type="file" accept="image/*" hidden onChange={photo} /></label><h3 style={{ marginTop: 10 }}>{me.name}</h3><small>{me.email} · {me.role}</small></div>
    <div className="card"><b>Data diri</b><label>Nama</label><input value={f.name} onChange={set('name')} /><label>No. WhatsApp</label><input type="tel" placeholder="08xxxxxxxxxx" value={f.phone} onChange={set('phone')} />{address && <><label>Alamat utama</label><input value={f.address} onChange={set('address')} /></>}<button className="full mt" disabled={busy} onClick={save}>Simpan perubahan</button></div>
    <div className="card"><b>Ganti password</b><input type="password" placeholder="Password baru" value={pw.a} onChange={e => setPw({ ...pw, a: e.target.value })} /><input type="password" placeholder="Ulangi password baru" value={pw.b} onChange={e => setPw({ ...pw, b: e.target.value })} /><button className="ghost full mt" onClick={chpw}>Ganti password</button></div>
    <button className="x full" onClick={async () => { await sb.auth.signOut(); r.replace('/login') }}><span className="row" style={{ justifyContent: 'center' }}><Icon n="logout" s={18} />Keluar</span></button></div>;
}
