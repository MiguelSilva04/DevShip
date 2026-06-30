import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, USERS, Role, userFromBackend } from '../context/UserContext';
import { login as apiLogin } from '../api/auth';
import { apiFetch } from '../api/client';

export default function Login() {
  const nav = useNavigate();
  const { setUser, saveToken } = useUser();
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function loginAs(role: Role) {
    setUser(USERS[role]);
    nav('/lobby');
  }

  async function submit() {
    if (!email || !pass) { setError('Preenche o email e a password.'); return; }
    setLoading(true);
    setError('');
    try {
      const { access_token } = await apiLogin(email, pass);
      saveToken(access_token);
      // Fetch user info from first team membership to determine role
      const teams = await apiFetch('/users/me/teams');
      if (teams.length > 0) {
        const t = teams[0];
        setUser(userFromBackend(email.split('@')[0], email, t.role));
      } else {
        setUser(userFromBackend(email.split('@')[0], email, 'DEVELOPER'));
      }
      nav('/lobby');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao entrar.');
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

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1px 1fr', gap:34, alignItems:'start', maxWidth:780, margin:'0 auto' }}>
          {/* Demo users */}
          <div>
            <div className="mono" style={{ fontSize:10.5, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:14 }}>Entrar como (demo)</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <DemoUserBtn name="Jane Smith"  email="jane.smith@horizonlabs.io"  initials="JS" role="Cloud Engineer" roleColor="var(--teal)"    roleBg="rgba(43,199,180,.12)" roleBord="rgba(43,199,180,.3)" onClick={() => loginAs('cloud')} />
              <DemoUserBtn name="John Doe"    email="john.doe@horizonlabs.io"    initials="JD" role="Tech Lead"      roleColor="#7fb6f9"         roleBg="rgba(77,156,246,.12)" roleBord="rgba(77,156,246,.3)" onClick={() => loginAs('tech')} />
              <DemoUserBtn name="Bob Johnson" email="bob.johnson@horizonlabs.io" initials="BJ" role="Developer"      roleColor="var(--text-2)"   roleBg="var(--surface-2)"     roleBord="var(--border)"       onClick={() => loginAs('dev')} />
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:14, lineHeight:1.6 }}>Cada utilizador abre a plataforma com a vista adaptada à sua role.</div>
          </div>

          <div style={{ background:'var(--border)', width:1, alignSelf:'stretch' }}></div>

          {/* Real credentials */}
          <div>
            <div className="mono" style={{ fontSize:10.5, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:14 }}>Ou com credenciais</div>
            <div style={{ marginBottom:15 }}>
              <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>Email</div>
              <input className="input-base input-mono" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane.smith@horizonlabs.io" onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>
            <div>
              <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>Password</div>
              <input className="input-base" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} />
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

function DemoUserBtn({ name, email, initials, role, roleColor, roleBg, roleBord, onClick }: {
  name:string; email:string; initials:string; role:string; roleColor:string; roleBg:string; roleBord:string; onClick:()=>void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display:'flex', alignItems:'center', gap:13, border:`1px solid ${hov ? 'var(--teal)' : 'var(--border)'}`, background: hov ? 'var(--surface-2)' : 'var(--surface)', borderRadius:12, padding:14, cursor:'pointer', textAlign:'left', color:'var(--text)', transition:'border-color .15s, background .15s' }}
    >
      <span style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flex:'none' }}>{initials}</span>
      <span style={{ flex:1 }}>
        <span style={{ fontSize:13.5, fontWeight:600, display:'block' }}>{name}</span>
        <span style={{ fontSize:11, color:'var(--text-3)' }}>{email}</span>
      </span>
      <span style={{ display:'inline-flex', padding:'3px 9px', borderRadius:6, fontSize:10.5, fontWeight:600, background:roleBg, color:roleColor, border:`1px solid ${roleBord}` }}>{role}</span>
    </button>
  );
}
