import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, userFromBackend } from '../context/UserContext';
import { login as apiLogin } from '../api/auth';
import { apiFetch } from '../api/client';

export default function Login() {
  const nav = useNavigate();
  const { setUser, saveToken } = useUser();
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function translateError(msg: string): string {
    if (msg.includes('Invalid credentials') || msg.includes('401')) return 'Email ou password incorretos.';
    if (msg.includes('Sessão expirada')) return msg;
    return msg;
  }

  async function submit() {
    if (!email || !pass) { setError('Preenche o email e a password.'); return; }
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
      setError(translateError(e instanceof Error ? e.message : 'Erro ao entrar.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'60px 26px 90px' }}>
        <div style={{ maxWidth:780, margin:'0 auto 18px' }}>
          <span onClick={() => nav('/')} className="btn-ghost" style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12.5, borderRadius:7, padding:'4px 8px' }}>← Voltar à página inicial</span>
        </div>
        <div style={{ textAlign:'center', marginBottom:30 }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:52, height:52, display:'block', margin:'0 auto 14px' }} />
          <div style={{ fontSize:23, fontWeight:600, letterSpacing:'-.01em' }}>Entrar na DevShip</div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginTop:6 }}>Internal Developer Platform · Kubernetes · AWS EKS · GitOps</div>
        </div>

        <div style={{ maxWidth:380, margin:'0 auto' }}>
          <div>
            <div style={{ marginBottom:15 }}>
              <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>Email</div>
              <input className="input-base input-mono" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com" onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>
            <div>
              <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>Password</div>
              <div style={{ position:'relative' }}>
                <input className="input-base" type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} style={{ paddingRight:40 }} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:13, padding:0 }}>{showPass ? '🙈' : '👁'}</button>
              </div>
            </div>
            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:9, border:'1px solid rgba(241,85,108,.3)', background:'rgba(241,85,108,.08)', borderRadius:9, padding:'10px 13px', marginTop:14 }}>
                <span style={{ color:'#ff8497' }}>✕</span>
                <span style={{ fontSize:12, color:'#ff9aaa' }}>{error}</span>
              </div>
            )}
            <button onClick={submit} disabled={loading} className="btn-primary hover-bright" style={{ width:'100%', fontSize:13.5, padding:12, borderRadius:9, marginTop:18, opacity: loading ? .7 : 1 }}>
              {loading ? 'A entrar…' : 'Entrar →'}
            </button>
            <div style={{ fontSize:12, color:'var(--text-2)', textAlign:'center', marginTop:14 }}>
              Sem conta? <span onClick={() => nav('/register')} style={{ color:'var(--teal)', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>Criar conta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
