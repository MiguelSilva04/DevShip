import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';

interface EnvironmentItem {
  id: string;
  name: string;
  display_name: string | null;
  namespace: string | null;
  git_ops_base_path: string | null;
  source_branch: string | null;
  gitops_branch: string | null;
  deployment_order: number;
  requires_approval: boolean;
  approval_required_role: string | null;
  application_names: string[];
}

const ROLE_LABEL: Record<string, string> = {
  CLOUD_ENGINEER: 'Cloud Engineer',
  TECH_LEAD: 'Tech Lead',
  DEVELOPER: 'Developer',
};

export default function Environments() {
  const { t } = useLanguage();
  const [envs, setEnvs] = useState<EnvironmentItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const projectId = localStorage.getItem('ob_project_id');
    if (!projectId) { setError(t('environments.errProjectNotFound')); return; }
    apiFetch(`/projects/${projectId}/environments`)
      .then(setEnvs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('environments.errLoad')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.01em', margin: 0 }}>{t('environments.title')}</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 18px', maxWidth: 620, lineHeight: 1.6 }}>
        {t('environments.subtitle')} <span style={{ color: 'var(--text-3)' }}>{t('environments.subtitleNote')}</span> {t('environments.subtitleEnd')}
      </p>

      {error && (
        <div style={{ display: 'flex', gap: 9, border: '1px solid rgba(241,85,108,.3)', background: 'rgba(241,85,108,.08)', borderRadius: 9, padding: '10px 13px', marginBottom: 16 }}>
          <span style={{ color: 'var(--red)' }}>✕</span>
          <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      {envs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {envs.map(env => {
            const count = env.application_names.length;
            return count > 0 ? (
              <div key={env.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 15 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, padding: '4px 11px', borderRadius: 7, background: 'rgba(43,199,180,.1)', color: 'var(--teal)', border: '1px solid rgba(43,199,180,.28)' }}>{env.display_name || env.name}</span>
                  <span style={{ fontSize: 12, color: env.requires_approval ? 'var(--amber)' : 'var(--text-3)' }}>
                    {env.requires_approval
                      ? `${t('environments.approvalBy')} ${env.approval_required_role ? ROLE_LABEL[env.approval_required_role] ?? env.approval_required_role : '—'} · ${t('environments.deployOrder')} ${env.deployment_order}`
                      : `${t('environments.noApproval')} · ${t('environments.deployOrder')} ${env.deployment_order}`}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--green)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }}></span>{count} {count !== 1 ? t('environments.applications') : t('environments.application')}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '13px 22px', fontSize: 12.5 }}>
                  <InfoRow label={t('environments.namespace')} value={env.namespace} mono />
                  <InfoRow label={t('environments.gitopsPath')} value={env.git_ops_base_path} mono />
                  <InfoRow label={t('environments.branch')} value={env.gitops_branch || env.source_branch} mono />
                  <div>
                    <span style={{ color: 'var(--text-3)' }}>{t('environments.requiredRole')}</span>
                    <div style={{ marginTop: 3 }}>
                      {env.approval_required_role
                        ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 600, background: 'rgba(77,156,246,.12)', color: 'var(--blue)', border: '1px solid rgba(77,156,246,.3)' }}>{ROLE_LABEL[env.approval_required_role] ?? env.approval_required_role}</span>
                        : <span style={{ color: 'var(--text-2)' }}>—</span>}
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 15, paddingTop: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('environments.appsDeployedHere')}</span>
                  {env.application_names.map((a, i) => (
                    <span key={`${a}-${i}`} className="mono" style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>{a}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div key={env.id} style={{ border: '1px dashed var(--border)', borderRadius: 14, background: 'transparent', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, padding: '4px 11px', borderRadius: 7, background: 'transparent', color: 'var(--text-3)', border: '1px dashed var(--border)' }}>{env.display_name || env.name}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-3)', flex: 1 }}>{t('environments.noAppsAssociated')} <span style={{ color: 'var(--text-2)' }}>{t('environments.invisibleNote')}</span>.</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('environments.zeroApplications')}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, border: '1px solid var(--border-soft)', background: 'var(--bg-2)', borderRadius: 11, padding: '13px 16px', marginTop: 16 }}>
        <span style={{ color: 'var(--text-3)' }}>ⓘ</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
          {t('environments.footerNote1')} <span style={{ color: 'var(--text-2)' }}>Environment</span> {t('environments.footerNote2')} <span className="mono" style={{ color: 'var(--text-2)' }}>ApplicationEnvironment</span> {t('environments.footerNote3')}
        </span>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>{label}</span>
      <div className={mono ? 'mono' : ''} style={{ marginTop: 3, fontSize: 12.5 }}>{value ?? '—'}</div>
    </div>
  );
}
