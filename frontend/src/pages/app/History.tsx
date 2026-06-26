import { useParams, useNavigate } from 'react-router-dom';

const DEPLOYS = [
  { id:'d-001', app:'backend',  env:'DEV',     version:'v1.2.3', commit:'a3f5b8c', author:'john.doe',   date:'2026-06-12 16:03', status:'Success',  duration:'43s' },
  { id:'d-002', app:'backend',  env:'STAGING', version:'v1.2.3', commit:'a3f5b8c', author:'bob.johnson', date:'2026-06-12 16:00', status:'Running',  duration:null },
  { id:'d-003', app:'frontend', env:'DEV',     version:'v3.0.1', commit:'d7e8f9a', author:'bob.johnson', date:'2026-06-11 10:05', status:'Success',  duration:'38s' },
  { id:'d-004', app:'frontend', env:'STAGING', version:'v3.0.1', commit:'d7e8f9a', author:'bob.johnson', date:'2026-06-11 10:00', status:'Success',  duration:'41s' },
  { id:'d-005', app:'backend',  env:'DEV',     version:'v1.2.2', commit:'c4d5e6f', author:'john.doe',    date:'2026-06-10 09:45', status:'Success',  duration:'45s' },
  { id:'d-006', app:'backend',  env:'PROD',    version:'v1.2.1', commit:'b2c4d5e', author:'jane.smith',  date:'2026-06-10 14:20', status:'Success',  duration:'1m 02s' },
  { id:'d-007', app:'backend',  env:'DEV',     version:'v1.2.1', commit:'b2c4d5e', author:'john.doe',    date:'2026-06-09 17:10', status:'Failed',   duration:'22s' },
];

function statusBadge(s:string) {
  const map: Record<string,{bg:string;col:string;bord:string;dot:string;anim?:string}> = {
    'Success': { bg:'rgba(52,199,89,.12)',   col:'#5dd57b', bord:'rgba(52,199,89,.24)',   dot:'#34C759' },
    'Running': { bg:'rgba(224,169,59,.12)', col:'#ecc26b', bord:'rgba(224,169,59,.26)', dot:'#E0A93B', anim:'ds-pulse 1.4s infinite' },
    'Failed':  { bg:'rgba(241,85,108,.12)', col:'#ff8497', bord:'rgba(241,85,108,.26)', dot:'#F1556C' },
  };
  return map[s] ?? map['Success'];
}

export default function History() {
  const { app, env } = useParams<{ app?:string; env?:string }>();
  const nav = useNavigate();

  const deploys = DEPLOYS.filter(d => (!app || d.app===app) && (!env || d.env===env.toUpperCase()));

  const title = app && env ? `${app} / ${env.toUpperCase()}` : app ? app : 'Todos os deploys';

  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:'-.01em', margin:'0 0 4px' }}>Histórico</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 22px' }}>{title}</p>

      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'80px 90px 70px 90px 90px 1fr 80px 70px', gap:12, padding:'12px 20px', borderBottom:'1px solid var(--border)', fontSize:10.5, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
          <span>Status</span><span>App</span><span>Env</span><span>Versão</span><span>Commit</span><span>Autor</span><span>Data</span><span style={{ textAlign:'right' }}>Dur.</span>
        </div>
        {deploys.map((d, i) => {
          const b = statusBadge(d.status);
          return (
            <div key={d.id} style={{ display:'grid', gridTemplateColumns:'80px 90px 70px 90px 90px 1fr 80px 70px', gap:12, padding:'13px 20px', borderBottom: i < deploys.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems:'center', fontSize:12.5 }}>
              <span>
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:999, fontSize:11, background:b.bg, color:b.col, border:`1px solid ${b.bord}` }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:b.dot, animation:b.anim??'none', flex:'none' }}></span>
                  {d.status}
                </span>
              </span>
              <span className="mono" style={{ fontSize:12 }}>{d.app}</span>
              <span className="mono" style={{ fontSize:11, color:'var(--text-2)' }}>{d.env}</span>
              <span className="mono" style={{ fontSize:12, color:'var(--teal)' }}>{d.version}</span>
              <span className="mono" style={{ fontSize:12, color:'var(--text-2)' }}>{d.commit}</span>
              <span style={{ fontSize:12, color:'var(--text-2)' }}>{d.author}</span>
              <span style={{ fontSize:11.5, color:'var(--text-3)' }}>{d.date.split(' ')[0]}</span>
              <span className="mono" style={{ fontSize:11, color:'var(--text-3)', textAlign:'right' }}>{d.duration ?? '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
