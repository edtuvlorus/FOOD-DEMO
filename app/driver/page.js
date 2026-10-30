'use client';
import { useEffect, useState } from 'react';
import { sb, rp, toast, STATUS, PAYLABEL, isActive, getPos, hasPt, useGuard, useOrders, useProfiles, useChatMeta } from '../../lib/sb';
import { Icon, Avatar, Chat, ProfileView, Empty, BottomNav, Steps, Sheet } from '../../lib/ui';

const NEXT = { DRIVER_ASSIGNED: ['ON_DELIVERY', 'Mulai antar', 'Pesanan diantar, lokasimu dibagikan ke customer'], ON_DELIVERY: ['DELIVERED', 'Selesai diantar', 'Pesanan selesai. Terima kasih!'] };

export default function Driver() {
  const { me, reload } = useGuard('driver'); const { orders, act } = useOrders(me);
  const [tab, setTab] = useState('offers'); const [chat, setChat] = useState(null); const [det, setDet] = useState(null); const [oh, setOh] = useState('active'); const [share, setShare] = useState(true);
  const pf = useProfiles((orders || []).map(o => o.customer_id));
  const mine = (orders || []).filter(o => me && o.driver_id === me.id); const cm = useChatMeta(me, mine, chat?.id);
  const live = mine.filter(o => ['DRIVER_ASSIGNED', 'ON_DELIVERY'].includes(o.status)); const liveKey = live.map(o => o.id + o.status).join(',');
  // Kirim lokasi driver ke customer selama pesanan berjalan
  useEffect(() => {
    if (!me || !share || !liveKey || typeof navigator === 'undefined' || !navigator.geolocation) return; let last = 0;
    const wid = navigator.geolocation.watchPosition(p => {
      const n = Date.now(); if (n - last < 3000) return; last = n;
      live.forEach(o => sb.rpc('update_driver_location', { p_order: o.id, p_lat: p.coords.latitude, p_lng: p.coords.longitude, p_speed: p.coords.speed != null ? p.coords.speed * 3.6 : null }).then(({ error }) => error && console.warn(error.message)));
    }, e => toast(e.code === 1 ? 'Izin lokasi ditolak. Aktifkan lokasi agar customer bisa melacakmu.' : 'Lokasi tidak tersedia', 'err'), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(wid);
  }, [me?.id, share, liveKey]);
  if (!me) return <div className="phone"><div className="skel mt" /></div>;
  const go = async (o, s, msg) => { if (share) { try { await getPos() } catch (e) { toast(e.message, 'err') } } act(o.id, s, msg) };
  const offers = (orders || []).filter(o => o.status === 'READY_FOR_PICKUP' && !o.driver_id);
  const shown = mine.filter(o => oh === 'active' ? isActive(o) : !isActive(o)); const earn = mine.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + Number(o.delivery_fee), 0);
  const nav = [['offers', 'Order masuk', 'bike'], ['mine', 'Pesanan', 'orders'], ['chat', 'Pesan', 'chat'], ['profile', 'Profil', 'user']];
  const card = (o, offer) => { const c = pf[o.customer_id]; return <div className="card hov" key={o.id}>
    <div className="row sp"><b>#{o.id.slice(0, 6)}</b><span className={'tag ' + (o.status === 'DELIVERED' ? 'ok' : o.status === 'CANCELLED' ? 'bad' : '')}>{STATUS[o.status]}</span></div>
    {!offer && c && <div className="row mt"><Avatar p={c} s={34} /><div className="grow"><b>{c.name}</b><br /><small>{c.phone || 'Customer'}</small></div></div>}
    <small style={{ display: 'block', marginTop: 8 }}>{o.items.map(i => i.qty + '× ' + i.name).join(', ')}</small>
    <div className="row mt"><Icon n="pin" s={15} /><small>{o.address} · {o.distance_km} km</small></div>
    <div className="row sp mt"><span>Ongkir <b className="o">{rp(o.delivery_fee)}</b></span><small>{PAYLABEL[o.payment_method]} · {rp(o.total)}</small></div>
    <div className="row wrap mt">
      {offer && <button className="grow" onClick={() => go(o, 'DRIVER_ASSIGNED', 'Pesanan kamu! Segera menuju toko')}>Ambil order</button>}
      {!offer && NEXT[o.status] && <button className="grow" onClick={() => go(o, NEXT[o.status][0], NEXT[o.status][2])}>{NEXT[o.status][1]}</button>}
      {!offer && <button className="ghost" onClick={() => setChat(o)}><span className="row"><Icon n="chat" s={16} />Chat customer{cm.unread[o.id] > 0 ? ` (${cm.unread[o.id]})` : ''}</span></button>}
      {!offer && <button className="soft" onClick={() => setDet(o)}>Detail</button>}</div></div> };
  return <div className="phone">
    {tab === 'offers' && <div className="view"><div className="top"><h2>Order masuk</h2></div>
      <div className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}><div className="stat hl"><small>Pendapatan ongkir</small><b>{rp(earn)}</b></div><div className="stat"><small>Siap diambil</small><b>{offers.length}</b></div></div>
      <p className="mt"><small>Siapa cepat dia dapat. Order hilang otomatis jika sudah diambil driver lain.</small></p>
      {!orders ? <div className="skel mt" /> : offers.length === 0 ? <Empty icon="bike" t="Belum ada order siap diambil" /> : offers.map(o => card(o, true))}</div>}
    {tab === 'mine' && <div className="view"><div className="top"><h2>Pesanan saya</h2></div>
      {live.length > 0 && <div className="card row sp" style={{ background: share ? '#e6f7ee' : 'var(--soft)' }}><div><b>{share ? 'Lokasi dibagikan ke customer' : 'Lokasi dimatikan'}</b><br /><small>{share ? 'Customer melihat motormu bergerak & estimasi tiba' : 'Customer tidak bisa melacakmu'}</small></div><button className={'sm ' + (share ? 'ghost' : '')} onClick={() => setShare(!share)}>{share ? 'Matikan' : 'Aktifkan'}</button></div>}
      <div className="row"><button className={'sm ' + (oh === 'active' ? '' : 'ghost')} onClick={() => setOh('active')}>Aktif</button><button className={'sm ' + (oh === 'hist' ? '' : 'ghost')} onClick={() => setOh('hist')}>Riwayat</button></div>
      {shown.length === 0 ? <Empty icon="orders" t="Belum ada pesanan" /> : shown.map(o => card(o, false))}</div>}
    {tab === 'chat' && <div className="view"><div className="top"><h2>Pesan</h2></div>
      {mine.length === 0 ? <Empty icon="chat" t="Ambil order untuk mulai chat dengan customer" /> : mine.map(o => <div className="card hov row" key={o.id} style={{ cursor: 'pointer' }} onClick={() => setChat(o)}><Avatar p={pf[o.customer_id]} /><div className="grow"><b>{pf[o.customer_id]?.name || 'Customer'}</b><br /><small className="prev" style={{ color: cm.unread[o.id] ? 'var(--ink)' : undefined, fontWeight: cm.unread[o.id] ? 600 : 400 }}>{cm.last[o.id] ? (cm.last[o.id].sender_id === me.id ? 'Kamu: ' : '') + cm.last[o.id].body : 'Pesanan #' + o.id.slice(0, 6) + ' · ' + STATUS[o.status]}</small></div>{cm.unread[o.id] > 0 ? <span className="tag">{cm.unread[o.id]}</span> : <Icon n="chat" />}</div>)}</div>}
    {tab === 'profile' && <ProfileView me={me} reload={reload} />}
    <BottomNav items={nav} tab={tab} set={setTab} badges={{ offers: offers.length, chat: cm.total }} />
    {chat && <Chat order={chat} me={me} peer={pf[chat.customer_id]} onClose={() => setChat(null)} onRead={cm.markSeen} />}
    {det && <Sheet onClose={() => setDet(null)}><h3>Pesanan #{det.id.slice(0, 6)}</h3><Steps status={orders?.find(x => x.id === det.id)?.status || det.status} /><small style={{ display: 'block', margin: '8px 0' }}>{det.address}</small>
      <a href={hasPt({ lat: det.dest_lat, lng: det.dest_lng }) ? `https://www.google.com/maps/dir/?api=1&destination=${det.dest_lat},${det.dest_lng}&travelmode=motorcycle` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(det.address)}`} target="_blank" rel="noreferrer"><button className="full">Buka navigasi di Google Maps</button></a></Sheet>}
  </div>;
}
