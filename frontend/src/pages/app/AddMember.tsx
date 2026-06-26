import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Role = 'cloud' | 'tech' | 'dev';

const ROLES: { id:Role; label:string; desc:string }[] = [
  { id:'cloud', label:'Cloud Engineer', desc:'Acesso total: environments, team, settings, approvals e deploys.' },
  { id:'tech',  label:'Tech Lead',      desc:'Pode aprovar deploys para PROD e fazer deploy em todos os environments.' },
  { id:'dev',   label:'Developer',      desc:'Pode fazer deploy para DEV e STAGING. Pede aprovação para PROD.' },
];

export default function AddMember() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('dev');

  return (
    <div style={{ maxWidth:540 }}>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 6px' }}>Adicionar membro</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 24px', lineHeight:1.6 }}>
        O utilizador receberá um convite por email para se juntar à equipa.
      </p>

      <div style={{ marginBottom:20 }}>
        <label style={{ fontSize:12.5, color:'var(--text-2)', display:'block', marginBottom:7 }}>Email institucional</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="colaborador@horizonlabs.io"
          style={{ width:'100%', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 14px', color:'var(--text)', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
        />
      </div>

      <div style={{ marginBottom:24 }}>
        <label style={{ fontSize:12.5, color:'var(--text-2)', display:'block', marginBottom:10 }}>Role</label>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {ROLES.map(r => (
            <label key={r.id} htmlFor={`role-${r.id}`} style={{ display:'flex', alignItems:'flex-start', gap:13, padding:'14px 16px', border:`1px solid ${selectedRole===r.id ? 'rgba(43,199,180,.4)' : 'var(--border)'}`, borderRadius:11, cursor:'pointer', background: selectedRole===r.id ? 'rgba(43,199,180,.05)' : 'var(--surface)' }}>
              <input id={`role-${r.id}`} type="radio" name="role" value={r.id} checked={selectedRole===r.id} onChange={() => setSelectedRole(r.id)} style={{ marginTop:2, accentColor:'var(--teal)', flex:'none' }} />
              <div>
                <div style={{ fontSize:13.5, fontWeight:500 }}>{r.label}</div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginTop:3, lineHeight:1.5 }}>{r.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <button className="btn-primary hover-bright" onClick={() => nav('/app/team')} style={{ fontSize:13, padding:'10px 20px', borderRadius:9, fontWeight:600 }}>
          Enviar convite
        </button>
        <button onClick={() => nav('/app/team')} style={{ background:'transparent', border:'none', color:'var(--text-3)', fontSize:13, cursor:'pointer', padding:'10px 4px' }}>Cancelar</button>
      </div>
    </div>
  );
}
