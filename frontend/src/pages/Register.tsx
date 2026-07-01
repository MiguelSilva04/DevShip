import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register as apiRegister } from '../api/auth';

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function passwordError(p: string): string {
  if (p.length < 8)          return 'A password deve ter no mínimo 8 caracteres.';
  if (!/[A-Z]/.test(p))      return 'A password deve ter pelo menos uma letra maiúscula.';
  if (!/[a-z]/.test(p))      return 'A password deve ter pelo menos uma letra minúscula.';
  if (!/\d/.test(p))         return 'A password deve ter pelo menos um número.';
  if (!/[^A-Za-z\d]/.test(p)) return 'A password deve ter pelo menos um carácter especial.';
  return '';
}

function translateError(msg: string): string {
  if (msg.includes('Email already registered') || msg.includes('409')) return 'Este email já está registado.';
  if (msg.includes('401') || msg.includes('Invalid')) return 'Credenciais inválidas.';
  return msg;
}

export default function Register() {
  const nav  = useNavigate();
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passErr = pass ? passwordError(pass) : '';
  const passOk  = PASSWORD_RE.test(pass);
  const [showPass, setShowPass] = useState(false);

  async function submit() {
    if (!name.trim()) { setError('Preenche o nome.'); return; }
    if (!email.includes('@')) { setError('Email inválido.'); return; }
    const pe = passwordError(pass);
    if (pe) { setError(pe); return; }
    setLoading(true);
    setError('');
    try {
      await apiRegister(name, email, pass);
      nav('/login');
    } catch (e: unknown) {
      setError(translateError(e instanceof Error ? e.message : 'Erro ao criar conta.'));
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
            <div style={{ position:'relative' }}>
              <input className="input-base" type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} style={{ paddingRight:40 }} />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:13, padding:0 }}>{showPass ? '🙈' : '👁'}</button>
            </div>
            {pass && (
              <div style={{ marginTop:8 }}>
                <div style={{ display:'flex', gap:4, marginBottom:5 }}>
                  {(['[A-Z]','[a-z]','\\d','[^A-Za-z\\d]','.{8,}'] as const).map((re, i) => (
                    <div key={i} style={{ flex:1, height:3, borderRadius:99, background: new RegExp(re).test(pass) ? 'var(--teal)' : 'var(--border)' }} />
                  ))}
                </div>
                {passErr && <div style={{ fontSize:11, color: passOk ? '#5dd57b' : '#ecc26b' }}>{passErr}</div>}
                {passOk  && <div style={{ fontSize:11, color:'#5dd57b' }}>Password válida ✓</div>}
              </div>
            )}
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
