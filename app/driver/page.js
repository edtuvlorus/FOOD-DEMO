'use client';
import { useState } from 'react';
import { rp, STATUS, PAYLABEL, isActive, useGuard, useOrders, useProfiles } from '../../lib/sb';
import { Icon, Avatar, Chat, ProfileView, Empty, BottomNav, Steps, Sheet } from '../../lib/ui';

const NEXT = { DRIVER_ASSIGNED: ['ON_DELIVERY', 'Mulai antar', 'Pesanan diantar, status diperbarui'], ON_DELIVERY: ['DELIVERED', 'Selesai diantar', 'Pesanan selesai. Terima kasih!'] };

export default function Driver() {
  const { me, reload } = useGuard('driver'); const { orders, act } = useOrders(me);
  const [tab, setTab] = useState('offers'); const [chat, setChat] = useState(null); const [det, setDet] = useState(null); const [oh, setOh] = useState('active');
  const pf = useProfiles((orders || []).map(o => o.customer_id));
  if (!me) return <div className="phone"><div className="skel mt" /></div>;
  const offers = (orders || []).filter(o => o.status === 'READY_FOR_PICKUP' && !o.driver_id), mine = (orders || []).filter(o => o.driver_id === me.id);
  const shown = mine.filter(o => oh === 'active' ? isActive(o) : !isActive(o)); const earn = mine.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + Number(o.delivery_fee), 0);
  const nav = [['offers', 'Order masuk', 'bike'], ['mine', 'Pesanan', 'orders'], ['chat', 'Pesan', 'chat'], ['profile', 'Profil', 'user']];
  const Card = ({ o, offer }) => { const c = pf[o.customer_id]; return <div className="card hov">
    <div className="row sp"><b>#{o.id.slice(0, 6)}</b><span className={'tag ' + (o.status === 'DELIVERED' ? 'ok' : o.status === 'CANCELLED' ? 'bad' : '')}>{STATUS[o.status]}</span></div>
    {!offer && c && <div className="row mt"><Avatar p={c} s={34} /><div className="grow"><b>{c.name}</b><br /><small>{c.phone || 'Customer'}</small></div></div>}
    <small style={{ display: 'block', marginTop: 8 }}>{o.items.map(i => i.qty + '× ' + i.name).join(', ')}</small>
    <div className="row mt"><Icon n="pin" s={15} /><small>{o.address} · {o.distance_km} km</small></div>
    <div className="row sp mt"><span>Ongkir <b className="o">{rp(o.delivery_fee)}</b></span><small>{PAYLABEL[o.payment_method]} · {rp(o.total)}</small></div>
    <div className="row wrap mt">
      {offer && <button className="grow" onClick={() => act(o.id, 'DRIVER_ASSIGNED', 'Pesanan kamu! Segera menuju resto')}>Ambil order</button>}
      {!offer && NEXT[o.status] && <button className="grow" onClick={() => act(o.id, NEXT[o.status][0], NEXT[o.status][2])}>{NEXT[o.status][1]}</button>}
      {!offer && <button className="ghost" onClick={() => setChat(o)}><span className="row"><Icon n="chat" s={16} />Chat customer</span></button>}
      {!offer && <button className="soft" onClick={() => setDet(o)}>Detail</button>}</div></div> };
  return <div className="phone">
    {tab === 'offers' && <div className="view"><div className="top"><h2>Order masuk</h2></div>
      <div className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}><div className="stat hl"><small>Pendapatan ongkir</small><b>{rp(earn)}</b></div><div className="stat"><small>Siap diambil</small><b>{offers.length}</b></div></div>
      <p className="mt"><small>Siapa cepat dia dapat. Order hilang otomatis jika sudah diambil driver lain.</small></p>
      {!orders ? <div className="skel mt" /> : offers.length === 0 ? <Empty icon="bike" t="Belum ada order siap diambil" /> : offers.map(o => <Card key={o.id} o={o} offer />)}</div>}
    {tab === 'mine' && <div className="view"><div className="top"><h2>Pesanan saya</h2></div>
      <div className="row"><button className={'sm ' + (oh === 'active' ? '' : 'ghost')} onClick={() => setOh('active')}>Aktif</button><button className={'sm ' + (oh === 'hist' ? '' : 'ghost')} onClick={() => setOh('hist')}>Riwayat</button></div>
      {shown.length === 0 ? <Empty icon="orders" t="Belum ada pesanan" /> : shown.map(o => <Card key={o.id} o={o} />)}</div>}
    {tab === 'chat' && <div className="view"><div className="top"><h2>Pesan</h2></div>
      {mine.length === 0 ? <Empty icon="chat" t="Ambil order untuk mulai chat dengan customer" /> : mine.map(o => <div className="card hov row" key={o.id} style={{ cursor: 'pointer' }} onClick={() => setChat(o)}><Avatar p={pf[o.customer_id]} /><div className="grow"><b>{pf[o.customer_id]?.name || 'Customer'}</b><br /><small>Pesanan #{o.id.slice(0, 6)} · {STATUS[o.status]}</small></div><Icon n="chat" /></div>)}</div>}
    {tab === 'profile' && <ProfileView me={me} reload={reload} />}
    <BottomNav items={nav} tab={tab} set={setTab} badges={{ offers: offers.length }} />
    {chat && <Chat order={chat} me={me} peer={pf[chat.customer_id]} onClose={() => setChat(null)} />}
    {det && <Sheet onClose={() => setDet(null)}><h3>Pesanan #{det.id.slice(0, 6)}</h3><Steps status={orders?.find(x => x.id === det.id)?.status || det.status} /><small>{det.address}</small></Sheet>}
  </div>;
}
