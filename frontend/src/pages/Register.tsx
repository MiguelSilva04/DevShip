import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register as apiRegister } from '../api/auth';

export default function Register() {
  const nav  = useNavigate();
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim() || !email.includes('@') || pass.length < 8) {
      setError('Preenche todos os campos. Password mínimo 8 caracteres.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiRegister(name, email, pass);
      nav('/login');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <div style={{ maxWidth:480, margin:'0 auto', padding:'54px 26px 90px' }}>
        <div style={{ marginBottom:18 }}>
          <span onClick={() => nav('/')} className="btn-ghost" style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12.5, borderRadius:7, padding:'4px 8px' }}>← Voltar à página inicial</span>
        </div>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:46, height:46, display:'block', margin:'0 auto 13px' }} />
          <div style={{ fontSize:21, fontWeight:600 }}>Criar conta</div>
          <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:5 }}>Regista-te para começar a usar a DevShip.</div>
        </div>

        <div style={{ display:'flex', gap:11, border:'1px solid rgba(77,156,246,.28)', background:'rgba(77,156,246,.08)', borderRadius:12, padding:'13px 15px', marginBottom:14 }}>
          <span style={{ color:'#7fb6f9' }}>ⓘ</span>
          <span style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.6 }}>O teu <span style={{ color:'var(--text)' }}>domínio de email</span> define a tua equipa. Se o domínio ainda não existe na plataforma, crias uma Team e tornas-te <span style={{ color:'var(--teal)' }}>Cloud Engineer</span>. Se já existe, pedes para seres adicionado por quem a gere.</span>
        </div>

        <div style={{ border:'1px solid var(--border)', borderRadius:16, background:'var(--surface)', padding:24 }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>Nome completo</div>
            <input className="input-base" value={name} onChange={e => setName(e.target.value)} placeholder="Maria Santos" />
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>Email</div>
            <input className="input-base input-mono" value={email} onChange={e => setEmail(e.target.value)} placeholder="sofia@novastartup.io" />
          </div>
          <div>
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>Password</div>
            <input className="input-base" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
        </div>

        {error && (
          <div style={{ display:'flex', gap:9, border:'1px solid rgba(241,85,108,.3)', background:'rgba(241,85,108,.08)', borderRadius:12, padding:'13px 15px', marginTop:14 }}>
            <span style={{ color:'#ff8497' }}>✕</span>
            <span style={{ fontSize:12, color:'#ff9aaa', lineHeight:1.5 }}>{error}</span>
          </div>
        )}

        <button onClick={submit} disabled={loading} className="btn-primary hover-bright" style={{ width:'100%', fontSize:14, padding:13, borderRadius:10, marginTop:18, opacity: loading ? .7 : 1 }}>
          {loading ? 'A criar conta…' : 'Criar conta →'}
        </button>

        <div style={{ fontSize:12, color:'var(--text-2)', textAlign:'center', marginTop:14 }}>
          Já tens conta? <span onClick={() => nav('/login')} style={{ color:'var(--teal)', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>Entrar</span>
        </div>
        <div className="mono" style={{ fontSize:10, color:'var(--text-3)', textAlign:'center', marginTop:18, lineHeight:1.7 }}>
          domínio novo → cria Team · domínio existente → conta criada, aguarda ser adicionado
        </div>
      </div>
    </div>
  );
}
