'use client';
import { useGuard, useOrders, Bar, OrderCard } from '../../lib/sb';
const NEXT={DRIVER_ASSIGNED:['ON_DELIVERY','Mulai antar'],ON_DELIVERY:['DELIVERED','Selesai diantar']};
export default function D(){
  const me=useGuard('driver'); const {orders,err,act}=useOrders(me); if(!me) return <p>Memuat...</p>;
  const offers=(orders||[]).filter(o=>o.status==='READY_FOR_PICKUP'&&!o.driver_id), mine=(orders||[]).filter(o=>o.driver_id===me.id);
  return <><Bar me={me} title="Driver"/><main><p className="err">{err}</p><h3>Order tersedia</h3>{offers.length===0?'Belum ada order siap diambil.':offers.map(o=><OrderCard key={o.id} o={o}><button onClick={()=>act(o.id,'DRIVER_ASSIGNED')}>Ambil order</button></OrderCard>)}
  <h3>Order saya</h3>{mine.length===0?'Kosong.':mine.map(o=><OrderCard key={o.id} o={o}>{NEXT[o.status]&&<button onClick={()=>act(o.id,NEXT[o.status][0])}>{NEXT[o.status][1]}</button>}</OrderCard>)}
  <div className="card">Pendapatan (ongkir): Rp{mine.filter(o=>o.status==='DELIVERED').length*10000}</div></main></>}
