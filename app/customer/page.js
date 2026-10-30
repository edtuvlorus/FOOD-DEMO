'use client';
import { useEffect, useState } from 'react'; import { sb, rp, useGuard, useOrders, Bar, OrderCard } from '../../lib/sb';
export default function C(){
  const me=useGuard('customer'); const {orders,err,act,load}=useOrders(me); const [menu,setMenu]=useState([]); const [cart,setCart]=useState({}); const [addr,setAddr]=useState(''); const [m,setM]=useState('');
  useEffect(()=>{me&&sb.from('menu_items').select('*').eq('available',true).then(r=>setMenu(r.data||[]))},[me]);
  if(!me) return <p>Memuat...</p>;
  const items=menu.filter(x=>cart[x.id]); const sub=items.reduce((s,x)=>s+x.price*cart[x.id],0);
  const order=async()=>{ if(!addr) return setM('Isi alamat'); const {error}=await sb.rpc('place_order',{p_items:items.map(x=>({id:x.id,qty:cart[x.id]})),p_address:addr}); if(error) return setM(error.message); setCart({}); setM('Order dibuat!'); load(); };
  return <><Bar me={me} title="Customer"/><main>
    <h3>Menu</h3>{menu.map(x=><div className="card row" key={x.id} style={{justifyContent:'space-between'}}><span>{x.emoji} {x.name} — {rp(x.price)}</span><span className="row"><button onClick={()=>setCart({...cart,[x.id]:Math.max((cart[x.id]||0)-1,0)})}>−</button>{cart[x.id]||0}<button onClick={()=>setCart({...cart,[x.id]:(cart[x.id]||0)+1})}>+</button></span></div>)}
    {sub>0&&<div className="card">Subtotal {rp(sub)} (ongkir & biaya layanan dihitung server)<input placeholder="Alamat pengiriman" value={addr} onChange={e=>setAddr(e.target.value)}/><button onClick={order}>Pesan (COD)</button></div>}
    <p className="err">{m||err}</p><h3>Pesanan Saya</h3>{!orders?'Memuat...':orders.length===0?'Belum ada pesanan.':orders.map(o=><OrderCard key={o.id} o={o}>{o.status==='PENDING'&&<button className="x" onClick={()=>act(o.id,'CANCELLED')}>Batalkan</button>}</OrderCard>)}</main></>}
