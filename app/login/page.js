'use client';
import { useState } from 'react'; import { useRouter } from 'next/navigation'; import { sb } from '../../lib/sb';
export default function Login(){
  const [f,setF]=useState({email:'',password:'',name:'',role:'customer'}); const [reg,setReg]=useState(false); const [msg,setMsg]=useState(''); const r=useRouter();
  const go=async()=>{ setMsg('Memproses...');
    const res = reg ? await sb.auth.signUp({email:f.email,password:f.password,options:{data:{name:f.name,role:f.role}}}) : await sb.auth.signInWithPassword({email:f.email,password:f.password});
    if(res.error) return setMsg(res.error.message);
    const {data:{user}}=await sb.auth.getUser(); if(!user) return setMsg('Cek email untuk konfirmasi, lalu login.');
    const {data:p}=await sb.from('profiles').select('role').eq('id',user.id).single(); r.replace('/'+(p?.role||'customer')); };
  return <main><div className="card"><h2>🍔 FoodDash Demo</h2>
    {reg&&<><input placeholder="Nama" onChange={e=>setF({...f,name:e.target.value})}/><select onChange={e=>setF({...f,role:e.target.value})}><option value="customer">Customer</option><option value="driver">Driver</option></select></>}
    <input placeholder="Email" onChange={e=>setF({...f,email:e.target.value})}/><input type="password" placeholder="Password" onChange={e=>setF({...f,password:e.target.value})}/>
    <div className="row"><button onClick={go}>{reg?'Daftar':'Login'}</button><button className="x" onClick={()=>setReg(!reg)}>{reg?'Sudah punya akun':'Daftar baru'}</button></div><p className="err">{msg}</p></div></main>}
