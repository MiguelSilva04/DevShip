import { useParams } from 'react-router-dom';

export default function Health() {
  const { app='backend', env='dev' } = useParams<{ app:string; env:string }>();

  return (
    <div>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{app} / {env.toUpperCase()} / health</div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 20px' }}>Health Details</h1>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <ProbeCard
          title="Startup Probe"
          status="Passing"
          type="HTTP GET"
          path="/healthz/startup"
          port={8080}
          initialDelay={5}
          period={3}
          threshold={10}
          successCount={1}
          failureCount={0}
          lastResult="HTTP 200 OK (12ms)"
        />
        <ProbeCard
          title="Readiness Probe"
          status="Passing"
          type="HTTP GET"
          path="/healthz/ready"
          port={8080}
          initialDelay={10}
          period={5}
          threshold={3}
          successCount={1}
          failureCount={0}
          lastResult="HTTP 200 OK (8ms)"
        />
        <ProbeCard
          title="Liveness Probe"
          status="Passing"
          type="HTTP GET"
          path="/healthz/live"
          port={8080}
          initialDelay={15}
          period={10}
          threshold={3}
          successCount={1}
          failureCount={0}
          lastResult="HTTP 200 OK (10ms)"
        />
      </div>
    </div>
  );
}

function ProbeCard({ title, status, type, path, port, initialDelay, period, threshold, successCount, failureCount, lastResult }: {
  title:string; status:string; type:string; path:string; port:number;
  initialDelay:number; period:number; threshold:number; successCount:number; failureCount:number; lastResult:string;
}) {
  const isOk = status === 'Passing';
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 22px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <span style={{ fontSize:14, fontWeight:600 }}>{title}</span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, fontSize:11.5,
          background: isOk ? 'rgba(52,199,89,.13)' : 'rgba(241,85,108,.13)',
          color: isOk ? '#5dd57b' : '#ff8497',
          border: isOk ? '1px solid rgba(52,199,89,.24)' : '1px solid rgba(241,85,108,.26)' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background: isOk ? '#34C759' : '#F1556C' }}></span>
          {status}
        </span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px 20px', fontSize:12.5 }}>
        <InfoCell label="Type" value={type} />
        <InfoCell label="Path" value={`${path}:${port}`} mono />
        <InfoCell label="Initial Delay" value={`${initialDelay}s`} mono />
        <InfoCell label="Period" value={`${period}s`} mono />
        <InfoCell label="Success Threshold" value={`${successCount}/${threshold}`} mono />
        <InfoCell label="Failure Count" value={`${failureCount}`} mono valueColor={failureCount > 0 ? '#ecc26b' : undefined} />
        <div style={{ gridColumn:'span 2' }}>
          <InfoCell label="Last Result" value={lastResult} mono valueColor="#5dd57b" />
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value, mono, valueColor }: { label:string; value:string; mono?:boolean; valueColor?:string }) {
  return (
    <div>
      <span style={{ fontSize:11.5, color:'var(--text-3)' }}>{label}</span>
      <div className={mono ? 'mono' : ''} style={{ marginTop:3, fontSize:12.5, color: valueColor ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}
