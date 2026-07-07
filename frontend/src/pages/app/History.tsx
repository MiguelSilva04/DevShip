import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';

type LifecycleStatus = 'Deploying' | 'Healthy' | 'Degraded' | 'Failed' | 'RolledBack' | 'Superseded';

interface DeploymentVersionDetail {
  id: string;
  image_tag: string | null;
  source_commit_sha: string | null;
  lifecycle_status: LifecycleStatus;
  trigger_source: string;
  deployed_at: string | null;
  created_at: string;
}

function statusBadge(s: LifecycleStatus) {
  const map: Record<string, { bg: string; col: string; bord: string; dot: string; anim?: string }> = {
    Healthy:    { bg: 'rgba(52,199,89,.12)',   col: '#5dd57b', bord: 'rgba(52,199,89,.24)',   dot: '#34C759' },
    Deploying:  { bg: 'rgba(224,169,59,.12)',  col: '#ecc26b', bord: 'rgba(224,169,59,.26)',  dot: '#E0A93B', anim: 'ds-pulse 1.4s infinite' },
    Degraded:   { bg: 'rgba(241,85,108,.12)',  col: '#ff8497', bord: 'rgba(241,85,108,.26)',  dot: '#F1556C' },
    Failed:     { bg: 'rgba(241,85,108,.12)',  col: '#ff8497', bord: 'rgba(241,85,108,.26)',  dot: '#F1556C' },
    RolledBack: { bg: 'rgba(120,120,180,.12)', col: '#aab4ff', bord: 'rgba(120,120,180,.26)', dot: '#7880cc' },
    Superseded: { bg: 'rgba(150,150,150,.12)', col: 'var(--text-3)', bord: 'rgba(150,150,150,.26)', dot: '#888' },
  };
  return map[s] ?? map['Healthy'];
}

export default function History() {
  const { appId, aeId } = useParams<{ appId?: string; aeId?: string }>();
  const { appLabel, envLabel } = useAppEnvBreadcrumb(appId, aeId);
  const [versions, setVersions] = useState<DeploymentVersionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!aeId) { setError('Application environment não especificado.'); setLoading(false); return; }
    apiFetch(`/application-environments/${aeId}/history?limit=50`)
      .then((data: DeploymentVersionDetail[]) => { setVersions(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [aeId]);

  if (loading) return <Spinner />;
  if (error) return <div style={{ color: '#ff8497', fontSize: 13, padding: '40px 0' }}>{error}</div>;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.01em', margin: '0 0 4px' }}>Histórico</h1>
      <p className="mono" style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 22px' }}>{appLabel} / {envLabel}</p>

      {versions.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '20px 0' }}>Sem deploys registados.</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 110px 90px 1fr 140px', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            <span>Status</span><span>Versão</span><span>Commit</span><span>Trigger</span><span style={{ textAlign: 'right' }}>Deployed at</span>
          </div>
          {versions.map((v, i) => {
            const b = statusBadge(v.lifecycle_status);
            return (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '110px 110px 90px 1fr 140px', gap: 12, padding: '13px 20px', borderBottom: i < versions.length - 1 ? '1px solid var(--border-soft)' : 'none', alignItems: 'center', fontSize: 12.5 }}>
                <span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, background: b.bg, color: b.col, border: `1px solid ${b.bord}` }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: b.dot, animation: b.anim ?? 'none', flex: 'none' }} />
                    {v.lifecycle_status}
                  </span>
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--teal)' }}>{v.image_tag ?? '—'}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{v.source_commit_sha ? v.source_commit_sha.slice(0, 7) : '—'}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{v.trigger_source}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'right' }}>
                  {v.deployed_at ? new Date(v.deployed_at).toLocaleString() : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />A carregar…</div>;
}
