'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '../../lib/sb';

export default function Reset() {
  const [ready, setReady] = useState(false); const [a, setA] = useState(''); const [b, setB] = useState(''); const [msg, setMsg] = useState(''); const r = useRouter();
  useEffect(() => {
    const { data: { subscription } } = sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY' || ev === 'SIGNED_IN') setReady(true) });
    sb.auth.getSession().then(({ data }) => data.session && setReady(true)); return () => subscription.unsubscribe();
  }, []);
  const save = async () => {
    if (a.length < 6) return setMsg('Password minimal 6 karakter'); if (a !== b) return setMsg('Konfirmasi password tidak sama');
    const { error } = await sb.auth.updateUser({ password: a }); if (error) return setMsg(error.message);
    setMsg('Password berhasil diganti. Mengalihkan...'); await sb.auth.signOut(); setTimeout(() => r.replace('/login'), 1200);
  };
  return <div className="login"><div className="lh"><div className="lg">🔑</div><h1>Password baru</h1></div><div className="lc">
    {!ready ? <p>Membuka tautan reset... Jika tidak berhasil, minta tautan baru dari halaman login.</p> : <>
      <input type="password" placeholder="Password baru" value={a} onChange={e => setA(e.target.value)} /><input type="password" placeholder="Ulangi password baru" value={b} onChange={e => setB(e.target.value)} />
      <p className="err">{msg}</p><button className="full" onClick={save}>Simpan password</button></>}
    <button className="ghost full mt" onClick={() => r.replace('/login')}>Kembali ke login</button></div></div>;
}
