import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';

interface LogLine {
  timestamp: string | null;
  level: string | null;
  message: string;
}

type Level = 'ALL' | 'INFO' | 'WARN' | 'WARNING' | 'ERROR' | 'DEBUG' | 'RAW';

const levelColor: Record<string,string> = {
  INFO: 'var(--text-2)',
  DEBUG: 'var(--text-3)',
  WARN: '#ecc26b',
  WARNING: '#ecc26b',
  ERROR: '#ff8497',
  CRITICAL: '#ff8497',
  FATAL: '#ff8497',
  RAW: 'var(--text-3)',
};

export default function Logs() {
  const { appId, aeId } = useParams<{ appId: string; aeId: string }>();
  const { appLabel, envLabel } = useAppEnvBreadcrumb(appId, aeId);
  const [pods, setPods] = useState<string[]>([]);
  const [pod, setPod] = useState('');
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState<Level>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!aeId) return;
    apiFetch(`/application-environments/${aeId}/pods`)
      .then(d => {
        const names: string[] = d.pods.map((p: { name: string }) => p.name);
        setPods(names);
        if (names.length > 0) setPod(names[0]);
      })
      .catch(e => setError(e.message));
  }, [aeId]);

  const load = useCallback(() => {
    if (!aeId || !pod) return;
    setLoading(true);
    setError('');
    apiFetch(`/application-environments/${aeId}/logs?pod=${encodeURIComponent(pod)}`)
      .then(d => setLines(d.lines))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [aeId, pod]);

  useEffect(() => { load(); }, [load]);

  const visible = lines.filter(l =>
    (filter === 'ALL' || (l.level ?? 'RAW') === filter) &&
    (!search || l.message.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{appLabel} / {envLabel} / logs</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <h1 style={{ fontSize:22, fontWeight:600, margin:0 }}>Logs</h1>
        <button onClick={load} disabled={loading || !pod} className="btn-ghost" style={{ fontSize:12, padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'A atualizar…' : 'Atualizar ↻'}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:9, background:'rgba(241,85,108,.08)', border:'1px solid rgba(241,85,108,.3)', fontSize:12.5, color:'#ff8497' }}>{error}</div>
      )}

      {/* Controls */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <select value={pod} onChange={e => setPod(e.target.value)} className="mono" style={{ fontSize:12, padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-2)', color:'var(--text)' }}>
          {pods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ display:'flex', gap:6 }}>
          {(['ALL','INFO','WARN','ERROR','RAW'] as Level[]).map(l => (
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
              <span style={{ color:'var(--text-3)', flex:'none', width:74 }}>{line.timestamp ?? ''}</span>
              <span style={{ flex:'none', width:38, fontWeight:600, color:levelColor[line.level ?? 'RAW']??'var(--text-2)' }}>{line.level ?? ''}</span>
              <span style={{ color:levelColor[line.level ?? 'RAW']??'var(--text-2)', flex:1 }}>{line.message}</span>
            </div>
          ))}
          {visible.length === 0 && (
            <div style={{ padding:'28px 18px', textAlign:'center', color:'var(--text-3)', fontSize:12.5 }}>
              {pod ? 'Nenhuma linha encontrada com os filtros actuais.' : 'Sem pods disponíveis para consultar logs.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
