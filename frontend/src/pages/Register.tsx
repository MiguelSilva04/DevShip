import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, USERS } from '../context/UserContext';

const KNOWN_DOMAINS = ['horizonlabs.io', 'acme.io', 'devship.io', 'engineering.co', 'novastartup.io'];

export default function Register() {
  const nav  = useNavigate();
  const { setUser } = useUser();
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [submitted, setSubmitted] = useState(false);

  const domain = email.includes('@') ? email.split('@')[1] : '';
  const emailKnown = domain ? KNOWN_DOMAINS.includes(domain) : false;

  const nameErr  = submitted && !name.trim();
  const emailErr = submitted && !email.includes('@');
  const passErr  = submitted && pass.length < 8;

  function submit() {
    setSubmitted(true);
    if (!name.trim() || !email.includes('@') || pass.length < 8) return;
    if (emailKnown) return; // show "domain taken" state
    setUser({ ...USERS.cloud, name });
    nav('/onboarding');
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
            <input className={`input-base ${nameErr ? '' : ''}`} value={name} onChange={e => setName(e.target.value)} placeholder="Maria Santos"
              style={{ borderColor: nameErr ? 'var(--red)' : undefined }} />
            {nameErr && <div style={{ fontSize:11.5, color:'var(--red)', marginTop:6 }}>⚠ O nome é obrigatório.</div>}
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>Email</div>
            <input className="input-base input-mono" value={email} onChange={e => setEmail(e.target.value)} placeholder="sofia@novastartup.io"
              style={{ borderColor: emailErr ? 'var(--red)' : undefined }} />
            {emailErr && <div style={{ fontSize:11.5, color:'var(--red)', marginTop:6 }}>⚠ Email inválido.</div>}
            {!emailErr && emailKnown && <div style={{ fontSize:11.5, color:'#ecc26b', marginTop:6 }}>⚠ Este domínio já pertence a uma equipa — vais pedir para ser adicionado.</div>}
          </div>
          <div>
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:7 }}>Password</div>
            <input className="input-base" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••"
              style={{ borderColor: passErr ? 'var(--red)' : undefined }} />
            {passErr && <div style={{ fontSize:11.5, color:'var(--red)', marginTop:6 }}>⚠ Mínimo 8 caracteres.</div>}
          </div>
        </div>

        {submitted && emailKnown && (
          <div style={{ display:'flex', gap:12, border:'1px solid rgba(224,169,59,.3)', background:'rgba(224,169,59,.08)', borderRadius:12, padding:'14px 16px', marginTop:14 }}>
            <span style={{ color:'#ecc26b' }}>⚠</span>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#f0cf86' }}>Este domínio já tem uma equipa</div>
              <div style={{ fontSize:12, color:'var(--text-2)', marginTop:3, lineHeight:1.5 }}>O domínio <span className="mono" style={{ color:'var(--text)' }}>{domain}</span> já está associado a uma Team. Pede ao Cloud Engineer dessa equipa para te adicionar.</div>
            </div>
          </div>
        )}

        {!emailKnown && (
          <button onClick={submit} className="btn-primary hover-bright" style={{ width:'100%', fontSize:14, padding:13, borderRadius:10, marginTop:18 }}>Criar conta →</button>
        )}

        <div style={{ fontSize:12, color:'var(--text-2)', textAlign:'center', marginTop:14 }}>
          Já tens conta? <span onClick={() => nav('/login')} style={{ color:'var(--teal)', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>Entrar</span>
        </div>
        <div className="mono" style={{ fontSize:10, color:'var(--text-3)', textAlign:'center', marginTop:18, lineHeight:1.7 }}>
          domínio novo → sofia@novastartup.io (cria Team) · existente → carlos@horizonlabs.io (pede para ser adicionado)
        </div>
      </div>
    </div>
  );
}
