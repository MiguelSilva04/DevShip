import { useParams, useNavigate } from 'react-router-dom';

const STEPS = [
  { label:'Pull image',             status:'done',    duration:'1.2s' },
  { label:'Stop old containers',    status:'done',    duration:'0.4s' },
  { label:'Apply manifests',        status:'done',    duration:'0.9s' },
  { label:'Wait pod ready',         status:'running', duration:null },
  { label:'Run health checks',      status:'pending', duration:null },
  { label:'Promote traffic',        status:'pending', duration:null },
  { label:'Cleanup old resources',  status:'pending', duration:null },
];

const LOG_LINES = [
  { t:'16:03:01', l:'INFO',  m:'Starting deployment pipeline for backend v1.2.3' },
  { t:'16:03:01', l:'INFO',  m:'Pulling image horizonlabs/backend:a3f5b8c' },
  { t:'16:03:02', l:'INFO',  m:'Image pulled successfully (cached layer hit)' },
  { t:'16:03:02', l:'INFO',  m:'Stopping containers: backend-6c8f9b4d5-xkp7q' },
  { t:'16:03:03', l:'INFO',  m:'Container stopped' },
  { t:'16:03:03', l:'INFO',  m:'Applying Kubernetes manifests...' },
  { t:'16:03:04', l:'INFO',  m:'Deployment updated: backend (1 → 1 replicas)' },
  { t:'16:03:04', l:'INFO',  m:'Waiting for pod to reach Running state...' },
  { t:'16:03:05', l:'WARN',  m:'Startup probe not yet passing (attempt 1/10)' },
  { t:'16:03:07', l:'WARN',  m:'Startup probe not yet passing (attempt 2/10)' },
];

export default function Execution() {
  const { app='backend', env='dev' } = useParams<{ app:string; env:string }>();
  const nav = useNavigate();
  const done = STEPS.filter(s => s.status==='done').length;
  const pct = Math.round((done / STEPS.length) * 100);

  return (
    <div>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{app} / {env.toUpperCase()} / execução</div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:22 }}>
        <h1 style={{ fontSize:22, fontWeight:600, margin:0 }}>Execução do Deploy</h1>
        <span style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 12px', borderRadius:999, fontSize:12, background:'rgba(224,169,59,.12)', color:'#ecc26b', border:'1px solid rgba(224,169,59,.28)' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#E0A93B', animation:'ds-pulse 1.4s infinite' }}></span>
          Em curso
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-2)', marginBottom:7 }}>
          <span>{done} / {STEPS.length} steps concluídos</span>
          <span className="mono">{pct}%</span>
        </div>
        <div style={{ height:6, borderRadius:99, background:'var(--surface)', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'var(--teal)', borderRadius:99, transition:'width .3s' }} />
        </div>
      </div>

      {/* Steps */}
      <div style={{ display:'flex', flexDirection:'column', gap:0, border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden', marginBottom:18 }}>
        {STEPS.map((s, i) => {
          const icon = s.status==='done'
            ? <span style={{ width:22, height:22, borderRadius:'50%', background:'rgba(52,199,89,.14)', border:'1.5px solid #34C759', display:'flex', alignItems:'center', justifyContent:'center', color:'#5dd57b', fontSize:11, flex:'none' }}>✓</span>
            : s.status==='running'
            ? <span style={{ width:22, height:22, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--teal)', animation:'ds-spin .9s linear infinite', flex:'none' }}></span>
            : <span style={{ width:22, height:22, borderRadius:'50%', border:'1.5px solid var(--border)', flex:'none', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'var(--text-3)' }}>{i+1}</span>;

          return (
            <div key={s.label} style={{ display:'flex', alignItems:'center', gap:13, padding:'13px 20px', borderBottom: i < STEPS.length-1 ? '1px solid var(--border-soft)' : 'none' }}>
              {icon}
              <span style={{ flex:1, fontSize:13.5, color: s.status==='pending' ? 'var(--text-3)' : 'var(--text)' }}>{s.label}</span>
              {s.duration
                ? <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{s.duration}</span>
                : s.status==='running'
                ? <span style={{ fontSize:11, color:'#ecc26b', animation:'ds-pulse 1.4s infinite' }}>running…</span>
                : <span style={{ fontSize:11, color:'var(--text-3)' }}>—</span>
              }
            </div>
          );
        })}
      </div>

      {/* Log output */}
      <div style={{ border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 18px', borderBottom:'1px solid var(--border)', background:'var(--surface)' }}>
          <span style={{ fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>Log output</span>
          <span style={{ fontSize:11, color:'var(--teal)', animation:'ds-pulse 1.4s infinite' }}>● live</span>
        </div>
        <div className="mono" style={{ background:'var(--bg-2)', padding:'14px 18px', fontSize:11.5, lineHeight:1.9, maxHeight:240, overflowY:'auto' }}>
          {LOG_LINES.map((line, i) => (
            <div key={i}>
              <span style={{ color:'var(--text-3)', marginRight:12 }}>{line.t}</span>
              <span style={{ marginRight:10, color: line.l==='WARN' ? '#ecc26b' : line.l==='ERROR' ? '#ff8497' : 'var(--text-3)' }}>[{line.l}]</span>
              <span style={{ color: line.l==='WARN' ? '#ecc26b' : 'var(--text-2)' }}>{line.m}</span>
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
            <span style={{ color:'var(--text-3)' }}>16:03:09</span>
            <span style={{ color:'var(--text-3)' }}>[INFO]</span>
            <span style={{ borderRight:'2px solid var(--teal)', animation:'ds-blink 1s step-end infinite', paddingRight:2 }}></span>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginTop:18 }}>
        <button onClick={() => nav(`/app/${app}/${env}`)} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--text-2)', fontSize:12.5, padding:'9px 16px', borderRadius:9, cursor:'pointer' }}>Voltar ao Environment</button>
      </div>
    </div>
  );
}
