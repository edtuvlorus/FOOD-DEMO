'use client';
import { useEffect, useMemo, useState } from 'react';
import { sb, rp, toast, uploadImage, STATUS, PAYLABEL, isActive, hav, hasPt, pt, getPos, useGuard, useOrders, useList, useSettings, useProfiles, useStore, useDriverLoc, useChatMeta } from '../../lib/sb';
import { Icon, Avatar, Sheet, Steps, LiveMap, Chat, ProfileView, Empty, BottomNav } from '../../lib/ui';

const DEFAULT_BANNER = [{ id: 'd', title: 'Klaim diskon 30% hari ini!', subtitle: 'Burger, combo, dan minuman favoritmu', image_url: null }];

function Carousel({ items, onCta }) {
  const [i, setI] = useState(0); const n = items.length;
  useEffect(() => { if (n < 2) return; const t = setInterval(() => setI(x => (x + 1) % n), 4200); return () => clearInterval(t) }, [n]);
  return <><div className="car"><div className="car-in" style={{ transform: `translateX(-${i * 100}%)` }}>
    {items.map(b => <div className="slide" key={b.id}><div style={{ zIndex: 1 }}><h3>{b.title}</h3><p>{b.subtitle}</p><button onClick={onCta}>Pesan sekarang</button></div>{b.image_url && <img src={b.image_url} alt="" />}{!b.image_url && <span style={{ position: 'absolute', right: 14, fontSize: 74 }}>🍔</span>}</div>)}</div></div>
    <div className="dots">{items.map((b, k) => <i key={b.id} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div></>;
}
const Thumb = ({ m }) => <div className="pimg">{m.image_url ? <img src={m.image_url} alt={m.name} /> : (m.emoji || '🍔')}</div>;

export default function Customer() {
  const { me, reload } = useGuard('customer'); const { orders, act, load } = useOrders(me);
  const [menu] = useList('menu_items', 'name', me); const [cats] = useList('categories', 'sort', me); const [banners] = useList('banners', 'sort', me); const [payments] = useList('payment_methods', 'sort', me); const [st] = useSettings(me); const [store] = useStore(me);
  const [tab, setTab] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('fooddash_customer_tab') || 'home' : 'home'); const [cat, setCat] = useState('all'); const [q, setQ] = useState(''); const [cart, setCart] = useState({});
  const [pick, setPick] = useState(null); const [pq, setPq] = useState(1); const [trackId, setTrackId] = useState(null); const [chat, setChat] = useState(null);
  const [pay, setPay] = useState('COD'); const [proof, setProof] = useState(null); const [proofPreview, setProofPreview] = useState(''); const [uploadingProof, setUploadingProof] = useState(false); const [addr, setAddr] = useState(''); const [km, setKm] = useState(3); const [busy, setBusy] = useState(false); const [ot, setOt] = useState('active'); const [loc, setLoc] = useState(null);
  const [saved, loadSaved] = useList('addresses', 'created_at', me); const [selAddr, setSelAddr] = useState(null); const [lbl, setLbl] = useState(''); const [savingAddr, setSavingAddr] = useState(false);
  useEffect(() => { if (me && !addr) setAddr(me.address || '') }, [me]);
  useEffect(() => { if (saved && saved.length && !selAddr) { const d = saved.find(a => a.is_default) || saved[0]; pickAddr(d) } }, [saved]);
  const pf = useProfiles((orders || []).map(o => o.driver_id)); const cm = useChatMeta(me, orders, chat?.id);
  const track = orders?.find(o => o.id === trackId); const dl = useDriverLoc(track?.id, !!track && ['DRIVER_ASSIGNED', 'ON_DELIVERY', 'DELIVERED'].includes(track.status));
  const list = useMemo(() => (menu || []).filter(m => m.available && (cat === 'all' || m.category_id === cat) && m.name.toLowerCase().includes(q.toLowerCase())), [menu, cat, q]);
  useEffect(() => { try { localStorage.setItem('fooddash_customer_tab', tab) } catch {} }, [tab]);
  if (!me) return <div className="phone"><div className="skel mt" /><div className="skel mt" /></div>;

  const items = (menu || []).filter(m => cart[m.id]); const sub = items.reduce((s, m) => s + m.price * cart[m.id], 0); const count = items.reduce((s, m) => s + cart[m.id], 0);
  const ship = st.ship_base + st.ship_per_km * km; const total = sub + ship + st.service_fee;
  const add = (m, n = 1) => { setCart(c => ({ ...c, [m.id]: Math.max(0, Math.min((c[m.id] || 0) + n, m.stock, 20)) })); if (n > 0) toast(m.name + ' masuk keranjang') };
  function pickAddr(a) {
    setSelAddr(a.id); setAddr(a.address); setLoc(hasPt(a) ? pt(a.lat, a.lng) : null);
    if (a.distance_km) setKm(+a.distance_km); else if (hasPt(a) && hasPt(store)) setKm(Math.min(50, Math.max(1, Math.round(hav(pt(a.lat, a.lng), pt(store.lat, store.lng)) * 1.25 * 10) / 10)));
  }
  const saveAddr = async () => {
    if (!addr.trim()) return toast('Isi alamat dulu', 'err'); if (!lbl.trim()) return toast('Beri nama alamat (mis. Rumah, Kantor)', 'err'); setSavingAddr(true);
    const { data, error } = await sb.from('addresses').insert({ user_id: me.id, label: lbl.trim(), address: addr.trim(), lat: loc ? loc.lat : null, lng: loc ? loc.lng : null, distance_km: km, is_default: !(saved || []).length }).select().single(); setSavingAddr(false);
    if (error) return toast(error.message, 'err'); toast('Alamat disimpan'); setLbl(''); setSelAddr(data.id); loadSaved();
  };
  const delAddr = async id => { const { error } = await sb.from('addresses').delete().eq('id', id); if (error) return toast(error.message, 'err'); if (selAddr === id) setSelAddr(null); toast('Alamat dihapus'); loadSaved() };
  const defAddr = async id => { await sb.from('addresses').update({ is_default: false }).eq('user_id', me.id); const { error } = await sb.from('addresses').update({ is_default: true }).eq('id', id); error ? toast(error.message, 'err') : (toast('Dijadikan alamat utama'), loadSaved()) };
  const detectLoc = async () => {
    try { const c = await getPos(); const me_ = pt(c.latitude, c.longitude); setLoc(me_);
      if (hasPt(store)) { const d = Math.min(50, Math.max(1, Math.round(hav(me_, pt(store.lat, store.lng)) * 1.25 * 10) / 10)); setKm(d); toast('Lokasi terdeteksi · jarak ±' + d + ' km dari toko') } else toast('Lokasi terdeteksi') }
    catch (e) { toast(e.message, 'err') }
  };
  const shareDest = async () => {
    try { const c = await getPos(); const { error } = await sb.rpc('set_order_dest', { p_order: track.id, p_lat: c.latitude, p_lng: c.longitude }); error ? toast(error.message, 'err') : (toast('Lokasi tujuan disimpan'), load()) }
    catch (e) { toast(e.message, 'err') }
  };
  const order = async () => {
    if (!addr.trim()) return toast('Isi alamat pengiriman', 'err');
    const requiresProof = pay !== 'COD';
    if (requiresProof && !proof) return toast('Upload bukti pembayaran sebelum memesan', 'err');
    setBusy(true); let proofUrl = null;
    // COD tidak pernah mengunggah atau mengirim bukti pembayaran.
    if (requiresProof) { setUploadingProof(true); proofUrl = await uploadImage(proof, `payment-proofs/${me.id}`); setUploadingProof(false); if (!proofUrl) { setBusy(false); return; } }
    const { error } = await sb.rpc('place_order', { p_items: items.map(m => ({ id: m.id, qty: cart[m.id] })), p_address: addr.trim(), p_distance: km, p_payment: pay, p_proof: requiresProof ? proofUrl : null, p_lat: loc ? loc.lat : null, p_lng: loc ? loc.lng : null }); setBusy(false);
    if (error) return toast(error.message, 'err'); setCart({}); toast('Pesanan dibuat! Menunggu konfirmasi admin'); setTab('orders'); setOt('active'); load();
  };
  const shown = (orders || []).filter(o => ot === 'active' ? isActive(o) : !isActive(o));
  const withDriver = (orders || []).filter(o => o.driver_id);
  const nav = [['home', 'Beranda', 'home'], ['cart', 'Keranjang', 'cart'], ['orders', 'Pesanan', 'orders'], ['chat', 'Pesan', 'chat'], ['profile', 'Profil', 'user']];

  return <div className="phone">
    {tab === 'home' && <div className="view">
      <div className="top"><Avatar p={me} s={38} /><div className="grow"><small>Halo,</small><br /><b>{me.name}</b></div><button className="icon" onClick={() => setTab('cart')}><Icon n="cart" /></button></div>
      <div className="search"><Icon n="search" /><input placeholder="Cari menu atau restoran" value={q} onChange={e => setQ(e.target.value)} /></div>
      <Carousel items={banners?.filter(b => b.active).length ? banners.filter(b => b.active) : DEFAULT_BANNER} onCta={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })} />
      <div className="chips" id="menu"><button className={'chip ' + (cat === 'all' ? 'on' : '')} onClick={() => setCat('all')}>Semua</button>{(cats || []).map(c => <button key={c.id} className={'chip ' + (cat === c.id ? 'on' : '')} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
      {!menu ? <div className="grid"><div className="skel" /><div className="skel" /></div> : list.length === 0 ? <Empty t="Menu tidak ditemukan" /> :
        <div className="grid" key={cat + q}>{list.map((m, i) => <div className="prod" key={m.id} style={{ animationDelay: i * 50 + 'ms' }} onClick={() => { setPick(m); setPq(1) }}>
          <Thumb m={m} /><div className="r"><Icon n="star" s={12} fill />{m.rating}</div><h4>{m.name}</h4><p>{m.description}</p><b className="o">{rp(m.price)}</b>
          <button className="round add" onClick={e => { e.stopPropagation(); add(m) }} disabled={m.stock < 1}><Icon n="plus" s={16} /></button>{m.stock < 1 && <div className="soldout">Habis</div>}</div>)}</div>}
    </div>}

    {tab === 'cart' && <div className="view"><div className="top"><h2>Keranjang ({count})</h2></div>
      {items.length === 0 ? <Empty icon="cart" t="Keranjang masih kosong" /> : <>
        {items.map(m => <div className="card row" key={m.id}><div className="thumb">{m.image_url ? <img src={m.image_url} alt="" /> : (m.emoji || '🍔')}</div><div className="grow"><b>{m.name}</b><br /><span className="o b">{rp(m.price * cart[m.id])}</span></div>
          <div className="qty"><button className="round soft" onClick={() => add(m, -1)}><Icon n="minus" s={14} /></button><b>{cart[m.id]}</b><button className="round" onClick={() => add(m, 1)}><Icon n="plus" s={14} /></button></div></div>)}
        <div className="card"><label>Alamat pengiriman</label>
          {saved && saved.length > 0 && <div className="chips">{saved.map(a => <button key={a.id} className={'chip ' + (selAddr === a.id ? 'on' : '')} onClick={() => pickAddr(a)}>{a.is_default ? '★ ' : ''}{a.label}</button>)}</div>}
          {selAddr && saved?.find(a => a.id === selAddr) && <div className="row wrap" style={{ marginBottom: 6 }}>{!saved.find(a => a.id === selAddr).is_default && <button className="ghost sm" onClick={() => defAddr(selAddr)}>Jadikan utama</button>}<button className="ghost sm x" onClick={() => delAddr(selAddr)}>Hapus alamat ini</button></div>}
          <input placeholder="Jalan, nomor rumah, patokan" value={addr} onChange={e => { setAddr(e.target.value); setSelAddr(null) }} /><button className="soft sm" onClick={detectLoc}><span className="row"><Icon n="pin" s={14} />{loc ? 'Lokasi terdeteksi ✓ (perbarui)' : 'Gunakan lokasi saya'}</span></button>
          {!selAddr && addr.trim() && <div className="row mt"><input className="grow" placeholder="Nama alamat (Rumah, Kantor…)" maxLength={40} value={lbl} onChange={e => setLbl(e.target.value)} /><button className="sm" disabled={savingAddr} onClick={saveAddr}>Simpan alamat</button></div>}
          <label>Perkiraan jarak: <b className="o">{km} km</b></label><input type="range" min="1" max="50" step="0.5" value={km} onChange={e => setKm(+e.target.value)} style={{ padding: 0, accentColor: '#F26A1F' }} /></div>
        <div className="card"><div className="line"><span>Subtotal</span><b>{rp(sub)}</b></div><div className="line"><span>Ongkir ({km} km)</span><b>{rp(ship)}</b></div><div className="line"><span>Biaya layanan</span><b>{rp(st.service_fee)}</b></div><div className="line t"><span>Total</span><span className="o">{rp(total)}</span></div></div>
        <b>Metode pembayaran</b>
        <div className={'pay '+(pay==='COD'?'on':'')} onClick={()=>{setPay('COD');setProof(null);setProofPreview('')}}><b>Bayar di tempat (COD)</b><span className="dot"/></div>
        {(payments||[]).filter(p=>p.active).map(p=><div key={p.id} className={'pay '+(pay===p.id?'on':'')} onClick={()=>setPay(p.id)}><div className="grow"><b>{p.name}</b><br/><small>{p.category} · {p.account_name} {p.account_number}</small></div>{p.image_url&&<img src={p.image_url} alt={p.name} style={{width:48,height:48,objectFit:'contain'}}/>}<span className="dot"/></div>)}
        {pay!=='COD' && <div className="card"><b>Bukti pembayaran wajib</b><p><small>Upload screenshot/foto bukti transfer sebelum menekan tombol pesan.</small></p>{proofPreview&&<img src={proofPreview} alt="Preview bukti pembayaran" style={{width:'100%',maxHeight:220,objectFit:'contain',borderRadius:12,marginBottom:8}}/>}<label className="sm soft" style={{display:'inline-block',cursor:'pointer'}}>Pilih foto bukti pembayaran<input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f){setProof(f);setProofPreview(URL.createObjectURL(f))}}}/></label>{proof&&<small style={{display:'block',marginTop:6}}>{proof.name}</small>}</div>}
        <button className="full mt" disabled={busy||uploadingProof} onClick={order}>{busy?'Memproses...':'Pesan sekarang · '+rp(total)}</button></>}</div>}

    {tab === 'orders' && <div className="view"><div className="top"><h2>Pesanan Saya</h2></div>
      <div className="row" style={{ marginBottom: 8 }}><button className={'sm ' + (ot === 'active' ? '' : 'ghost')} onClick={() => setOt('active')}>Aktif</button><button className={'sm ' + (ot === 'hist' ? '' : 'ghost')} onClick={() => setOt('hist')}>Riwayat</button></div>
      {!orders ? <div className="skel" /> : shown.length === 0 ? <Empty icon="orders" t={ot === 'active' ? 'Tidak ada pesanan aktif' : 'Belum ada riwayat'} /> : shown.map(o => <div className="card hov" key={o.id}>
        <div className="row sp"><b>#{o.id.slice(0, 6)}</b><span className={'tag ' + (o.status === 'DELIVERED' ? 'ok' : o.status === 'CANCELLED' ? 'bad' : '')}>{STATUS[o.status]}</span></div>
        <small>{o.items.map(i => i.qty + '× ' + i.name).join(', ')}</small><div className="row sp mt"><b className="o">{rp(o.total)}</b><small>{o.payment_method_name || PAYLABEL[o.payment_method] || o.payment_method}</small></div>
        <div className="row wrap mt"><button className="sm" onClick={() => setTrackId(o.id)}>Lacak pesanan</button>{o.driver_id && <button className="sm ghost" onClick={() => setChat(o)}>Chat driver{cm.unread[o.id] > 0 ? ` (${cm.unread[o.id]})` : ''}</button>}{o.status === 'PENDING' && <button className="sm x" onClick={() => act(o.id, 'CANCELLED', 'Pesanan dibatalkan')}>Batalkan</button>}</div></div>)}</div>}

    {tab === 'chat' && <div className="view"><div className="top"><h2>Pesan</h2></div>
      {withDriver.length === 0 ? <Empty icon="chat" t="Chat dengan driver aktif setelah pesananmu diambil driver" /> : withDriver.map(o => <div className="card hov row" key={o.id} onClick={() => setChat(o)} style={{ cursor: 'pointer' }}><Avatar p={pf[o.driver_id]} /><div className="grow"><b>{pf[o.driver_id]?.name || 'Driver'}</b><br /><small className="prev" style={{ color: cm.unread[o.id] ? 'var(--ink)' : undefined, fontWeight: cm.unread[o.id] ? 600 : 400 }}>{cm.last[o.id] ? (cm.last[o.id].sender_id === me.id ? 'Kamu: ' : '') + cm.last[o.id].body : 'Pesanan #' + o.id.slice(0, 6) + ' · ' + STATUS[o.status]}</small></div>{cm.unread[o.id] > 0 ? <span className="tag">{cm.unread[o.id]}</span> : <Icon n="chat" />}</div>)}</div>}

    {tab === 'profile' && <ProfileView me={me} reload={reload} address />}

    <BottomNav items={nav} tab={tab} set={setTab} badges={{ cart: count, orders: (orders || []).filter(isActive).length, chat: cm.total }} />

    {pick && <Sheet onClose={() => setPick(null)}><div className="hero">{pick.image_url ? <img src={pick.image_url} alt="" /> : (pick.emoji || '🍔')}</div>
      <h3>{pick.name}</h3><div className="row mt"><span className="row" style={{ color: '#E8A317' }}><Icon n="star" s={15} fill />{pick.rating}</span><span className="row"><Icon n="clock" s={15} />20 mnt</span><small>Stok {pick.stock}</small></div>
      <p style={{ color: 'var(--mut)', margin: '10px 0' }}>{pick.description || 'Menu favorit pelanggan kami.'}</p>
      <div className="row sp"><b style={{ fontSize: 22 }} className="o">{rp(pick.price * pq)}</b><div className="qty"><button className="round soft" onClick={() => setPq(Math.max(1, pq - 1))}><Icon n="minus" s={14} /></button><b>{pq}</b><button className="round" onClick={() => setPq(Math.min(pq + 1, pick.stock, 20))}><Icon n="plus" s={14} /></button></div></div>
      <button className="full mt" disabled={pick.stock < 1} onClick={() => { add(pick, pq); setPick(null) }}>Tambah ke keranjang</button></Sheet>}

    {track && <Sheet full onClose={() => setTrackId(null)}><div className="top" style={{ paddingTop: 0 }}><button className="icon" onClick={() => setTrackId(null)}><Icon n="back" /></button><h2>Lacak #{track.id.slice(0, 6)}</h2></div>
      <LiveMap status={track.status} store={store} dest={{ lat: track.dest_lat, lng: track.dest_lng }} loc={dl} onShare={shareDest} /><Steps status={track.status} />
      {track.driver_id && <div className="card row"><Avatar p={pf[track.driver_id]} /><div className="grow"><b>{pf[track.driver_id]?.name || 'Driver'}</b><br /><small>{pf[track.driver_id]?.phone || 'Driver pesananmu'}</small></div><button className="icon" onClick={() => { setTrackId(null); setChat(track) }}><Icon n="chat" /></button></div>}
      <div className="card"><div className="line"><span>Total</span><b className="o">{rp(track.total)}</b></div><small>{track.address}</small></div></Sheet>}

    {chat && <Chat order={chat} me={me} peer={pf[chat.driver_id]} onClose={() => setChat(null)} onRead={cm.markSeen} />}
  </div>;
}
