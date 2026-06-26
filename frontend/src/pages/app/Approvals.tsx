import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

const PENDING = [
  { id:'apr-001', app:'backend', env:'PROD', from:'v1.2.1', to:'v1.2.3', commit:'a3f5b8c', requestedBy:'bob.johnson', requestedAt:'2026-06-12 16:05', note:'Hotfix urgente para o bug de 500s na autenticação.' },
  { id:'apr-002', app:'backend', env:'PROD', from:'v1.2.1', to:'v1.2.2', commit:'c4d5e6f', requestedBy:'john.doe',    requestedAt:'2026-06-11 09:30', note:'' },
  { id:'apr-003', app:'frontend', env:'PROD', from:'v2.9.8', to:'v3.0.1', commit:'d7e8f9a', requestedBy:'bob.johnson', requestedAt:'2026-06-10 14:00', note:'Major version com redesign da UI.' },
];

const RESOLVED = [
  { id:'apr-004', app:'backend', env:'PROD', from:'v1.2.0', to:'v1.2.1', commit:'b2c4d5e', requestedBy:'john.doe', resolvedBy:'jane.smith', resolvedAt:'2026-06-10 14:15', status:'Approved' as const },
  { id:'apr-005', app:'frontend', env:'PROD', from:'v2.9.7', to:'v2.9.8', commit:'e1f2a3b', requestedBy:'bob.johnson', resolvedBy:'jane.smith', resolvedAt:'2026-06-08 10:00', status:'Rejected' as const },
];

export default function Approvals() {
  const nav = useNavigate();
  const { user } = useUser();
  const canDecide = user?.role === 'tech' || user?.role === 'cloud';

  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:'-.01em', margin:'0 0 6px' }}>Approvals</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 24px' }}>
        {canDecide ? 'Pedidos que aguardam a tua decisão.' : 'Pedidos de deploy para PROD que tu submeteste.'}
      </p>

      {/* Pending */}
      <h2 style={{ fontSize:14, fontWeight:600, margin:'0 0 11px', color:'#ecc26b' }}>Pending <span style={{ background:'rgba(224,169,59,.15)', color:'#ecc26b', fontSize:11, padding:'1px 7px', borderRadius:9, marginLeft:6 }}>{PENDING.length}</span></h2>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
        {PENDING.map(a => (
          <div key={a.id} style={{ border:'1px solid rgba(224,169,59,.25)', borderRadius:13, background:'var(--surface)', padding:'17px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:10 }}>
              <span className="mono" style={{ fontWeight:600, fontSize:13 }}>{a.app}</span>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'rgba(43,199,180,.1)', color:'var(--teal)', border:'1px solid rgba(43,199,180,.28)' }}>{a.env}</span>
              <span className="mono" style={{ fontSize:12, color:'var(--text-2)' }}>{a.from} → {a.to}</span>
              <span className="mono" style={{ fontSize:11, color:'var(--text-3)', marginLeft:'auto' }}>{a.commit}</span>
            </div>
            {a.note && <p style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.5, margin:'0 0 12px', fontStyle:'italic' }}>"{a.note}"</p>}
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <span style={{ fontSize:11.5, color:'var(--text-3)' }}>por <span style={{ color:'var(--text-2)' }}>{a.requestedBy}</span> · {a.requestedAt}</span>
              {canDecide && (
                <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
                  <button onClick={() => nav(`/app/${a.app}/${a.env.toLowerCase()}/approval`)} className="btn-primary" style={{ fontSize:12, padding:'7px 14px', borderRadius:8 }}>Aprovar</button>
                  <button onClick={() => nav(`/app/${a.app}/${a.env.toLowerCase()}/approval`)} style={{ fontSize:12, padding:'7px 14px', borderRadius:8, background:'rgba(241,85,108,.1)', border:'1px solid rgba(241,85,108,.3)', color:'#ff8497', cursor:'pointer' }}>Rejeitar</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Resolved */}
      <h2 style={{ fontSize:14, fontWeight:600, margin:'0 0 11px', color:'var(--text-2)' }}>Histórico</h2>
      <div style={{ border:'1px solid var(--border)', borderRadius:13, background:'var(--surface)', overflow:'hidden' }}>
        {RESOLVED.map((a, i) => (
          <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 20px', borderBottom: i < RESOLVED.length-1 ? '1px solid var(--border-soft)' : 'none', flexWrap:'wrap', fontSize:12.5 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 9px', borderRadius:999, fontSize:11,
              background: a.status==='Approved' ? 'rgba(52,199,89,.12)' : 'rgba(241,85,108,.12)',
              color: a.status==='Approved' ? '#5dd57b' : '#ff8497',
              border: a.status==='Approved' ? '1px solid rgba(52,199,89,.24)' : '1px solid rgba(241,85,108,.26)' }}>
              {a.status==='Approved' ? '✓' : '✕'} {a.status}
            </span>
            <span className="mono" style={{ fontWeight:600 }}>{a.app}</span>
            <span style={{ fontSize:11, padding:'2px 7px', borderRadius:6, background:'rgba(43,199,180,.07)', color:'var(--teal)', border:'1px solid rgba(43,199,180,.2)' }}>{a.env}</span>
            <span className="mono" style={{ fontSize:12, color:'var(--text-2)' }}>{a.from} → {a.to}</span>
            <span style={{ marginLeft:'auto', fontSize:11.5, color:'var(--text-3)' }}>
              {a.requestedBy} · aprovado por {a.resolvedBy} · {a.resolvedAt}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
