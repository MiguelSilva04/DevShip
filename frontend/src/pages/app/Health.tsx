import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';

interface ProbeSpec {
  path: string | null;
  port: number | null;
  initial_delay_seconds: number;
  period_seconds: number;
  timeout_seconds: number;
  success_threshold: number;
  failure_threshold: number;
}

interface ContainerProbeStatus {
  pod_name: string;
  container_name: string;
  ready: boolean;
  restart_count: number;
  state: string;
  reason: string | null;
  message: string | null;
  error_at: string | null;
  ready_transition_at: string | null;
  startup_probe: ProbeSpec | null;
  readiness_probe: ProbeSpec | null;
  liveness_probe: ProbeSpec | null;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.round(hours / 24)}d`;
}

export default function Health() {
  const { appId, aeId } = useParams<{ appId:string; aeId:string }>();
  const { appLabel, envLabel } = useAppEnvBreadcrumb(appId, aeId);
  const nav = useNavigate();
  const [containers, setContainers] = useState<ContainerProbeStatus[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!aeId) return;
    apiFetch(`/application-environments/${aeId}/health-probes`)
      .then(d => setContainers(d.containers))
      .catch(e => setError(e.message));
  }, [aeId]);

  return (
    <div>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{appLabel} / {envLabel}</div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 20px' }}>Health details</h1>

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, background:'var(--bg-2)', border:'1px solid var(--border-soft)', fontSize:12.5, color:'var(--text-2)', marginBottom:20 }}>
        <span style={{ flex:'none' }}>ⓘ</span>
        Os dados são lidos em tempo real da Kubernetes API.
      </div>

      {error && <div style={{ color:'#ff8497', fontSize:13 }}>{error}</div>}
      {!error && containers === null && <div style={{ color:'var(--text-3)', fontSize:13 }}>A carregar…</div>}
      {containers && containers.length === 0 && <div style={{ color:'var(--text-3)', fontSize:13 }}>Sem pods em execução.</div>}

      {containers?.map(c => (
        <div key={`${c.pod_name}-${c.container_name}`} style={{ marginBottom:22 }}>
          {containers.length > 1 && (
            <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:10 }}>{c.pod_name} / {c.container_name}</div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <ProbeCard
              title="Startup probe"
              spec={c.startup_probe}
              passing={c.state === 'Running' || c.ready}
              errorInfo={c.state !== 'Running' && c.restart_count === 0 ? { reason: c.reason, message: c.message, at: c.error_at } : null}
              onViewLog={() => nav(`/app/${appId}/${aeId}/logs?pod=${encodeURIComponent(c.pod_name)}`)}
            />
            <ProbeCard
              title="Readiness probe"
              spec={c.readiness_probe}
              passing={c.ready}
              errorInfo={!c.ready ? { reason: c.reason, message: c.message, at: c.error_at ?? c.ready_transition_at } : null}
              onViewLog={() => nav(`/app/${appId}/${aeId}/logs?pod=${encodeURIComponent(c.pod_name)}`)}
            />
            <ProbeCard
              title="Liveness probe"
              spec={c.liveness_probe}
              passing={c.state === 'Running' && c.restart_count === 0}
              errorInfo={c.restart_count > 0 ? { reason: c.reason, message: c.message, at: c.error_at } : null}
              onViewLog={() => nav(`/app/${appId}/${aeId}/logs?pod=${encodeURIComponent(c.pod_name)}`)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProbeCard({ title, spec, passing, errorInfo, onViewLog }: {
  title: string;
  spec: ProbeSpec | null;
  passing: boolean;
  errorInfo: { reason: string | null; message: string | null; at: string | null } | null;
  onViewLog: () => void;
}) {
  const lastError = errorInfo && (errorInfo.message || errorInfo.reason)
    ? `${errorInfo.message ?? errorInfo.reason}${errorInfo.at ? ` (${relativeTime(errorInfo.at)})` : ''}`
    : null;

  return (
    <div style={{
      border: `1px solid ${passing ? 'var(--border)' : 'rgba(241,85,108,.4)'}`,
      borderRadius:14, background:'var(--surface)', padding:'18px 20px',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
        <span style={{ fontSize:14, fontWeight:600 }}>{title}</span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:999, fontSize:11.5,
          background: passing ? 'rgba(52,199,89,.13)' : 'rgba(241,85,108,.13)',
          color: passing ? '#5dd57b' : '#ff8497',
          border: passing ? '1px solid rgba(52,199,89,.24)' : '1px solid rgba(241,85,108,.26)' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background: passing ? '#34C759' : '#F1556C' }}></span>
          {passing ? 'Passing' : 'Failing'}
        </span>
        <span onClick={onViewLog} style={{ marginLeft:'auto', fontSize:11.5, color:'var(--teal)', cursor:'pointer' }}>Ver log →</span>
      </div>

      {spec ? (
        <div className="mono" style={{ fontSize:12, color:'var(--text-3)' }}>
          {spec.path ?? '—'}{spec.path && spec.port ? `:${spec.port}` : ''}
          {'  '}delay {spec.initial_delay_seconds}s{'  '}period {spec.period_seconds}s{'  '}timeout {spec.timeout_seconds}s{'  '}thresholds {spec.success_threshold}/{spec.failure_threshold}
        </div>
      ) : (
        <div style={{ fontSize:12, color:'var(--text-3)' }}>Probe não configurada neste container.</div>
      )}

      {lastError ? (
        <div className="mono" style={{ fontSize:12, color:'#ff8497', marginTop:8 }}>Last error: {lastError}</div>
      ) : (
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:8 }}>Sem erros recentes.</div>
      )}
    </div>
  );
}
