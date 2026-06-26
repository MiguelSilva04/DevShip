import { useParams } from 'react-router-dom';

const PODS = [
  { name:'backend-6c8f9b4d5-xkp7q', status:'Running',  ready:'1/1', restarts:0, cpu:'42m',  mem:'128Mi', age:'2m',  node:'node-2' },
  { name:'backend-6c8f9b4d5-mzr8p', status:'Running',  ready:'1/1', restarts:0, cpu:'38m',  mem:'121Mi', age:'5d',  node:'node-1' },
  { name:'backend-5bd8c7f4d-k2q9x', status:'Terminating', ready:'0/1', restarts:0, cpu:'0m', mem:'0Mi', age:'5d', node:'node-3' },
];

export default function Pods() {
  const { app='backend', env='dev' } = useParams<{ app:string; env:string }>();

  return (
    <div>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{app} / {env.toUpperCase()} / pods</div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 20px' }}>Pods</h1>

      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden', marginBottom:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 60px 70px 70px 70px 40px 80px', gap:12, padding:'11px 20px', borderBottom:'1px solid var(--border)', fontSize:10.5, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
          <span>Name</span><span>Status</span><span>Ready</span><span>CPU</span><span>Memory</span><span>Restarts</span><span>Age</span><span>Node</span>
        </div>
        {PODS.map((pod, i) => {
          const isRunning = pod.status === 'Running';
          const isTerminating = pod.status === 'Terminating';
          return (
            <div key={pod.name} style={{ display:'grid', gridTemplateColumns:'1fr 90px 60px 70px 70px 70px 40px 80px', gap:12, padding:'13px 20px', borderBottom: i < PODS.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems:'center', fontSize:12.5 }}>
              <span className="mono" style={{ fontSize:11.5, color: isTerminating ? 'var(--text-3)' : 'var(--text)' }}>{pod.name}</span>
              <span>
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 8px', borderRadius:999, fontSize:11,
                  background: isRunning ? 'rgba(52,199,89,.12)' : isTerminating ? 'rgba(224,169,59,.1)' : 'rgba(241,85,108,.12)',
                  color: isRunning ? '#5dd57b' : isTerminating ? '#ecc26b' : '#ff8497',
                  border: isRunning ? '1px solid rgba(52,199,89,.24)' : isTerminating ? '1px solid rgba(224,169,59,.26)' : '1px solid rgba(241,85,108,.26)' }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background: isRunning ? '#34C759' : isTerminating ? '#E0A93B' : '#F1556C', animation: isTerminating ? 'ds-pulse 1.4s infinite' : 'none' }}></span>
                  {pod.status}
                </span>
              </span>
              <span className="mono" style={{ fontSize:12 }}>{pod.ready}</span>
              <span className="mono" style={{ fontSize:12, color:'var(--teal)' }}>{pod.cpu}</span>
              <span className="mono" style={{ fontSize:12, color:'var(--text-2)' }}>{pod.mem}</span>
              <span className="mono" style={{ fontSize:12, color: pod.restarts > 0 ? '#ecc26b' : 'var(--text-2)' }}>{pod.restarts}</span>
              <span className="mono" style={{ fontSize:12, color:'var(--text-3)' }}>{pod.age}</span>
              <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{pod.node}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-3)' }}>
        <span>Total: <strong style={{ color:'var(--text-2)' }}>{PODS.length}</strong></span>
        <span>Running: <strong style={{ color:'#5dd57b' }}>{PODS.filter(p=>p.status==='Running').length}</strong></span>
        <span>Terminating: <strong style={{ color:'#ecc26b' }}>{PODS.filter(p=>p.status==='Terminating').length}</strong></span>
      </div>
    </div>
  );
}
