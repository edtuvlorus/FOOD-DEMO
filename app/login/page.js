'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '../../lib/sb';

export default function Login() {
  const [f, setF] = useState({ email: '', password: '', name: '', role: 'customer' });
  const [reg, setReg] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const r = useRouter();
  const set = k => e => setF({ ...f, [k]: e.target.value });

  // Setelah punya sesi: ambil profil (nama & role tersimpan di tabel profiles) lalu arahkan ke dashboard
  const enter = async user => {
    let { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single();
    r.replace('/' + (p?.role || 'customer'));
  };

  const go = async () => {
    const email = f.email.trim(), name = f.name.trim();
    if (!email || !f.password) return setMsg('Email dan password wajib diisi');
    if (reg && !name) return setMsg('Nama wajib diisi');
    if (reg && f.password.length < 6) return setMsg('Password minimal 6 karakter');
    setBusy(true); setMsg('Memproses...');
    try {
      if (reg) {
        // Nama & role disimpan permanen: user_metadata + tabel profiles (via trigger handle_new_user)
        const { data, error } = await sb.auth.signUp({ email, password: f.password, options: { data: { name, role: f.role } } });
        if (error) return setMsg(error.message);
        if (data.user && data.user.identities && data.user.identities.length === 0) return setMsg('Email sudah terdaftar, silakan login.');
        let session = data.session;
        if (!session) { // Confirm email aktif? coba login langsung
          const s = await sb.auth.signInWithPassword({ email, password: f.password });
          if (s.error) return setMsg('Akun dibuat, tetapi Confirm email di Supabase masih aktif. Matikan di Authentication > Providers > Email, atau konfirmasi lewat email lalu login.');
          session = s.data.session;
        }
        return enter(session.user);
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password: f.password });
      if (error) return setMsg(error.message === 'Invalid login credentials' ? 'Email atau password salah' : error.message);
      return enter(data.user);
    } finally { setBusy(false); }
  };

  return (
    <main><div className="card">
      <h2>🍔 FoodDash Demo</h2>
      <h3>{reg ? 'Daftar Akun' : 'Login'}</h3>
      {reg && <>
        <input placeholder="Nama" value={f.name} onChange={set('name')} />
        <select value={f.role} onChange={set('role')}><option value="customer">Customer</option><option value="driver">Driver</option></select>
      </>}
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} />
      <input type="password" placeholder="Password" value={f.password} onChange={set('password')} onKeyDown={e => e.key === 'Enter' && go()} />
      <div className="row">
        <button onClick={go} disabled={busy}>{reg ? 'Daftar' : 'Login'}</button>
        <button className="x" onClick={() => { setReg(!reg); setMsg(''); }}>{reg ? 'Sudah punya akun' : 'Daftar baru'}</button>
      </div>
      <p className="err">{msg}</p>
    </div></main>
  );
}
