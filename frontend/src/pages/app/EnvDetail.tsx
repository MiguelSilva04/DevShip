import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, type ApiError } from '../../api/client';
import { type LifecycleStatus, type UpToDateStatus, lifecycleColor, lifecycleLabel, upToDateLabel } from '../../lib/lifecycle';
import Breadcrumb from '../../components/Breadcrumb';
import { useLanguage } from '../../context/LanguageContext';
import AccessDenied from '../../components/AccessDenied';

interface UpToDateResult {
  status: UpToDateStatus;
  source_head_sha: string | null;
  argocd_sync_revision: string | null;
  reason: string | null;
  gitops_drift_status: UpToDateStatus;
  gitops_path_head_sha: string | null;
  gitops_reason: string | null;
}

function upToDatePill(s: UpToDateStatus, UP_TO_DATE_LABEL: Record<UpToDateStatus, string>) {
  const map: Record<UpToDateStatus, { bg: string; col: string; bord: string; label: string }> = {
    UpToDate: { bg: 'rgba(52,199,89,.13)',  col: 'var(--green)', bord: 'rgba(52,199,89,.24)',  label: UP_TO_DATE_LABEL.UpToDate },
    Outdated: { bg: 'rgba(224,169,59,.13)', col: 'var(--amber)', bord: 'rgba(224,169,59,.26)', label: UP_TO_DATE_LABEL.Outdated },
    Unknown:  { bg: 'var(--surface)',       col: 'var(--text-3)', bord: 'var(--border)',  label: UP_TO_DATE_LABEL.Unknown },
  };
  return map[s];
}

interface DeploymentVersionDetail {
  id: string;
  deployment_request_id: string | null;
  image_tag: string | null;
  source_commit_sha: string | null;
  lifecycle_status: LifecycleStatus;
  deployed_at: string | null;
  created_at: string;
  requested_by_email: string | null;
}

interface AEDetail {
  id: string;
  application_id: string;
  environment_id: string;
  deployment_name: string;
  enabled: boolean;
  current_version: DeploymentVersionDetail | null;
  discovered_status: LifecycleStatus | null;
}

function statusPill(s: LifecycleStatus | null) {
  return lifecycleColor(s, { bg: 'var(--surface)', col: 'var(--text-3)', bord: 'var(--border)', dot: '#888' });
}

export default function EnvDetail() {
  const { appId, aeId } = useParams<{ appId: string; aeId: string }>();
  const nav = useNavigate();
  const { t } = useLanguage();
  const LIFECYCLE_LABEL = lifecycleLabel(t);
  const UP_TO_DATE_LABEL = upToDateLabel(t);
  const [data, setData] = useState<AEDetail | null>(null);
  const [envName, setEnvName] = useState('');
  const [appName, setAppName] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [upToDate, setUpToDate] = useState<UpToDateResult | null>(null);
  const [utdLoading, setUtdLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const loadUpToDate = useCallback(() => {
    if (!aeId) return;
    setUtdLoading(true);
    apiFetch(`/application-environments/${aeId}/up-to-date`)
      .then(setUpToDate)
      .catch(() => setUpToDate(null))
      .finally(() => setUtdLoading(false));
  }, [aeId]);

  // Recomputa sempre que a versão atual muda (novo deploy concluído) — sem depender de
  // data?.current_version?.id, esta chamada só corria uma vez no mount e o badge ficava
  // preso no valor do primeiro load mesmo depois de um deploy terminar nesta página.
  useEffect(() => { loadUpToDate(); }, [loadUpToDate, data?.current_version?.id]);

  useEffect(() => {
    if (!aeId) return;
    // Enquanto um pedido está PENDING (à espera de aprovação), ainda não existe
    // DeploymentVersion nenhuma — é só criada quando trigger_deploy arranca o pipeline.
    // Sem isto, sair desta página com um pedido pendente e voltar mais tarde não dava
    // nenhuma forma de encontrar de novo esse pedido.
    apiFetch(`/deployment-requests?request_status=PENDING`)
      .then((rows: { id: string; application_environment_id: string }[]) => {
        const pending = rows.find(r => r.application_environment_id === aeId);
        setPendingRequestId(pending?.id ?? null);
      })
      .catch(() => setPendingRequestId(null));
  }, [aeId]);

  useEffect(() => {
    if (!aeId) return;
    apiFetch(`/application-environments/${aeId}`)
      .then((d: AEDetail) => {
        setData(d);
        // fetch app name and env requires_approval in parallel
        const projectId = localStorage.getItem('ob_project_id');
        Promise.all([
          apiFetch(`/applications/${d.application_id}`).catch(() => null),
          projectId ? apiFetch(`/projects/${projectId}/environments`).catch(() => null) : Promise.resolve(null),
        ]).then(([app, envs]) => {
          if (app) setAppName(app.name);
          if (envs && Array.isArray(envs)) {
            const env = envs.find((e: { id: string }) => e.id === d.environment_id);
            if (env) {
              setEnvName(env.name);
              setRequiresApproval(env.requires_approval);
            }
          }
        });
      })
      .catch((e: ApiError) => { if (e.status === 403) setForbidden(true); else setError(e.message); });
  }, [aeId]);

  if (forbidden) return <AccessDenied />;
  if (error) return <div style={{ color: 'var(--red)', fontSize: 13, padding: '40px 0' }}>{error}</div>;
  if (!data) return <Spinner />;

  const cv = data.current_version;
  const status = cv?.lifecycle_status ?? data.discovered_status ?? null;
  const p = statusPill(status);
  const label = envName || data.deployment_name;

  return (
    <div>
      <Breadcrumb segments={[
        { label: t('envDetail.breadcrumbApps'), to: '/app/home' },
        { label: appName || appId || '', to: (appId) ? `/app/${appId}` : undefined },
        { label },
      ]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
        <h1 style={{ fontSize: 23, fontWeight: 600, margin: 0 }}>
          {appName || appId} <span style={{ color: 'var(--text-3)' }}>/</span> {label}
        </h1>
        <span
          className={status === null ? 'ds-tooltip' : undefined}
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999, fontSize: 12, background: p.bg, color: p.col, border: `1px solid ${p.bord}` }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, animation: status === 'Deploying' ? 'ds-pulse 1.4s infinite' : 'none' }} />
          {status ? LIFECYCLE_LABEL[status] : t('envDetail.unknown')}
          {status === null && (
            <span className="ds-tooltip-bubble">
              {t('envDetail.notDeployedTooltip1')} "{appName || appId}" {t('envDetail.notDeployedTooltip2')} <em>{t('envDetail.notDeployedTooltip2Emphasis')}</em> {t('envDetail.notDeployedTooltip3')} {label} {t('envDetail.notDeployedTooltip4')}
            </span>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 22 }}>
        {pendingRequestId ? (
          <button
            onClick={() => nav(`/app/approvals/${pendingRequestId}`)}
            className="btn-primary hover-bright"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '9px 16px', borderRadius: 8 }}
          >
            {t('envDetail.viewPendingRequest')}
          </button>
        ) : status === 'Deploying' && cv?.deployment_request_id ? (
          <button
            onClick={() => nav(`/app/${appId}/${aeId}/exec/${cv.deployment_request_id}`)}
            className="btn-primary hover-bright"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '9px 16px', borderRadius: 8 }}
          >
            {t('envDetail.viewRunningExecution')}
          </button>
        ) : utdLoading && !upToDate ? (
          <button disabled className="btn-ghost" style={{ fontSize: 12.5, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'default', opacity: .7 }}>
            {t('envDetail.checking')}
          </button>
        ) : upToDate?.status === 'UpToDate' ? (() => {
          const u = upToDatePill(upToDate.status, UP_TO_DATE_LABEL);
          return (
            <button
              disabled
              title={t('envDetail.alreadyDeployedTitle')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '9px 14px', borderRadius: 8, background: u.bg, color: u.col, border: `1px solid ${u.bord}`, cursor: 'default', opacity: .85 }}
            >
              {u.label}
            </button>
          );
        })() : (
          <button
            onClick={() => nav(`/app/${appId}/${aeId}/deploy`)}
            className="btn-primary hover-bright"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '9px 16px', borderRadius: 8 }}
          >
            <UpArrow /> {requiresApproval ? t('envDetail.requestDeploy') : t('envDetail.deploy')}
          </button>
        )}
        <button onClick={() => nav(`/app/${appId}/${aeId}/rollback`)} className="btn-ghost" style={{ fontSize: 12.5, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>{t('envDetail.rollback')}</button>
        <button onClick={() => nav(`/app/${appId}/${aeId}/history`)} className="btn-ghost" style={{ fontSize: 12.5, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>{t('envDetail.history')}</button>
        <button onClick={() => setTechOpen(v => !v)} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{techOpen ? '▼' : '▶'}</span> {t('envDetail.viewTechDetails')}
        </button>
      </div>

      {upToDate?.gitops_drift_status === 'Outdated' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', border: '1px solid rgba(224,169,59,.35)', borderRadius: 9, background: 'rgba(224,169,59,.07)', fontSize: 12, color: 'var(--amber)', marginBottom: 22 }}>
          <span>⚠</span> {t('envDetail.gitopsDriftWarning')}
        </div>
      )}

      {techOpen && (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', margin: '-8px 0 22px', padding: '14px 16px', border: '1px solid var(--border-soft)', borderRadius: 12, background: 'var(--bg-2)' }}>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-3)', alignSelf: 'center', marginRight: 4 }}>{t('envDetail.debugLabel')}</span>
          {([[t('envDetail.events'), `/app/${appId}/${aeId}/events`], [t('envDetail.logs'), `/app/${appId}/${aeId}/logs`], [t('envDetail.healthDetails'), `/app/${appId}/${aeId}/health`], [t('envDetail.pods'), `/app/${appId}/${aeId}/pods`]] as [string, string][]).map(([l, path]) => (
            <button key={l} onClick={() => nav(path)} className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8 }}>{l}</button>
          ))}
        </div>
      )}

      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px' }}>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>{t('envDetail.currentVersion')}</div>
          {cv ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 12.5 }}>
              {([
                [t('envDetail.commitOfVersion'), cv.source_commit_sha ? cv.source_commit_sha.slice(0, 7) : '—', 'var(--teal)'],
                [t('envDetail.repoHead'), upToDate?.source_head_sha ? upToDate.source_head_sha.slice(0, 7) : '—', ''],
                [t('envDetail.started'), cv.deployed_at ? new Date(cv.deployed_at).toLocaleString() : '—', ''],
                [t('envDetail.author'), cv.requested_by_email ?? '—', ''],
              ] as [string, string, string][]).map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>{k}</span>
                  <span className="mono" style={{ color: c || 'inherit' }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('envDetail.noDeploysYet')}</div>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{t('envDetail.health')}</span>
            <span onClick={() => nav(`/app/${appId}/${aeId}/health`)} style={{ fontSize: 11.5, color: 'var(--teal)', cursor: 'pointer' }}>{t('envDetail.viewHealthDetails')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12.5 }}>
            {status === 'Deploying' ? (
              <>
                <ProbeRow label={t('envDetail.startupProbe')} state="checking" />
                <ProbeRow label={t('envDetail.readinessProbe')} state="waiting" />
                <ProbeRow label={t('envDetail.livenessProbe')} state="pending" />
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 14, borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>{t('envDetail.podStillStarting')}</div>
              </>
            ) : status === 'Healthy' ? (
              <>
                <ProbeRow label={t('envDetail.startupProbe')} state="passing" />
                <ProbeRow label={t('envDetail.readinessProbe')} state="passing" />
                <ProbeRow label={t('envDetail.livenessProbe')} state="passing" />
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 14, borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>{t('envDetail.noRecentErrors')}</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('envDetail.stateLabel')} {status ? LIFECYCLE_LABEL[status] : t('envDetail.unknown')}. {t('envDetail.seeHealthForMore')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProbeRow({ label, state }: { label: string; state: 'passing' | 'checking' | 'waiting' | 'pending' }) {
  const { t } = useLanguage();
  const icon = state === 'passing'
    ? <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(52,199,89,.16)', border: '1.5px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', fontSize: 10, flex: 'none' }}>✓</span>
    : state === 'checking'
    ? <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--amber)', animation: 'ds-spin .9s linear infinite', flex: 'none' }} />
    : state === 'waiting'
    ? <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--border)', flex: 'none' }} />
    : <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed var(--border)', flex: 'none' }} />;

  const statusCol = state === 'passing' ? 'var(--green)' : state === 'checking' ? 'var(--amber)' : 'var(--text-3)';
  const statusLabel = state === 'passing' ? t('envDetail.probePassing') : state === 'checking' ? t('envDetail.probeChecking') : state === 'waiting' ? t('envDetail.probeWaiting') : '–';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {icon}
      <span>{label}</span>
      <span style={{ marginLeft: 'auto', color: statusCol }}>{statusLabel}</span>
    </div>
  );
}

function Spinner() {
  const { t } = useLanguage();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />{t('common.loading')}</div>;
}

function UpArrow() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M12 5L6.5 11M12 5L17.5 11" stroke="var(--teal-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
