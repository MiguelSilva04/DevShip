import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';
import Breadcrumb from '../../components/Breadcrumb';

interface Pod {
  name: string;
  phase: string;
  ready: string;
  restart_count: number;
  node_name: string | null;
  creation_timestamp: string | null;
  cpu: string | null;
  memory: string | null;
}

function age(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function Pods() {
  const { appId, aeId } = useParams<{ appId: string; aeId: string }>();
  const { appLabel, envLabel, appId: resolvedAppId } = useAppEnvBreadcrumb(appId, aeId);
  const [pods, setPods] = useState<Pod[]>([]);
  const [metricsAvailable, setMetricsAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!aeId) return;
    setLoading(true);
    setError('');
    apiFetch(`/application-environments/${aeId}/pods`)
      .then(d => { setPods(d.pods); setMetricsAvailable(d.metrics_available); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [aeId]);

  useEffect(() => { load(); }, [load]);

  const running = pods.filter(p => p.phase === 'Running').length;

  return (
    <div>
      <Breadcrumb segments={[
        { label: appLabel, to: resolvedAppId ? `/app/${resolvedAppId}` : undefined },
        { label: envLabel, to: (resolvedAppId && aeId) ? `/app/${resolvedAppId}/${aeId}` : undefined },
        { label: 'pods' },
      ]} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:600, margin:0 }}>Pods</h1>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {loading && pods.length > 0 && (
            <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--teal)', animation:'ds-spin .7s linear infinite' }} />
          )}
          <button onClick={load} disabled={loading} className="btn-ghost" style={{ fontSize:12, padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer' }}>
            Atualizar ↻
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:9, background:'rgba(241,85,108,.08)', border:'1px solid rgba(241,85,108,.3)', fontSize:12.5, color:'#ff8497' }}>{error}</div>
      )}

      {loading && pods.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'60px 0', color:'var(--text-3)', fontSize:13 }}>
          <div style={{ width:22, height:22, borderRadius:'50%', border:'2.5px solid var(--border)', borderTopColor:'var(--teal)', animation:'ds-spin .7s linear infinite' }} />
          A carregar pods…
        </div>
      ) : (
        <>
          {!metricsAvailable && !error && (
            <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:9, background:'rgba(224,169,59,.07)', border:'1px solid rgba(224,169,59,.26)', fontSize:12, color:'#ecc26b' }}>
              Metrics API indisponível — CPU/Memória não disponíveis neste momento.
            </div>
          )}

          <div className="responsive-table-hint" style={{ fontSize:11.5, color:'var(--text-3)', marginBottom:6 }}>↔ desliza para o lado para ver todas as colunas</div>
          <div className="responsive-table-grid" style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden', marginBottom:16 }}>
            <div style={{ minWidth:640 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 60px 70px 70px 70px 40px 80px', gap:12, padding:'11px 20px', borderBottom:'1px solid var(--border)', fontSize:10.5, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
              <span>Nome</span><span>Status</span><span>Ready</span><span>CPU</span><span>Memória</span><span>Restarts</span><span>Idade</span><span>Node</span>
            </div>
            {pods.map((pod, i) => {
              const isRunning = pod.phase === 'Running';
              const isTerminating = pod.phase === 'Terminating';
              return (
                <div key={pod.name} style={{ display:'grid', gridTemplateColumns:'1fr 90px 60px 70px 70px 70px 40px 80px', gap:12, padding:'13px 20px', borderBottom: i < pods.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems:'center', fontSize:12.5 }}>
                  <span className="mono" style={{ fontSize:11.5, color: isTerminating ? 'var(--text-3)' : 'var(--text)' }}>{pod.name}</span>
                  <span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 8px', borderRadius:999, fontSize:11,
                      background: isRunning ? 'rgba(52,199,89,.12)' : isTerminating ? 'rgba(224,169,59,.1)' : 'rgba(241,85,108,.12)',
                      color: isRunning ? '#5dd57b' : isTerminating ? '#ecc26b' : '#ff8497',
                      border: isRunning ? '1px solid rgba(52,199,89,.24)' : isTerminating ? '1px solid rgba(224,169,59,.26)' : '1px solid rgba(241,85,108,.26)' }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background: isRunning ? '#34C759' : isTerminating ? '#E0A93B' : '#F1556C', animation: isTerminating ? 'ds-pulse 1.4s infinite' : 'none' }}></span>
                      {pod.phase}
                    </span>
                  </span>
                  <span className="mono" style={{ fontSize:12 }}>{pod.ready}</span>
                  <span className="mono" style={{ fontSize:12, color:'var(--teal)' }}>{pod.cpu ?? '—'}</span>
                  <span className="mono" style={{ fontSize:12, color:'var(--text-2)' }}>{pod.memory ?? '—'}</span>
                  <span className="mono" style={{ fontSize:12, color: pod.restart_count > 0 ? '#ecc26b' : 'var(--text-2)' }}>{pod.restart_count}</span>
                  <span className="mono" style={{ fontSize:12, color:'var(--text-3)' }}>{age(pod.creation_timestamp)}</span>
                  <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{pod.node_name ?? '—'}</span>
                </div>
              );
            })}
            {pods.length === 0 && !loading && (
              <div style={{ padding:'28px 18px', textAlign:'center', color:'var(--text-3)', fontSize:12.5 }}>Sem pods neste momento.</div>
            )}
            </div>
          </div>

          <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-3)' }}>
            <span>Total: <strong style={{ color:'var(--text-2)' }}>{pods.length}</strong></span>
            <span>Em execução: <strong style={{ color:'#5dd57b' }}>{running}</strong></span>
          </div>
        </>
      )}
    </div>
  );
}
