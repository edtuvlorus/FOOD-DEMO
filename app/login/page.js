'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '../../lib/sb';

export default function Login() {
  const [f, setF] = useState({ email: '', password: '', name: '', role: 'customer' });
  const [mode, setMode] = useState('login'); // login | reg | forgot
  const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const r = useRouter(); const set = k => e => setF({ ...f, [k]: e.target.value });
  const say = (m, good) => { setMsg(m); setOk(!!good) };
  const enter = async user => { const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single(); r.replace('/' + (p?.role || 'customer')) };

  const go = async () => {
    const email = f.email.trim(), name = f.name.trim();
    if (!email) return say('Email wajib diisi');
    if (mode === 'forgot') {
      setBusy(true); const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset' }); setBusy(false);
      return error ? say(error.message) : say('Tautan reset password sudah dikirim ke email Anda.', true);
    }
    if (!f.password) return say('Password wajib diisi');
    if (mode === 'reg' && !name) return say('Nama wajib diisi');
    if (mode === 'reg' && f.password.length < 6) return say('Password minimal 6 karakter');
    setBusy(true); say('Memproses...', true);
    try {
      if (mode === 'reg') {
        const { data, error } = await sb.auth.signUp({ email, password: f.password, options: { data: { name, role: f.role } } });
        if (error) return say(error.message);
        if (data.user && data.user.identities && data.user.identities.length === 0) return say('Email sudah terdaftar, silakan login.');
        let session = data.session;
        if (!session) { const s = await sb.auth.signInWithPassword({ email, password: f.password }); if (s.error) return say('Akun dibuat, tetapi Confirm email di Supabase masih aktif. Matikan di Authentication > Providers > Email, atau konfirmasi lewat email lalu login.'); session = s.data.session }
        return enter(session.user);
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password: f.password });
      if (error) return say(error.message === 'Invalid login credentials' ? 'Email atau password salah' : error.message);
      return enter(data.user);
    } finally { setBusy(false) }
  };
  const to = m => { setMode(m); setMsg('') };
  return <div className="login">
    <div className="lh"><div className="lg">🍔</div><h1>FoodDash</h1><p>Pesan makanan favoritmu, diantar cepat</p></div>
    <div className="lc" key={mode}>
      <h2 style={{ marginBottom: 8 }}>{mode === 'reg' ? 'Buat akun' : mode === 'forgot' ? 'Lupa password' : 'Masuk'}</h2>
      {mode === 'forgot' && <small>Masukkan email akun Anda, kami kirim tautan untuk membuat password baru.</small>}
      {mode === 'reg' && <><input placeholder="Nama lengkap" value={f.name} onChange={set('name')} /><select value={f.role} onChange={set('role')}><option value="customer">Saya customer</option><option value="driver">Saya driver</option></select></>}
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} />
      {mode !== 'forgot' && <input type="password" placeholder="Password" value={f.password} onChange={set('password')} onKeyDown={e => e.key === 'Enter' && go()} />}
      {mode === 'login' && <div style={{ textAlign: 'right' }}><a href="#" className="o" onClick={e => { e.preventDefault(); to('forgot') }}>Lupa password?</a></div>}
      <p className="err" style={{ color: ok ? 'var(--ok)' : undefined }}>{msg}</p>
      <button className="full" disabled={busy} onClick={go}>{mode === 'reg' ? 'Daftar' : mode === 'forgot' ? 'Kirim tautan reset' : 'Masuk'}</button>
      <button className="ghost full mt" onClick={() => to(mode === 'login' ? 'reg' : 'login')}>{mode === 'login' ? 'Daftar akun baru' : 'Kembali ke login'}</button>
    </div></div>;
}
