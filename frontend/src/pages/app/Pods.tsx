import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, type ApiError } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';
import Breadcrumb from '../../components/Breadcrumb';
import { useLanguage } from '../../context/LanguageContext';
import AccessDenied from '../../components/AccessDenied';

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
  const { t } = useLanguage();
  const [pods, setPods] = useState<Pod[]>([]);
  const [metricsAvailable, setMetricsAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(() => {
    if (!aeId) return;
    setLoading(true);
    setError('');
    setForbidden(false);
    apiFetch(`/application-environments/${aeId}/pods`)
      .then(d => { setPods(d.pods); setMetricsAvailable(d.metrics_available); })
      .catch((e: ApiError) => { if (e.status === 403) setForbidden(true); else setError(e.message); })
      .finally(() => setLoading(false));
  }, [aeId]);

  useEffect(() => { load(); }, [load]);

  const running = pods.filter(p => p.phase === 'Running').length;

  if (forbidden) return <AccessDenied />;

  return (
    <div>
      <Breadcrumb segments={[
        { label: appLabel, to: resolvedAppId ? `/app/${resolvedAppId}` : undefined },
        { label: envLabel, to: (resolvedAppId && aeId) ? `/app/${resolvedAppId}/${aeId}` : undefined },
        { label: t('pods.breadcrumbPods') },
      ]} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:600, margin:0 }}>{t('pods.title')}</h1>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {loading && pods.length > 0 && (
            <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--teal)', animation:'ds-spin .7s linear infinite' }} />
          )}
          <button onClick={load} disabled={loading} className="btn-ghost" style={{ fontSize:12, padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {t('pods.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:9, background:'rgba(241,85,108,.08)', border:'1px solid rgba(241,85,108,.3)', fontSize:12.5, color:'var(--red)' }}>{error}</div>
      )}

      {loading && pods.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'60px 0', color:'var(--text-3)', fontSize:13 }}>
          <div style={{ width:22, height:22, borderRadius:'50%', border:'2.5px solid var(--border)', borderTopColor:'var(--teal)', animation:'ds-spin .7s linear infinite' }} />
          {t('pods.loadingPods')}
        </div>
      ) : (
        <>
          {!metricsAvailable && !error && (
            <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:9, background:'rgba(224,169,59,.07)', border:'1px solid rgba(224,169,59,.26)', fontSize:12, color:'var(--amber)' }}>
              {t('pods.metricsUnavailable')}
            </div>
          )}

          <div className="responsive-table-hint" style={{ fontSize:11.5, color:'var(--text-3)', marginBottom:6 }}>↔ desliza para o lado para ver todas as colunas</div>
          <div className="responsive-table-grid" style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', marginBottom:16 }}>
            <div style={{ minWidth:640, borderRadius:14, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 60px 70px 70px 70px 40px 80px', gap:12, padding:'11px 20px', borderBottom:'1px solid var(--border)', fontSize:10.5, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
              <span>{t('pods.nameCol')}</span><span>{t('pods.statusCol')}</span><span>{t('pods.readyCol')}</span><span>{t('pods.cpuCol')}</span><span>{t('pods.memoryCol')}</span><span>{t('pods.restartsCol')}</span><span>{t('pods.ageCol')}</span><span>{t('pods.nodeCol')}</span>
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
                      color: isRunning ? 'var(--green)' : isTerminating ? 'var(--amber)' : 'var(--red)',
                      border: isRunning ? '1px solid rgba(52,199,89,.24)' : isTerminating ? '1px solid rgba(224,169,59,.26)' : '1px solid rgba(241,85,108,.26)' }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background: isRunning ? 'var(--green)' : isTerminating ? 'var(--amber)' : 'var(--red)', animation: isTerminating ? 'ds-pulse 1.4s infinite' : 'none' }}></span>
                      {pod.phase}
                    </span>
                  </span>
                  <span className="mono" style={{ fontSize:12 }}>{pod.ready}</span>
                  <span className="mono" style={{ fontSize:12, color:'var(--teal)' }}>{pod.cpu ?? '—'}</span>
                  <span className="mono" style={{ fontSize:12, color:'var(--text-2)' }}>{pod.memory ?? '—'}</span>
                  <span className="mono" style={{ fontSize:12, color: pod.restart_count > 0 ? 'var(--amber)' : 'var(--text-2)' }}>{pod.restart_count}</span>
                  <span className="mono" style={{ fontSize:12, color:'var(--text-3)' }}>{age(pod.creation_timestamp)}</span>
                  <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{pod.node_name ?? '—'}</span>
                </div>
              );
            })}
            {pods.length === 0 && !loading && (
              <div style={{ padding:'28px 18px', textAlign:'center', color:'var(--text-3)', fontSize:12.5 }}>{t('pods.noPodsNow')}</div>
            )}
            </div>
          </div>

          <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-3)' }}>
            <span>{t('pods.total')} <strong style={{ color:'var(--text-2)' }}>{pods.length}</strong></span>
            <span>{t('pods.running')} <strong style={{ color:'var(--green)' }}>{running}</strong></span>
          </div>
        </>
      )}
    </div>
  );
}
