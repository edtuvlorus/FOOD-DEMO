'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb, rp, toast, uploadImage, STATUS, PAYLABEL, isActive, useGuard, useOrders, useList, useSettings, useProfiles, useStore, getPos, hasPt } from '../../lib/sb';
import { Icon, Sheet, Empty, ProfileView, Avatar } from '../../lib/ui';
import { makePdf, receiptPdf } from '../../lib/pdf';

const pad = n => String(n).padStart(2, '0'); const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function bucket(d, p) { d = new Date(d); if (p === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; if (p === 'week') { d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) } return ymd(d) }
function buckets(p) {
  const n = p === 'day' ? 7 : p === 'week' ? 8 : 6, out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(p === 'month' ? 1 : d.getDate()); if (p === 'day') d.setDate(d.getDate() - i); if (p === 'week') d.setDate(d.getDate() - 7 * i); if (p === 'month') d.setMonth(d.getMonth() - i);
    out.push({ key: bucket(d, p), label: p === 'month' ? `${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : (() => { const x = new Date(bucket(d, p) + 'T00:00'); return `${x.getDate()}/${x.getMonth() + 1}` })() }) }
  return out;
}
const PNAME = { day: 'Hari ini', week: 'Minggu ini', month: 'Bulan ini' };

export default function Admin() {
  const { me, reload } = useGuard('admin'); const { orders, act } = useOrders(me); const r = useRouter();
  const [menu, loadMenu] = useList('menu_items', 'name', me); const [cats, loadCats] = useList('categories', 'sort', me); const [banners, loadBan] = useList('banners', 'sort', me); const [st, loadSt] = useSettings(me); const [store, loadStore] = useStore(me); const [sto, setSto] = useState(null);
  const [tab, setTab] = useState('dash'); const [per, setPer] = useState('day'); const [of, setOf] = useState('all'); const [form, setForm] = useState(null); const [catName, setCatName] = useState(''); const [bform, setBform] = useState(null); const [ship, setShip] = useState(null); const [busy, setBusy] = useState(false);
  const pf = useProfiles((orders || []).flatMap(o => [o.customer_id, o.driver_id]));
  const ok = (orders || []).filter(o => o.status !== 'CANCELLED'), done = ok.filter(o => o.status === 'DELIVERED');
  const bks = useMemo(() => { const b = buckets(per), m = Object.fromEntries(b.map(x => [x.key, 0])); done.forEach(o => { const k = bucket(o.created_at, per); if (k in m) m[k] += Number(o.total) }); return b.map(x => ({ ...x, v: m[x.key] })) }, [orders, per]);
  if (!me) return <div className="adm"><div className="skel mt" /></div>;
  const cur = bks[bks.length - 1]?.v || 0, rng = bks.reduce((s, x) => s + x.v, 0), max = Math.max(...bks.map(x => x.v), 1);
  const sold = {}; ok.forEach(o => o.items.forEach(i => { const s = sold[i.name] || (sold[i.name] = { q: 0, v: 0 }); s.q += i.qty; s.v += i.qty * i.price }));
  const itemsSold = Object.values(sold).reduce((s, x) => s + x.q, 0); const nm = id => pf[id]?.name || '-';

  const exportOverview = async () => {
    await makePdf(`omzet-${per}-${ymd(new Date())}.pdf`, 'FoodDash - Laporan Omzet', `Dicetak ${new Date().toLocaleString('id-ID')} · periode: ${{ day: 'harian', week: 'mingguan', month: 'bulanan' }[per]}`, [
      { h: 'Ringkasan', kv: [[PNAME[per], rp(cur)], ['Omzet rentang grafik', rp(rng)], ['Total omzet (pesanan selesai)', rp(done.reduce((s, o) => s + Number(o.total), 0))], ['Total pesanan', ok.length], ['Pesanan selesai', done.length], ['Pesanan aktif', ok.filter(isActive).length], ['Total item terjual/dipesan', itemsSold]] },
      { h: 'Omzet per ' + { day: 'hari', week: 'minggu', month: 'bulan' }[per], head: ['Periode', 'Omzet'], w: [250, 265], right: [1], rows: bks.map(x => [x.label, rp(x.v)]) },
      { h: 'Total produk yang dipesan', head: ['Produk', 'Jumlah', 'Nilai'], w: [260, 100, 155], right: [1, 2], rows: Object.entries(sold).sort((a, b) => b[1].q - a[1].q).map(([n, x]) => [n, x.q, rp(x.v)]) },
      { h: 'Daftar pesanan (terbaru)', head: ['No', 'Tanggal', 'Customer', 'Status', 'Total'], w: [60, 110, 140, 110, 95], right: [4], rows: (orders || []).slice(0, 80).map(o => ['#' + o.id.slice(0, 6), new Date(o.created_at).toLocaleDateString('id-ID'), nm(o.customer_id), STATUS[o.status], rp(o.total)]) }]);
  };
  const saveProd = async () => {
    const f = form; if (!f.name?.trim() || f.price === '' || f.price == null) return toast('Nama dan harga wajib diisi', 'err'); setBusy(true);
    const row = { name: f.name.trim(), price: +f.price, stock: +f.stock || 0, emoji: f.emoji || null, description: f.description || null, image_url: f.image_url || null, category_id: f.category_id || null, available: f.available !== false, rating: +f.rating || 4.5 };
    const { error } = f.id ? await sb.from('menu_items').update(row).eq('id', f.id) : await sb.from('menu_items').insert(row); setBusy(false);
    error ? toast(error.message, 'err') : (toast('Produk disimpan'), setForm(null), loadMenu());
  };
  const upl = (folder, cb) => async e => { setBusy(true); const u = await uploadImage(e.target.files[0], folder); setBusy(false); u && cb(u) };
  const del = async (t, id, reloadFn) => { if (!confirm('Hapus data ini?')) return; const { error } = await sb.from(t).delete().eq('id', id); error ? toast(error.message, 'err') : (toast('Dihapus'), reloadFn()) };
  const addCat = async () => { if (!catName.trim()) return; const { error } = await sb.from('categories').insert({ name: catName.trim(), sort: (cats?.length || 0) + 1 }); error ? toast(error.message, 'err') : (setCatName(''), toast('Kategori dibuat'), loadCats()) };
  const saveShip = async () => { const s = ship; const { error } = await sb.from('settings').upsert([{ key: 'ship_base', value: +s.ship_base }, { key: 'ship_per_km', value: +s.ship_per_km }, { key: 'service_fee', value: +s.service_fee }]); error ? toast(error.message, 'err') : (toast('Pengaturan ongkir disimpan'), loadSt(), setShip(null)) };
  const saveBan = async () => { if (!bform.title?.trim()) return toast('Judul banner wajib diisi', 'err'); const { error } = await sb.from('banners').insert({ title: bform.title, subtitle: bform.subtitle || '', image_url: bform.image_url || null, sort: (banners?.length || 0) + 1 }); error ? toast(error.message, 'err') : (toast('Banner ditambahkan'), setBform(null), loadBan()) };
  const sv = sto || { name: store?.name || '', address: store?.address || '', lat: store?.lat ?? '', lng: store?.lng ?? '' };
  const saveStore = async () => { if (sv.lat === '' || sv.lng === '' || isNaN(+sv.lat) || isNaN(+sv.lng) || Math.abs(+sv.lat) > 90 || Math.abs(+sv.lng) > 180) return toast('Isi koordinat toko yang valid (latitude & longitude)', 'err'); const { error } = await sb.rpc('save_store', { p_name: sv.name || 'FoodDash', p_address: sv.address || null, p_lat: +sv.lat, p_lng: +sv.lng }); error ? toast(error.message, 'err') : (toast('Lokasi toko disimpan'), setSto(null), loadStore()) };
  const myLoc = async () => { try { const c = await getPos(); setSto({ ...sv, lat: +c.latitude.toFixed(6), lng: +c.longitude.toFixed(6) }); toast('Lokasi perangkat dipakai sebagai lokasi toko') } catch (e) { toast(e.message, 'err') } };
  const toggleBan = async b => { await sb.from('banners').update({ active: !b.active }).eq('id', b.id); loadBan() };

  const tabs = [['dash', 'Omzet', 'chart'], ['orders', 'Pesanan', 'orders'], ['prod', 'Produk', 'box'], ['cat', 'Kategori', 'tag'], ['ship', 'Toko, Ongkir & Banner', 'truck'], ['me', 'Profil', 'user']];
  const F = k => e => setForm({ ...form, [k]: e.target.value });
  const fl = of === 'all' ? orders || [] : of === 'active' ? (orders || []).filter(isActive) : (orders || []).filter(o => o.status === of);
  const sh = ship || st;

  return <div className="adm">
    <div className="ah"><span style={{ fontSize: 28 }}>🍔</span><div className="grow"><b style={{ fontSize: 18 }}>FoodDash Admin</b><br /><small style={{ color: '#fff9' }}>{me.name}</small></div><button onClick={async () => { await sb.auth.signOut(); r.replace('/login') }}><span className="row"><Icon n="logout" s={16} />Keluar</span></button></div>
    <div className="tabs">{tabs.map(([k, l, ic]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon n={ic} s={16} />{l}</button>)}</div>

    {tab === 'dash' && <div className="view">
      <div className="row sp wrap"><div className="row">{['day', 'week', 'month'].map(p => <button key={p} className={'sm ' + (per === p ? '' : 'ghost')} onClick={() => setPer(p)}>{{ day: 'Per hari', week: 'Per minggu', month: 'Per bulan' }[p]}</button>)}</div><button className="sm" onClick={exportOverview}><span className="row"><Icon n="download" s={15} />Export PDF</span></button></div>
      <div className="stats mt"><div className="stat hl"><small>Omzet {PNAME[per].toLowerCase()}</small><b>{rp(cur)}</b></div><div className="stat"><small>Total omzet rentang</small><b>{rp(rng)}</b></div><div className="stat"><small>Total pesanan</small><b>{ok.length}</b></div><div className="stat"><small>Sedang berjalan</small><b>{ok.filter(isActive).length}</b></div><div className="stat"><small>Item dipesan</small><b>{itemsSold}</b></div></div>
      <div className="card mt"><b>Grafik omzet ({{ day: '7 hari', week: '8 minggu', month: '6 bulan' }[per]})</b><div className="bars" key={per}>{bks.map(x => <div className="bar" key={x.key}><span>{x.v ? rp(x.v).replace('000', 'k') : ''}</span><i style={{ height: Math.max(x.v / max * 100, 2) + '%' }} /><span>{x.label}</span></div>)}</div><small>Omzet dihitung dari pesanan berstatus Selesai.</small></div>
      <div className="card"><b>Produk paling banyak dipesan</b><table><tbody>{Object.entries(sold).sort((a, b) => b[1].q - a[1].q).slice(0, 8).map(([n, x]) => <tr key={n}><td>{n}</td><td>{x.q}×</td><td style={{ textAlign: 'right' }}>{rp(x.v)}</td></tr>)}</tbody></table>{!Object.keys(sold).length && <Empty t="Belum ada data" />}</div></div>}

    {tab === 'orders' && <div className="view"><div className="chips">{[['all', 'Semua'], ['active', 'Aktif'], ['PENDING', 'Baru'], ['PREPARING', 'Disiapkan'], ['READY_FOR_PICKUP', 'Menunggu driver'], ['ON_DELIVERY', 'Diantar'], ['DELIVERED', 'Selesai'], ['CANCELLED', 'Batal']].map(([k, l]) => <button key={k} className={'chip ' + (of === k ? 'on' : '')} onClick={() => setOf(k)}>{l}</button>)}</div>
      {!orders ? <div className="skel" /> : fl.length === 0 ? <Empty icon="orders" t="Tidak ada pesanan" /> : <div className="two">{fl.map(o => <div className="card hov" key={o.id}>
        <div className="row sp"><b>#{o.id.slice(0, 6)}</b><span className={'tag ' + (o.status === 'DELIVERED' ? 'ok' : o.status === 'CANCELLED' ? 'bad' : '')}>{STATUS[o.status]}</span></div>
        <div className="row mt"><Avatar p={pf[o.customer_id]} s={30} /><small>{nm(o.customer_id)}{o.driver_id && <> · driver: <b>{nm(o.driver_id)}</b></>}</small></div>
        <small style={{ display: 'block', margin: '8px 0' }}>{o.items.map(i => i.qty + '× ' + i.name).join(', ')}</small><small>{o.address} · {o.distance_km} km · {PAYLABEL[o.payment_method]}</small>
        <div className="row sp mt"><b className="o">{rp(o.total)}</b><small>{new Date(o.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</small></div>
        <div className="row wrap mt">
          {o.status === 'PENDING' && <button className="sm" onClick={() => act(o.id, 'PREPARING', 'Pesanan dikonfirmasi')}>Konfirmasi & siapkan</button>}
          {o.status === 'PREPARING' && <button className="sm" onClick={() => act(o.id, 'READY_FOR_PICKUP', 'Diserahkan ke driver (menunggu diambil)')}>Serahkan ke driver</button>}
          {['PENDING', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status) && <button className="sm x" onClick={() => act(o.id, 'CANCELLED', 'Pesanan dibatalkan')}>Batalkan</button>}
          <button className="sm ghost" onClick={() => receiptPdf(o, nm(o.customer_id), o.driver_id && nm(o.driver_id))}><span className="row"><Icon n="file" s={14} />Struk PDF</span></button></div></div>)}</div>}</div>}

    {tab === 'prod' && <div className="view"><div className="row sp"><b>{menu?.length || 0} produk</b><button className="sm" onClick={() => setForm({ available: true, stock: 50, rating: 4.5 })}><span className="row"><Icon n="plus" s={14} />Tambah produk</span></button></div>
      {menu && menu.length === 0 && <Empty t="Belum ada produk" />}<div className="two mt">{(menu || []).map(m => <div className="card hov row" key={m.id}><div className="thumb">{m.image_url ? <img src={m.image_url} alt="" /> : (m.emoji || '🍔')}</div>
        <div className="grow"><b>{m.name}</b> {!m.available && <span className="tag bad">Nonaktif</span>}<br /><small>{cats?.find(c => c.id === m.category_id)?.name || 'Tanpa kategori'}</small><br /><span className="o b">{rp(m.price)}</span> <span className={'tag ' + (m.stock < 5 ? 'bad' : 'ok')}>Stok {m.stock}</span></div>
        <div style={{ display: 'grid', gap: 6 }}><button className="icon" onClick={() => setForm(m)}><Icon n="edit" s={16} /></button><button className="icon" style={{ color: 'var(--bad)', background: '#fdecec' }} onClick={() => del('menu_items', m.id, loadMenu)}><Icon n="trash" s={16} /></button></div></div>)}</div></div>}

    {tab === 'cat' && <div className="view"><div className="card"><b>Buat kategori</b><div className="row"><input placeholder="Nama kategori, mis. Burger" value={catName} onChange={e => setCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCat()} /><button onClick={addCat}>Tambah</button></div></div>
      {(cats || []).map(c => <div className="card row sp hov" key={c.id}><b>{c.name}</b><span className="row"><small>{menu?.filter(m => m.category_id === c.id).length || 0} produk</small><button className="icon" style={{ color: 'var(--bad)', background: '#fdecec' }} onClick={() => del('categories', c.id, loadCats)}><Icon n="trash" s={16} /></button></span></div>)}{cats?.length === 0 && <Empty icon="tag" t="Belum ada kategori" />}</div>}

    {tab === 'ship' && <div className="view two">
      <div className="card"><b>Lokasi toko</b><p><small>Dipakai untuk menghitung jarak ongkir dan titik awal pelacakan driver.</small></p>
        <label>Nama toko</label><input value={sv.name} onChange={e => setSto({ ...sv, name: e.target.value })} /><label>Alamat</label><input value={sv.address} onChange={e => setSto({ ...sv, address: e.target.value })} />
        <div className="row"><div className="grow"><label>Latitude</label><input inputMode="decimal" placeholder="-6.7063" value={sv.lat} onChange={e => setSto({ ...sv, lat: e.target.value })} /></div><div className="grow"><label>Longitude</label><input inputMode="decimal" placeholder="108.5571" value={sv.lng} onChange={e => setSto({ ...sv, lng: e.target.value })} /></div></div>
        <small>Tips: di Google Maps tekan lama pada titik toko, lalu salin angka koordinatnya.</small>
        <div className="row wrap mt"><button className="ghost sm" onClick={myLoc}><span className="row"><Icon n="pin" s={14} />Pakai lokasi saya sekarang</span></button><button className="grow" disabled={!sto} onClick={saveStore}>Simpan lokasi toko</button></div>
        {hasPt(sv) && <iframe title="Peta toko" style={{ width: '100%', height: 190, border: 0, borderRadius: 14, marginTop: 12 }} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${+sv.lng - 0.008}%2C${+sv.lat - 0.005}%2C${+sv.lng + 0.008}%2C${+sv.lat + 0.005}&layer=mapnik&marker=${sv.lat}%2C${sv.lng}`} />}</div>
      <div className="card"><b>Pengaturan ongkir</b><p><small>Ongkir = harga dasar + (harga per km × jarak). Jarak dipilih customer saat checkout.</small></p>
        <label>Harga dasar (Rp)</label><input type="number" value={sh.ship_base} onChange={e => setShip({ ...sh, ship_base: e.target.value })} /><label>Harga per km (Rp)</label><input type="number" value={sh.ship_per_km} onChange={e => setShip({ ...sh, ship_per_km: e.target.value })} /><label>Biaya layanan (Rp)</label><input type="number" value={sh.service_fee} onChange={e => setShip({ ...sh, service_fee: e.target.value })} />
        <small>Contoh 5 km: {rp(+sh.ship_base + +sh.ship_per_km * 5)}</small><button className="full mt" disabled={!ship} onClick={saveShip}>Simpan ongkir</button></div>
      <div className="card"><div className="row sp"><b>Banner beranda</b><button className="sm" onClick={() => setBform({})}>Tambah</button></div>
        {(banners || []).map(b => <div className="row mt" key={b.id}><div className="thumb">{b.image_url ? <img src={b.image_url} alt="" /> : <Icon n="image" />}</div><div className="grow"><b>{b.title}</b><br /><small>{b.subtitle}</small></div><button className={'sm ' + (b.active ? 'soft' : 'ghost')} onClick={() => toggleBan(b)}>{b.active ? 'Aktif' : 'Mati'}</button><button className="icon" style={{ color: 'var(--bad)', background: '#fdecec' }} onClick={() => del('banners', b.id, loadBan)}><Icon n="trash" s={16} /></button></div>)}{banners?.length === 0 && <Empty icon="image" t="Belum ada banner (banner bawaan dipakai)" />}</div></div>}

    {tab === 'me' && <div style={{ maxWidth: 440, margin: '0 auto' }}><ProfileView me={me} reload={reload} /></div>}

    {form && <Sheet wide onClose={() => setForm(null)}><h3>{form.id ? 'Ubah produk' : 'Produk baru'}</h3>
      <div className="row mt"><div className="thumb" style={{ width: 80, height: 80 }}>{form.image_url ? <img src={form.image_url} alt="" /> : <Icon n="image" s={28} />}</div><label className="grow"><span className="ghost" style={{ display: 'inline-block', padding: '9px 14px', borderRadius: 12, boxShadow: 'inset 0 0 0 1.5px var(--o)', color: 'var(--o)', cursor: 'pointer', fontWeight: 600 }}>Upload foto</span><input type="file" accept="image/*" hidden onChange={upl('products', u => setForm(f => ({ ...f, image_url: u })))} /></label></div>
      <label>Nama</label><input value={form.name || ''} onChange={F('name')} /><div className="row"><div className="grow"><label>Harga (Rp)</label><input type="number" value={form.price ?? ''} onChange={F('price')} /></div><div className="grow"><label>Jumlah stok</label><input type="number" value={form.stock ?? ''} onChange={F('stock')} /></div></div>
      <label>Kategori</label><select value={form.category_id || ''} onChange={F('category_id')}><option value="">Tanpa kategori</option>{(cats || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <label>Deskripsi</label><textarea rows="2" value={form.description || ''} onChange={F('description')} /><div className="row"><div className="grow"><label>Emoji (jika tanpa foto)</label><input value={form.emoji || ''} onChange={F('emoji')} placeholder="🍔" /></div><div className="grow"><label>Rating</label><input type="number" step="0.1" min="1" max="5" value={form.rating ?? ''} onChange={F('rating')} /></div></div>
      <label className="row"><input type="checkbox" style={{ width: 18, margin: 0 }} checked={form.available !== false} onChange={e => setForm({ ...form, available: e.target.checked })} />Tampilkan di menu customer</label>
      <button className="full mt" disabled={busy} onClick={saveProd}>Simpan produk</button></Sheet>}
    {bform && <Sheet wide onClose={() => setBform(null)}><h3>Banner baru</h3><input placeholder="Judul" value={bform.title || ''} onChange={e => setBform({ ...bform, title: e.target.value })} /><input placeholder="Teks kecil" value={bform.subtitle || ''} onChange={e => setBform({ ...bform, subtitle: e.target.value })} />
      <div className="row"><div className="thumb">{bform.image_url ? <img src={bform.image_url} alt="" /> : <Icon n="image" />}</div><label><span style={{ color: 'var(--o)', fontWeight: 600, cursor: 'pointer' }}>Upload gambar</span><input type="file" accept="image/*" hidden onChange={upl('banners', u => setBform(f => ({ ...f, image_url: u })))} /></label></div><button className="full mt" disabled={busy} onClick={saveBan}>Simpan banner</button></Sheet>}
  </div>;
}
