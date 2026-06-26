import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

const HISTORY = [
  { sha:'b2c4d5e', version:'v1.2.1', msg:'refactor: extract service layer', author:'john.doe',   date:'2026-06-10 14:20', current:false },
  { sha:'9a1b2c3', version:'v1.2.0', msg:'feat: add bulk import endpoint',  author:'bob.johnson', date:'2026-06-08 11:05', current:false },
  { sha:'7f8e9d0', version:'v1.1.9', msg:'fix: race condition in session',  author:'john.doe',    date:'2026-06-05 09:30', current:false },
];

export default function Rollback() {
  const { app='backend', env='prod' } = useParams<{ app:string; env:string }>();
  const nav = useNavigate();
  const { user } = useUser();
  const isProd = env === 'prod';
  const needsApproval = isProd;

  return (
    <div style={{ maxWidth:660 }}>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{app} / {env.toUpperCase()} / rollback</div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 4px' }}>Rollback — <span style={{ color:'var(--text-2)' }}>{env.toUpperCase()}</span></h1>

      {needsApproval && (
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 13px', border:'1px solid rgba(224,169,59,.35)', borderRadius:9, background:'rgba(224,169,59,.07)', fontSize:12, color:'#ecc26b', margin:'10px 0 18px' }}>
          <span>⚠</span> PROD requer aprovação de um Tech Lead para rollback.
        </div>
      )}

      {/* Current version */}
      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'18px 22px', marginBottom:14 }}>
        <div style={{ fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:12 }}>Versão atual (FROM)</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <span className="mono" style={{ fontSize:16, fontWeight:600, color:'var(--teal)' }}>v1.2.3</span>
          <span className="mono" style={{ fontSize:12, color:'var(--text-2)' }}>a3f5b8c</span>
          <span style={{ fontSize:12, color:'var(--text-3)' }}>john.doe · 2026-06-12 15:47</span>
        </div>
        <div className="mono" style={{ fontSize:12.5, color:'var(--text-2)', marginTop:6 }}>fix: handle null pointer in auth middleware</div>
      </div>

      {/* Target version */}
      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden', marginBottom:16 }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border-soft)', fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
          Escolhe a versão para reverter (TO)
        </div>
        {HISTORY.map((h, i) => (
          <label key={h.sha} htmlFor={`rb-${h.sha}`} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 20px', cursor:'pointer', borderBottom: i < HISTORY.length-1 ? '1px solid var(--border-soft)' : 'none' }}>
            <input id={`rb-${h.sha}`} type="radio" name="target" defaultChecked={i===0} style={{ marginTop:3, accentColor:'var(--teal)', flex:'none' }} />
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span className="mono" style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{h.version}</span>
                <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{h.sha}</span>
              </div>
              <div className="mono" style={{ fontSize:12.5, color:'var(--text-2)', marginTop:3 }}>{h.msg}</div>
              <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{h.author} · {h.date}</div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <button
          className="btn-primary hover-bright"
          onClick={() => nav(`/app/${app}/${env}/exec`)}
          style={{ fontSize:13, padding:'10px 20px', borderRadius:9, fontWeight:600, background:'rgba(241,85,108,.15)', color:'#ff8497', border:'1px solid rgba(241,85,108,.35)' }}
        >
          {needsApproval ? 'Enviar pedido de rollback' : 'Confirmar rollback'}
        </button>
        <button onClick={() => nav(-1)} style={{ background:'transparent', border:'none', color:'var(--text-3)', fontSize:13, cursor:'pointer', padding:'10px 4px' }}>Cancelar</button>
        <span style={{ marginLeft:'auto', fontSize:11.5, color:'var(--text-3)' }}>
          Como <span style={{ color:'var(--text-2)' }}>{user?.name ?? '—'}</span>
        </span>
      </div>
    </div>
  );
}
