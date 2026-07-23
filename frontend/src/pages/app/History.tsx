import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, type ApiError } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';
import Breadcrumb from '../../components/Breadcrumb';
import { type LifecycleStatus, LIFECYCLE_COLOR, lifecycleLabel } from '../../lib/lifecycle';
import { useLanguage } from '../../context/LanguageContext';
import AccessDenied from '../../components/AccessDenied';

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
  const anim = s === 'Deploying' ? 'ds-pulse 1.4s infinite' : undefined;
  return { ...(LIFECYCLE_COLOR[s] ?? LIFECYCLE_COLOR.Healthy), anim };
}

export default function History() {
  const { appId, aeId } = useParams<{ appId?: string; aeId?: string }>();
  const { appLabel, envLabel, appId: resolvedAppId } = useAppEnvBreadcrumb(appId, aeId);
  const { t } = useLanguage();
  const LIFECYCLE_LABEL = lifecycleLabel(t);
  const [versions, setVersions] = useState<DeploymentVersionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!aeId) { setError(t('history.errNoAe')); setLoading(false); return; }
    apiFetch(`/application-environments/${aeId}/history?limit=50`)
      .then((data: DeploymentVersionDetail[]) => { setVersions(data); setLoading(false); })
      .catch((e: ApiError) => {
        if (e.status === 403) setForbidden(true); else setError(e.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aeId]);

  if (loading) return <Spinner />;
  if (forbidden) return <AccessDenied />;
  if (error) return <div style={{ color: 'var(--red)', fontSize: 13, padding: '40px 0' }}>{error}</div>;

  return (
    <div>
      <Breadcrumb segments={[
        { label: appLabel, to: resolvedAppId ? `/app/${resolvedAppId}` : undefined },
        { label: envLabel, to: (resolvedAppId && aeId) ? `/app/${resolvedAppId}/${aeId}` : undefined },
        { label: t('history.breadcrumbHistory') },
      ]} />
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.01em', margin: '8px 0 22px' }}>{t('history.title')}</h1>

      {versions.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '20px 0' }}>{t('history.noDeployments')}</div>
      ) : (
        <>
        <div className="responsive-table-hint" style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>↔ desliza para o lado para ver todas as colunas</div>
        <div className="responsive-table-grid" style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
          <div style={{ minWidth: 620, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 110px 90px 1fr 140px', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            <span>{t('history.statusCol')}</span><span>{t('history.versionCol')}</span><span>{t('history.commitCol')}</span><span>{t('history.sourceCol')}</span><span style={{ textAlign: 'right' }}>{t('history.deployedAtCol')}</span>
          </div>
          {versions.map((v, i) => {
            const b = statusBadge(v.lifecycle_status);
            return (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '110px 110px 90px 1fr 140px', gap: 12, padding: '13px 20px', borderBottom: i < versions.length - 1 ? '1px solid var(--border-soft)' : 'none', alignItems: 'center', fontSize: 12.5 }}>
                <span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, background: b.bg, color: b.col, border: `1px solid ${b.bord}` }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: b.dot, animation: b.anim ?? 'none', flex: 'none' }} />
                    {LIFECYCLE_LABEL[v.lifecycle_status] ?? v.lifecycle_status}
                  </span>
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--teal)' }}>{v.image_tag ?? '—'}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{v.source_commit_sha ? v.source_commit_sha.slice(0, 7) : '—'}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{v.trigger_source === 'DEVSHIP' ? t('history.sourceDevShip') : t('history.sourceExternal')}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'right' }}>
                  {v.deployed_at ? new Date(v.deployed_at).toLocaleString() : '—'}
                </span>
              </div>
            );
          })}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  const { t } = useLanguage();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />{t('history.loading')}</div>;
}
