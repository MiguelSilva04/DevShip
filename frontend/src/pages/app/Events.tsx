import { useParams } from 'react-router-dom';

const EVENTS = [
  { type:'Normal',  reason:'Scheduled',       obj:'Pod/backend-6c8f9b4d5-xkp7q', msg:'Successfully assigned app-dev/backend-6c8f9b4d5-xkp7q to node-2',              age:'2m' },
  { type:'Normal',  reason:'Pulling',          obj:'Pod/backend-6c8f9b4d5-xkp7q', msg:'Pulling image "horizonlabs/backend:a3f5b8c"',                                  age:'2m' },
  { type:'Normal',  reason:'Pulled',           obj:'Pod/backend-6c8f9b4d5-xkp7q', msg:'Successfully pulled image in 1.24s',                                           age:'1m' },
  { type:'Normal',  reason:'Created',          obj:'Pod/backend-6c8f9b4d5-xkp7q', msg:'Created container backend',                                                    age:'1m' },
  { type:'Normal',  reason:'Started',          obj:'Pod/backend-6c8f9b4d5-xkp7q', msg:'Started container backend',                                                    age:'1m' },
  { type:'Warning', reason:'Unhealthy',        obj:'Pod/backend-6c8f9b4d5-xkp7q', msg:'Startup probe failed: HTTP probe failed with statuscode: 503',                 age:'58s' },
  { type:'Warning', reason:'Unhealthy',        obj:'Pod/backend-6c8f9b4d5-xkp7q', msg:'Startup probe failed: HTTP probe failed with statuscode: 503',                 age:'55s' },
  { type:'Normal',  reason:'SuccessfulCreate', obj:'ReplicaSet/backend-6c8f9b4d5',msg:'Created pod: backend-6c8f9b4d5-xkp7q',                                        age:'2m' },
  { type:'Normal',  reason:'ScalingReplicaSet',obj:'Deployment/backend',           msg:'Scaled up replica set backend-6c8f9b4d5 to 1',                                age:'2m' },
];

export default function Events() {
  const { app='backend', env='dev' } = useParams<{ app:string; env:string }>();

  return (
    <div>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{app} / {env.toUpperCase()} / events</div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 20px' }}>Kubernetes Events</h1>

      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'70px 110px 220px 1fr 50px', gap:12, padding:'11px 18px', borderBottom:'1px solid var(--border)', fontSize:10.5, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
          <span>Type</span><span>Reason</span><span>Object</span><span>Message</span><span style={{ textAlign:'right' }}>Age</span>
        </div>
        {EVENTS.map((e, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'70px 110px 220px 1fr 50px', gap:12, padding:'11px 18px', borderBottom: i < EVENTS.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems:'start', fontSize:12 }}>
            <span style={{ color: e.type==='Warning' ? '#ecc26b' : '#5dd57b', fontSize:11, fontWeight:600 }}>{e.type}</span>
            <span className="mono" style={{ fontSize:11.5 }}>{e.reason}</span>
            <span className="mono" style={{ fontSize:11, color:'var(--text-2)', wordBreak:'break-all' }}>{e.obj}</span>
            <span style={{ fontSize:12, color: e.type==='Warning' ? '#ecc26b' : 'var(--text-2)', lineHeight:1.5 }}>{e.msg}</span>
            <span className="mono" style={{ fontSize:11, color:'var(--text-3)', textAlign:'right' }}>{e.age}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
