import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

const COMMITS = [
  { sha:'a3f5b8c', msg:'fix: handle null pointer in auth middleware', author:'john.doe', date:'2026-06-12 15:47', tag:'v1.2.3', current:false },
  { sha:'c4d5e6f', msg:'feat: add retry logic to external API calls',  author:'bob.johnson', date:'2026-06-11 10:20', tag:null, current:false },
  { sha:'b2c4d5e', msg:'refactor: extract service layer from handlers', author:'john.doe', date:'2026-06-10 09:05', tag:null, current:true },
  { sha:'d7e8f9a', msg:'chore: bump dependencies',                     author:'jane.smith', date:'2026-06-09 17:33', tag:null, current:false },
];

export default function Deploy() {
  const { app='backend', env='dev' } = useParams<{ app:string; env:string }>();
  const nav = useNavigate();
  const { user } = useUser();
  const isProd = env === 'prod';
  const needsApproval = isProd;
  const [selected, setSelected] = useState('a3f5b8c');
  const [note, setNote] = useState('');

  return (
    <div style={{ maxWidth:720 }}>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{app} / {env.toUpperCase()} / deploy</div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 4px' }}>
        {needsApproval ? 'Pedir aprovação de deploy' : 'Deploy'} — <span style={{ color:'var(--text-2)' }}>{env.toUpperCase()}</span>
      </h1>
      {needsApproval && (
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 13px', border:'1px solid rgba(224,169,59,.35)', borderRadius:9, background:'rgba(224,169,59,.07)', fontSize:12, color:'#ecc26b', margin:'10px 0 18px' }}>
          <span>⚠</span> PROD requer aprovação de um Tech Lead antes de executar.
        </div>
      )}

      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden', marginBottom:16 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border-soft)', fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
          Escolhe o commit de destino
        </div>
        {COMMITS.map((c, i) => (
          <label key={c.sha} htmlFor={`commit-${c.sha}`} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 20px', cursor:'pointer', borderBottom: i < COMMITS.length-1 ? '1px solid var(--border-soft)' : 'none', background: selected===c.sha ? 'rgba(43,199,180,.04)' : 'transparent' }}>
            <input id={`commit-${c.sha}`} type="radio" name="commit" value={c.sha} checked={selected===c.sha} onChange={() => setSelected(c.sha)} style={{ marginTop:3, accentColor:'var(--teal)', flex:'none' }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, flexWrap:'wrap' }}>
                <span className="mono" style={{ fontSize:12.5, color:'var(--text)' }}>{c.msg}</span>
                {c.tag && <span style={{ fontSize:10.5, padding:'2px 7px', borderRadius:6, background:'rgba(43,199,180,.12)', color:'var(--teal)', border:'1px solid rgba(43,199,180,.28)', fontWeight:600 }}>{c.tag}</span>}
                {c.current && <span style={{ fontSize:10.5, padding:'2px 7px', borderRadius:6, background:'var(--bg)', color:'var(--text-3)', border:'1px solid var(--border)', fontWeight:500 }}>current</span>}
              </div>
              <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginTop:4, display:'flex', gap:13 }}>
                <span>{c.sha}</span><span>{c.author}</span><span>{c.date}</span>
              </div>
            </div>
          </label>
        ))}
      </div>

      {needsApproval && (
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12.5, color:'var(--text-2)', display:'block', marginBottom:7 }}>Nota para o Tech Lead <span style={{ color:'var(--text-3)' }}>(opcional)</span></label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Descreve o motivo deste deploy…" rows={3} style={{ width:'100%', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 14px', color:'var(--text)', fontSize:13, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
        </div>
      )}

      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <button
          className="btn-primary hover-bright"
          onClick={() => nav(needsApproval ? `/app/${app}/${env}/approval` : `/app/${app}/${env}/exec`)}
          style={{ fontSize:13, padding:'10px 20px', borderRadius:9, fontWeight:600 }}
        >
          {needsApproval ? 'Enviar pedido de aprovação' : 'Confirmar deploy'}
        </button>
        <button onClick={() => nav(-1)} style={{ background:'transparent', border:'none', color:'var(--text-3)', fontSize:13, cursor:'pointer', padding:'10px 4px' }}>Cancelar</button>
        <span style={{ marginLeft:'auto', fontSize:11.5, color:'var(--text-3)' }}>
          A fazer deploy como <span style={{ color:'var(--text-2)' }}>{user?.name ?? '—'}</span>
        </span>
      </div>
    </div>
  );
}
