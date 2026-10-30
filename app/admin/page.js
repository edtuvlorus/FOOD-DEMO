'use client';
import { rp, useGuard, useOrders, Bar, OrderCard } from '../../lib/sb';
const NEXT={PENDING:['PREPARING','Terima & masak'],PREPARING:['READY_FOR_PICKUP','Siap diambil']};
export default function A(){
  const me=useGuard('admin'); const {orders,err,act}=useOrders(me); if(!me) return <p>Memuat...</p>;
  const ok=(orders||[]).filter(o=>o.status!=='CANCELLED'), done=ok.filter(o=>o.status==='DELIVERED');
  return <><Bar me={me} title="Super Admin"/><main><div className="card row"><span>Total order: <b>{ok.length}</b></span><span>Aktif: <b>{ok.length-done.length}</b></span><span>GMV: <b>{rp(done.reduce((s,o)=>s+Number(o.total),0))}</b></span></div><p className="err">{err}</p>
  {!orders?'Memuat...':orders.length===0?'Belum ada order.':orders.map(o=><OrderCard key={o.id} o={o}>{NEXT[o.status]&&<button onClick={()=>act(o.id,NEXT[o.status][0])}>{NEXT[o.status][1]}</button>}{['PENDING','PREPARING','READY_FOR_PICKUP'].includes(o.status)&&<button className="x" onClick={()=>act(o.id,'CANCELLED')}>Batalkan</button>}</OrderCard>)}</main></>}
