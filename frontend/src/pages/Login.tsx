import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, userFromBackend } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { login as apiLogin } from '../api/auth';
import { apiFetch } from '../api/client';

export default function Login() {
  const nav = useNavigate();
  const { setUser, saveToken } = useUser();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function translateError(msg: string): string {
    if (msg.includes('Invalid credentials') || msg.includes('401')) return t('login.errInvalidCredentials');
    if (msg.includes('Sessão expirada')) return msg;
    return msg;
  }

  async function submit() {
    if (!email || !pass) { setError(t('login.errFillFields')); return; }
    setLoading(true);
    setError('');
    try {
      const { access_token } = await apiLogin(email, pass);
      saveToken(access_token);
      // Role is determined in Lobby from /users/me/teams — store name/email only
      const me = await apiFetch('/auth/me');
      setUser(userFromBackend(me.name, me.email, null));
      nav('/lobby');
    } catch (e: unknown) {
      setError(translateError(e instanceof Error ? e.message : t('login.errGeneric')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'60px 26px 90px' }}>
        <div style={{ maxWidth:780, margin:'0 auto 18px' }}>
          <span onClick={() => nav('/')} className="btn-ghost" style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12.5, borderRadius:7, padding:'4px 8px' }}>{t('login.backToHome')}</span>
        </div>
        <div style={{ textAlign:'center', marginBottom:30 }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:52, height:52, display:'block', margin:'0 auto 14px' }} />
          <div style={{ fontSize:23, fontWeight:600, letterSpacing:'-.01em' }}>{t('login.title')}</div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginTop:6 }}>{t('login.subtitle')}</div>
        </div>

        <div style={{ maxWidth:380, margin:'0 auto' }}>
          <div>
            <div style={{ marginBottom:15 }}>
              <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>{t('login.email')}</div>
              <input className="input-base input-mono" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com" onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>
            <div>
              <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>{t('login.password')}</div>
              <div style={{ position:'relative' }}>
                <input className="input-base" type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} style={{ paddingRight:40 }} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:13, padding:0 }}>{showPass ? '🙈' : '👁'}</button>
              </div>
            </div>
            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:9, border:'1px solid rgba(241,85,108,.3)', background:'rgba(241,85,108,.08)', borderRadius:9, padding:'10px 13px', marginTop:14 }}>
                <span style={{ color:'var(--red)' }}>✕</span>
                <span style={{ fontSize:12, color:'var(--red)' }}>{error}</span>
              </div>
            )}
            <button onClick={submit} disabled={loading} className="btn-primary hover-bright" style={{ width:'100%', fontSize:13.5, padding:12, borderRadius:9, marginTop:18, opacity: loading ? .7 : 1 }}>
              {loading ? t('login.loggingIn') : t('login.submit')}
            </button>
            <div style={{ fontSize:12, color:'var(--text-2)', textAlign:'center', marginTop:14 }}>
              {t('login.noAccount')} <span onClick={() => nav('/register')} style={{ color:'var(--teal)', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>{t('login.createAccount')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
