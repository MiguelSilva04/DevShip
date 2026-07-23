import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, type ApiError } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';
import Breadcrumb from '../../components/Breadcrumb';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../context/LanguageContext';
import AccessDenied from '../../components/AccessDenied';

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

function relativeTime(iso: string | null, t: (key: TranslationKey) => string): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return t('health.justNow');
  if (mins < 60) return `${t('health.minAgo')} ${mins} ${t('health.minAgoUnit')}`.trim();
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${t('health.minAgo')} ${hours}${t('health.hAgo')}`.trim();
  return `${t('health.minAgo')} ${Math.round(hours / 24)}${t('health.dAgo')}`.trim();
}

export default function Health() {
  const { appId, aeId } = useParams<{ appId:string; aeId:string }>();
  const { appLabel, envLabel, appId: resolvedAppId } = useAppEnvBreadcrumb(appId, aeId);
  const nav = useNavigate();
  const { t } = useLanguage();
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
      <Breadcrumb segments={[
        { label: appLabel, to: resolvedAppId ? `/app/${resolvedAppId}` : undefined },
        { label: envLabel, to: (resolvedAppId && aeId) ? `/app/${resolvedAppId}/${aeId}` : undefined },
        { label: t('health.breadcrumbHealth') },
      ]} />
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 20px' }}>{t('health.title')}</h1>

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, background:'var(--bg-2)', border:'1px solid var(--border-soft)', fontSize:12.5, color:'var(--text-2)', marginBottom:20 }}>
        <span style={{ flex:'none' }}>ⓘ</span>
        {t('health.liveDataNote')}
      </div>

      {error && <div style={{ color:'var(--red)', fontSize:13 }}>{error}</div>}
      {!error && containers === null && <div style={{ color:'var(--text-3)', fontSize:13 }}>{t('health.loading')}</div>}
      {containers && containers.length === 0 && <div style={{ color:'var(--text-3)', fontSize:13 }}>{t('health.noPodsRunning')}</div>}

      {containers?.map(c => (
        <div key={`${c.pod_name}-${c.container_name}`} style={{ marginBottom:22 }}>
          {containers.length > 1 && (
            <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:10 }}>{c.pod_name} / {c.container_name}</div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <ProbeCard
              title={t('health.startupProbe')}
              spec={c.startup_probe}
              passing={c.state === 'Running' || c.ready}
              errorInfo={c.state !== 'Running' && c.restart_count === 0 ? { reason: c.reason, message: c.message, at: c.error_at } : null}
              onViewLog={() => nav(`/app/${appId}/${aeId}/logs?pod=${encodeURIComponent(c.pod_name)}`)}
            />
            <ProbeCard
              title={t('health.readinessProbe')}
              spec={c.readiness_probe}
              passing={c.ready}
              errorInfo={!c.ready ? { reason: c.reason, message: c.message, at: c.error_at ?? c.ready_transition_at } : null}
              onViewLog={() => nav(`/app/${appId}/${aeId}/logs?pod=${encodeURIComponent(c.pod_name)}`)}
            />
            <ProbeCard
              title={t('health.livenessProbe')}
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
  const { t } = useLanguage();
  const lastError = errorInfo && (errorInfo.message || errorInfo.reason)
    ? `${errorInfo.message ?? errorInfo.reason}${errorInfo.at ? ` (${relativeTime(errorInfo.at, t)})` : ''}`
    : null;

  // Sem spec, o container não tem este probe configurado — não é "a passar" nem "a
  // falhar", os dois pressupõem que o probe existe. Estado neutro, não usar o `passing`
  // vindo de fora (que é calculado a partir do estado geral do pod, não deste probe).
  const configured = spec !== null;

  return (
    <div style={{
      border: `1px solid ${!configured ? 'var(--border)' : passing ? 'var(--border)' : 'rgba(241,85,108,.4)'}`,
      borderRadius:14, background:'var(--surface)', padding:'18px 20px',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
        <span style={{ fontSize:14, fontWeight:600 }}>{title}</span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:999, fontSize:11.5,
          background: !configured ? 'var(--surface-3)' : passing ? 'rgba(52,199,89,.13)' : 'rgba(241,85,108,.13)',
          color: !configured ? 'var(--text-3)' : passing ? 'var(--green)' : 'var(--red)',
          border: !configured ? '1px solid var(--border)' : passing ? '1px solid rgba(52,199,89,.24)' : '1px solid rgba(241,85,108,.26)' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background: !configured ? 'var(--text-3)' : passing ? 'var(--green)' : 'var(--red)' }}></span>
          {!configured ? t('health.notConfigured') : passing ? t('health.passing') : t('health.failing')}
        </span>
        <span onClick={onViewLog} style={{ marginLeft:'auto', fontSize:11.5, color:'var(--teal)', cursor:'pointer' }}>{t('health.viewLog')}</span>
      </div>

      {spec ? (
        <div className="mono" style={{ fontSize:12, color:'var(--text-3)' }}>
          {spec.path ?? '—'}{spec.path && spec.port ? `:${spec.port}` : ''}
          {'  '}delay {spec.initial_delay_seconds}s{'  '}period {spec.period_seconds}s{'  '}timeout {spec.timeout_seconds}s{'  '}thresholds {spec.success_threshold}/{spec.failure_threshold}
        </div>
      ) : (
        <div style={{ fontSize:12, color:'var(--text-3)' }}>{t('health.probeNotConfigured')}</div>
      )}

      {lastError ? (
        <div className="mono" style={{ fontSize:12, color:'var(--red)', marginTop:8 }}>{t('health.lastError')} {lastError}</div>
      ) : (
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:8 }}>{t('health.noRecentErrors')}</div>
      )}
    </div>
  );
}
