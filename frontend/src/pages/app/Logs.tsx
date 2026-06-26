import { useState } from 'react';
import { useParams } from 'react-router-dom';

const LOG_LINES = [
  { t:'16:03:05', level:'INFO',  msg:'Server listening on :8080' },
  { t:'16:03:05', level:'INFO',  msg:'Database connection pool initialized (max=20)' },
  { t:'16:03:06', level:'INFO',  msg:'Redis connection established at redis:6379' },
  { t:'16:03:06', level:'INFO',  msg:'Starting background job scheduler' },
  { t:'16:03:07', level:'INFO',  msg:'GET /healthz/startup 200 12ms' },
  { t:'16:03:07', level:'INFO',  msg:'GET /healthz/ready 200 8ms' },
  { t:'16:03:10', level:'INFO',  msg:'GET /api/v1/users 200 45ms user_id=42' },
  { t:'16:03:12', level:'WARN',  msg:'Slow query detected: SELECT * FROM deployments (340ms > 200ms threshold)' },
  { t:'16:03:15', level:'INFO',  msg:'POST /api/v1/deployments 201 67ms' },
  { t:'16:03:18', level:'ERROR', msg:'Failed to publish event to queue: connection timeout after 5000ms' },
  { t:'16:03:18', level:'WARN',  msg:'Retrying event publish (attempt 1/3)' },
  { t:'16:03:19', level:'INFO',  msg:'Event published successfully on retry' },
  { t:'16:03:22', level:'INFO',  msg:'GET /api/v1/environments 200 29ms' },
  { t:'16:03:25', level:'INFO',  msg:'Scheduled job "cleanup-old-builds" started' },
  { t:'16:03:25', level:'INFO',  msg:'Cleaned up 12 old build artifacts' },
];

type Level = 'ALL' | 'INFO' | 'WARN' | 'ERROR';

const levelColor: Record<string,string> = {
  INFO: 'var(--text-2)',
  WARN: '#ecc26b',
  ERROR: '#ff8497',
};
const levelBg: Record<string,string> = {
  INFO: 'transparent',
  WARN: 'rgba(224,169,59,.06)',
  ERROR: 'rgba(241,85,108,.06)',
};

export default function Logs() {
  const { app='backend', env='dev' } = useParams<{ app:string; env:string }>();
  const [filter, setFilter] = useState<Level>('ALL');
  const [search, setSearch] = useState('');

  const visible = LOG_LINES.filter(l =>
    (filter === 'ALL' || l.level === filter) &&
    (!search || l.msg.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{app} / {env.toUpperCase()} / logs</div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 18px' }}>Logs</h1>

      {/* Controls */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6 }}>
          {(['ALL','INFO','WARN','ERROR'] as Level[]).map(l => (
            <button key={l} onClick={() => setFilter(l)} className="mono" style={{ fontSize:11.5, padding:'6px 12px', borderRadius:8, cursor:'pointer', border: filter===l ? '1px solid var(--teal)' : '1px solid var(--border)', background: filter===l ? 'rgba(43,199,180,.1)' : 'var(--bg-2)', color: filter===l ? 'var(--teal)' : 'var(--text-2)' }}>{l}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar mensagens…" style={{ flex:1, minWidth:180, background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:9, padding:'7px 13px', color:'var(--text)', fontSize:12.5, fontFamily:'inherit' }} />
        <span style={{ fontSize:11.5, color:'var(--text-3)', marginLeft:'auto' }}>{visible.length} linhas</span>
      </div>

      {/* Log output */}
      <div style={{ border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div className="mono" style={{ background:'var(--bg-2)', maxHeight:520, overflowY:'auto' }}>
          {visible.map((line, i) => (
            <div key={i} style={{ display:'flex', gap:14, padding:'5px 18px', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,.013)', fontSize:12, lineHeight:1.6, borderBottom:'1px solid rgba(255,255,255,.03)' }}>
              <span style={{ color:'var(--text-3)', flex:'none', width:54 }}>{line.t}</span>
              <span style={{ flex:'none', width:38, fontWeight:600, color:levelColor[line.level]??'var(--text-2)' }}>{line.level}</span>
              <span style={{ color:levelColor[line.level]??'var(--text-2)', flex:1 }}>{line.msg}</span>
            </div>
          ))}
          {visible.length === 0 && (
            <div style={{ padding:'28px 18px', textAlign:'center', color:'var(--text-3)', fontSize:12.5 }}>Nenhuma linha encontrada com os filtros actuais.</div>
          )}
        </div>
      </div>
    </div>
  );
}
