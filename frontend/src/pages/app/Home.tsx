import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

const APPS = [
  { id:'backend',  repo:'github.com/company/backend',  envs:[
    { id:'dev',     label:'DEV',     status:'Healthy',    version:'v1.2.3', upToDate:true },
    { id:'staging', label:'STAGING', status:'Deploying',  version:'v1.2.2 → v1.2.3', upToDate:false },
    { id:'prod',    label:'PROD',    status:'Healthy',    version:'v1.2.1', upToDate:false },
  ]},
  { id:'frontend', repo:'github.com/company/frontend', envs:[
    { id:'dev',     label:'DEV',     status:'Healthy',    version:'v3.0.1', upToDate:true },
    { id:'staging', label:'STAGING', status:'Healthy',    version:'v3.0.1', upToDate:true },
  ]},
];

function statusPill(s:string) {
  const map: Record<string,{bg:string;col:string;bord:string;dot:string}> = {
    'Healthy':   { bg:'rgba(52,199,89,.13)',  col:'#5dd57b', bord:'rgba(52,199,89,.24)',   dot:'#34C759' },
    'Deploying': { bg:'rgba(224,169,59,.13)', col:'#ecc26b', bord:'rgba(224,169,59,.26)',  dot:'#E0A93B' },
    'Degraded':  { bg:'rgba(241,85,108,.13)', col:'#ff8497', bord:'rgba(241,85,108,.26)',  dot:'#F1556C' },
  };
  return map[s] ?? map['Healthy'];
}

function envBadge(s:string) {
  const p = statusPill(s);
  return { bg: s==='Deploying'?'rgba(224,169,59,.08)':'var(--bg)', bord: s==='Deploying'?'rgba(224,169,59,.3)':'var(--border)', col: s==='Deploying'?'#ecc26b':'var(--text-2)', dot: p.dot };
}

export default function Home() {
  const nav = useNavigate();
  const { user } = useUser();
  const [open, setOpen] = useState<Record<string,boolean>>({ backend:true, frontend:false });
  const [picker, setPicker] = useState<Record<string,boolean>>({});

  function toggleApp(id:string) { setOpen(p => ({ ...p, [id]: !p[id] })); }
  function togglePicker(id:string) { setPicker(p => ({ ...p, [id]: !p[id] })); }

  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:'-.01em', margin:'0 0 18px' }}>Overview</h1>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:13, marginBottom:26 }}>
        <StatCard label="Total App Environments" value="5" />
        <StatCard label="Healthy" value="4" valueColor="#5dd57b" />
        <StatCard label="Degraded" value="1" valueColor="#ff8497" sub="Needs attention" highlight />
        <StatCard label="Deploys hoje" value="3" />
      </div>

      <h2 style={{ fontSize:15, fontWeight:600, margin:'0 0 13px' }}>Applications</h2>

      {APPS.map(app => (
        <div key={app.id} style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden', marginBottom:12 }}>
          {/* Header row */}
          <button onClick={() => toggleApp(app.id)} style={{ display:'flex', alignItems:'center', gap:13, width:'100%', background:'transparent', border:'none', cursor:'pointer', padding:'16px 18px', textAlign:'left', color:'var(--text)' }}>
            <span style={{ color:'var(--text-3)', fontSize:12, width:12 }}>{open[app.id] ? '▼' : '▶'}</span>
            <span style={{ fontSize:14.5, fontWeight:600 }}>{app.id}</span>
            <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{app.repo}</span>
            <span style={{ marginLeft:'auto', display:'flex', gap:6 }}>
              {app.envs.map(env => {
                const b = envBadge(env.status);
                return (
                  <span key={env.id} className="mono" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:10.5, padding:'3px 9px', borderRadius:6, background:b.bg, border:`1px solid ${b.bord}`, color:b.col }}>
                    <span style={{ width:5, height:5, borderRadius:'50%', background:b.dot, animation: env.status==='Deploying' ? 'ds-pulse 1.4s infinite' : 'none' }}></span>
                    {env.label}
                  </span>
                );
              })}
            </span>
          </button>

          {/* Expanded env rows */}
          {open[app.id] && (
            <div style={{ borderTop:'1px solid var(--border-soft)' }}>
              {app.envs.map((env, i) => {
                const p = statusPill(env.status);
                return (
                  <button key={env.id} onClick={() => nav(`/app/${app.id}/${env.id}`)}
                    style={{ display:'flex', alignItems:'center', gap:15, width:'100%', background:'transparent', border:'none', borderBottom: i < app.envs.length-1 ? '1px solid var(--border-soft)' : 'none', cursor:'pointer', padding:'13px 18px', textAlign:'left', color:'var(--text)' }}
                    className="hover-surface2"
                  >
                    <span className="mono" style={{ fontSize:12, width:72, color:'var(--text-2)' }}>{env.label}</span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'4px 10px', borderRadius:999, fontSize:11, background:p.bg, color:p.col, border:`1px solid ${p.bord}` }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:p.dot, animation: env.status==='Deploying' ? 'ds-pulse 1.4s infinite' : 'none' }}></span>
                      {env.status}
                    </span>
                    <span className="mono" style={{ fontSize:12, color: env.status==='Deploying' ? 'var(--text-2)' : 'var(--teal)' }}>{env.version}</span>
                    <span style={{ marginLeft:'auto', color:'var(--text-3)', fontSize:13 }}>→</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Deploy bar */}
          <div style={{ borderTop:'1px solid var(--border-soft)', padding:'11px 18px', display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => togglePicker(app.id)} style={{ display:'inline-flex', alignItems:'center', gap:7, border:'1px solid rgba(43,199,180,.3)', background:'rgba(43,199,180,.08)', color:'var(--teal)', fontWeight:600, fontSize:12, padding:'7px 14px', borderRadius:8, cursor:'pointer' }}
              className="hover-bright">
              <DeployIcon />Deploy
            </button>
            {picker[app.id] ? (
              <>
                <span style={{ fontSize:11.5, color:'var(--text-3)' }}>para:</span>
                {app.envs.map(env => (
                  <button key={env.id} onClick={() => nav(`/app/${app.id}/${env.id}/deploy`)}
                    disabled={env.upToDate}
                    className="mono"
                    style={{ fontSize:11.5, border:'1px solid var(--border)', background: env.upToDate ? 'transparent' : 'var(--bg)', color: env.upToDate ? 'var(--text-3)' : 'var(--text)', padding:'6px 12px', borderRadius:7, cursor: env.upToDate ? 'not-allowed' : 'pointer', borderStyle: env.upToDate ? 'dashed' : 'solid' }}>
                    {env.label}{env.upToDate ? ' · up to date' : ''}
                  </button>
                ))}
              </>
            ) : (
              <span style={{ fontSize:11.5, color:'var(--text-3)' }}>Escolhe o environment de destino</span>
            )}
            <button onClick={() => nav(`/app/${app.id}`)} className="btn-ghost" style={{ marginLeft:'auto', fontSize:12, padding:'6px 8px', borderRadius:7 }}>Ver app →</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, valueColor, sub, highlight }: { label:string; value:string; valueColor?:string; sub?:string; highlight?:boolean }) {
  return (
    <div style={{ border:`1px solid ${highlight ? 'rgba(241,85,108,.3)' : 'var(--border)'}`, borderRadius:13, background: highlight ? 'linear-gradient(180deg,rgba(241,85,108,.07),var(--surface))' : 'var(--surface)', padding:'16px 18px' }}>
      <div style={{ fontSize:11.5, color: highlight ? '#ff8497' : 'var(--text-2)' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap:8, marginTop:10 }}>
        <span className="mono" style={{ fontSize:28, fontWeight:600, color: valueColor ?? 'var(--text)' }}>{value}</span>
        {sub && <span style={{ fontSize:10.5, color:'#ff8497' }}>{sub}</span>}
      </div>
    </div>
  );
}

function DeployIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flex:'none' }}><path d="M12 5V19M12 5L6.5 11M12 5L17.5 11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
