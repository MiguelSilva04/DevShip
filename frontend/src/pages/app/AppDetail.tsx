import { useParams, useNavigate } from 'react-router-dom';

const DATA: Record<string, { repo:string; envs:{id:string;label:string;version:string;status:string}[] }> = {
  backend: {
    repo: 'github.com/company/backend',
    envs: [
      { id:'dev',     label:'DEV',     version:'v1.2.3', status:'Healthy' },
      { id:'staging', label:'STAGING', version:'v1.2.2', status:'Deploying' },
      { id:'prod',    label:'PROD',    version:'v1.2.1', status:'Healthy' },
    ],
  },
  frontend: {
    repo: 'github.com/company/frontend',
    envs: [
      { id:'dev',     label:'DEV',     version:'v3.0.1', status:'Healthy' },
      { id:'staging', label:'STAGING', version:'v3.0.1', status:'Healthy' },
    ],
  },
};

function statusPill(s:string) {
  const map: Record<string,{bg:string;col:string;bord:string;dot:string}> = {
    'Healthy':   { bg:'rgba(52,199,89,.13)',  col:'#5dd57b', bord:'rgba(52,199,89,.24)',  dot:'#34C759' },
    'Deploying': { bg:'rgba(224,169,59,.13)', col:'#ecc26b', bord:'rgba(224,169,59,.26)', dot:'#E0A93B' },
    'Degraded':  { bg:'rgba(241,85,108,.13)', col:'#ff8497', bord:'rgba(241,85,108,.26)', dot:'#F1556C' },
  };
  return map[s] ?? map['Healthy'];
}

export default function AppDetail() {
  const { app = 'backend' } = useParams<{ app:string }>();
  const nav = useNavigate();
  const data = DATA[app] ?? DATA.backend;

  return (
    <div>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>Applications / {app}</div>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:23, fontWeight:600, margin:0 }}>{app}</h1>
        <div className="mono" style={{ fontSize:12, color:'var(--text-2)', marginTop:5 }}>{data.repo}</div>
      </div>

      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:'140px 130px 1fr 200px', gap:12, padding:'13px 20px', borderBottom:'1px solid var(--border)', fontSize:11, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--text-3)' }}>
          <span>Environment</span><span>Version</span><span>Status</span><span style={{ textAlign:'right' }}>Actions</span>
        </div>

        {data.envs.map((env, i) => {
          const p = statusPill(env.status);
          return (
            <div key={env.id} style={{ display:'grid', gridTemplateColumns:'140px 130px 1fr 200px', gap:12, padding:'15px 20px', borderBottom: i < data.envs.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems:'center' }}>
              <span className="mono" style={{ fontSize:13 }}>{env.label}</span>
              <span className="mono" style={{ fontSize:12.5, color: env.status==='Healthy' ? 'var(--teal)' : 'var(--text-2)' }}>{env.version}</span>
              <span>
                <span style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'4px 10px', borderRadius:999, fontSize:11, background:p.bg, color:p.col, border:`1px solid ${p.bord}` }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:p.dot, animation: env.status==='Deploying' ? 'ds-pulse 1.4s infinite' : 'none' }}></span>
                  {env.status}
                </span>
              </span>
              <span style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => nav(`/app/${app}/${env.id}/deploy`)} className="btn-primary" style={{ fontSize:11.5, padding:'6px 13px', borderRadius:7 }}>Deploy</button>
                <button onClick={() => nav(`/app/${app}/${env.id}`)} className="btn-secondary" style={{ fontSize:11.5, padding:'6px 13px', borderRadius:7 }}>Ver detalhes</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
