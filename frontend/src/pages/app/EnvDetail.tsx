import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

type EnvStatus = 'Healthy' | 'Deploying' | 'Degraded';

const DATA: Record<string, Record<string, { status:EnvStatus; version:string; commit:string; head:string; started:string; author:string; hasUpdate:boolean }>> = {
  backend: {
    dev:     { status:'Healthy',   version:'v1.2.3', commit:'a3f5b8c', head:'v1.2.3', started:'2026-06-12 16:03', author:'john.doe', hasUpdate:false },
    staging: { status:'Deploying', version:'v1.2.2', commit:'c4d5e6f', head:'v1.2.3', started:'2026-06-12 16:00', author:'bob.johnson', hasUpdate:true },
    prod:    { status:'Healthy',   version:'v1.2.1', commit:'b2c4d5e', head:'v1.2.3', started:'2026-06-10 14:20', author:'jane.smith', hasUpdate:true },
  },
  frontend: {
    dev:     { status:'Healthy', version:'v3.0.1', commit:'d7e8f9a', head:'v3.0.1', started:'2026-06-11 10:00', author:'bob.johnson', hasUpdate:false },
    staging: { status:'Healthy', version:'v3.0.1', commit:'d7e8f9a', head:'v3.0.1', started:'2026-06-11 10:05', author:'bob.johnson', hasUpdate:false },
  },
};

function statusPill(s:EnvStatus) {
  const map = {
    'Healthy':   { bg:'rgba(52,199,89,.13)',  col:'#5dd57b', bord:'rgba(52,199,89,.24)',  dot:'#34C759' },
    'Deploying': { bg:'rgba(224,169,59,.13)', col:'#ecc26b', bord:'rgba(224,169,59,.26)', dot:'#E0A93B' },
    'Degraded':  { bg:'rgba(241,85,108,.13)', col:'#ff8497', bord:'rgba(241,85,108,.26)', dot:'#F1556C' },
  };
  return map[s];
}

export default function EnvDetail() {
  const { app='backend', env='dev' } = useParams<{ app:string; env:string }>();
  const nav = useNavigate();
  const [techOpen, setTechOpen] = useState(false);

  const d = DATA[app]?.[env] ?? DATA.backend.dev;
  const p = statusPill(d.status);
  const envLabel = env.toUpperCase();

  return (
    <div>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{app} / {envLabel}</div>
      <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:22 }}>
        <h1 style={{ fontSize:23, fontWeight:600, margin:0 }}>{app} <span style={{ color:'var(--text-3)' }}>/</span> {envLabel}</h1>
        <span style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 12px', borderRadius:999, fontSize:12, background:p.bg, color:p.col, border:`1px solid ${p.bord}` }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:p.dot, animation: d.status==='Deploying' ? 'ds-pulse 1.4s infinite' : 'none' }}></span>
          {d.status}
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:22 }}>
        {d.hasUpdate
          ? <button onClick={() => nav(`/app/${app}/${env}/deploy`)} className="btn-primary hover-bright" style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12.5, padding:'9px 16px', borderRadius:8 }}>
              <UpArrow /> {env==='prod' ? 'Pedir Deploy' : 'Deploy'}
            </button>
          : <span style={{ display:'inline-flex', alignItems:'center', gap:7, border:'1px dashed var(--border)', background:'transparent', color:'var(--text-3)', fontSize:12.5, padding:'9px 16px', borderRadius:8, cursor:'not-allowed' }}>
              <UpArrow /> Up to date
            </span>
        }
        <button onClick={() => nav(`/app/${app}/${env}/rollback`)} className="btn-secondary" style={{ fontSize:12.5, padding:'9px 16px', borderRadius:8 }}>
          {env==='prod' ? 'Pedir Rollback' : 'Rollback'}
        </button>
        <button onClick={() => nav(`/app/${app}/${env}/history` as never)} className="btn-ghost" style={{ fontSize:12.5, padding:'9px 16px', borderRadius:8, border:'1px solid var(--border)' }}>Histórico</button>
        <button onClick={() => setTechOpen(v=>!v)} className="btn-ghost" style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12.5, padding:'9px 16px', borderRadius:8, border:'1px solid var(--border)' }}>
          <span style={{ color:'var(--text-3)', fontSize:10 }}>{techOpen?'▼':'▶'}</span> Ver detalhes técnicos
        </button>
      </div>

      {techOpen && (
        <div style={{ display:'flex', gap:9, flexWrap:'wrap', margin:'-8px 0 22px', padding:'14px 16px', border:'1px solid var(--border-soft)', borderRadius:12, background:'var(--bg-2)' }}>
          <span className="mono" style={{ fontSize:10.5, color:'var(--text-3)', alignSelf:'center', marginRight:4 }}>debug ·</span>
          {[['Eventos',`/app/${app}/${env}/events`],['Logs',`/app/${app}/${env}/logs`],['Health Details',`/app/${app}/${env}/health`],['Pods',`/app/${app}/${env}/pods`]].map(([label,path]) => (
            <button key={label} onClick={() => nav(path)} className="btn-secondary" style={{ fontSize:12, padding:'7px 14px', borderRadius:8 }}>{label}</button>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Version card */}
        <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 22px' }}>
          <div style={{ fontSize:11, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:14 }}>Versão atual</div>
          <div style={{ display:'flex', flexDirection:'column', gap:11, fontSize:12.5 }}>
            {[['Version',d.version,'var(--teal)'],['Commit',d.commit,''],['HEAD ('+envLabel+')',d.head,''],['Started',d.started,''],['Autor',d.author,'']].map(([k,v,c]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--text-3)' }}>{k}</span>
                <span className="mono" style={{ color: c || 'inherit' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Health card */}
        <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 22px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={{ fontSize:11, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--text-3)' }}>Health</span>
            <span onClick={() => nav(`/app/${app}/${env}/health`)} style={{ fontSize:11.5, color:'var(--teal)', cursor:'pointer' }}>Ver health details →</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12, fontSize:12.5 }}>
            {d.status === 'Deploying' ? (
              <>
                <ProbeRow label="Startup probe"   state="checking" />
                <ProbeRow label="Readiness probe" state="waiting" />
                <ProbeRow label="Liveness probe"  state="pending" />
                <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:14, borderTop:'1px solid var(--border-soft)', paddingTop:12 }}>O novo pod ainda está a arrancar.</div>
              </>
            ) : (
              <>
                <ProbeRow label="Startup probe"   state="passing" />
                <ProbeRow label="Readiness probe" state="passing" />
                <ProbeRow label="Liveness probe"  state="passing" />
                <div style={{ fontSize:11.5, color:'var(--text-3)', marginTop:14, borderTop:'1px solid var(--border-soft)', paddingTop:12 }}>Sem erros recentes.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProbeRow({ label, state }: { label:string; state:'passing'|'checking'|'waiting'|'pending' }) {
  const icon = state==='passing'
    ? <span style={{ width:18, height:18, borderRadius:'50%', background:'rgba(52,199,89,.16)', border:'1.5px solid #34C759', display:'flex', alignItems:'center', justifyContent:'center', color:'#5dd57b', fontSize:10, flex:'none' }}>✓</span>
    : state==='checking'
    ? <span style={{ width:18, height:18, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--amber)', animation:'ds-spin .9s linear infinite', flex:'none' }}></span>
    : state==='waiting'
    ? <span style={{ width:18, height:18, borderRadius:'50%', border:'1.5px solid var(--border)', flex:'none' }}></span>
    : <span style={{ width:18, height:18, borderRadius:'50%', border:'1.5px dashed var(--border)', flex:'none' }}></span>;

  const statusCol = state==='passing' ? '#5dd57b' : state==='checking' ? '#ecc26b' : 'var(--text-3)';
  const statusLabel = state==='passing' ? 'Passing' : state==='checking' ? 'Checking…' : state==='waiting' ? 'Waiting' : '–';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      {icon}
      <span>{label}</span>
      <span style={{ marginLeft:'auto', color:statusCol }}>{statusLabel}</span>
    </div>
  );
}

function UpArrow() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M12 5L6.5 11M12 5L17.5 11" stroke="var(--teal-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
