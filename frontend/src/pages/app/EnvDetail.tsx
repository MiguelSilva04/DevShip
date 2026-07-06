import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';

type LifecycleStatus = 'Deploying' | 'Healthy' | 'Degraded' | 'Failed' | 'RolledBack' | 'Superseded';
type UpToDateStatus = 'UpToDate' | 'Outdated' | 'Unknown';

interface UpToDateResult {
  status: UpToDateStatus;
  gitops_head_sha: string | null;
  argocd_sync_revision: string | null;
  reason: string | null;
}

function upToDatePill(s: UpToDateStatus) {
  const map: Record<UpToDateStatus, { bg: string; col: string; bord: string; label: string }> = {
    UpToDate: { bg: 'rgba(52,199,89,.13)',  col: '#5dd57b', bord: 'rgba(52,199,89,.24)',  label: 'Up to date' },
    Outdated: { bg: 'rgba(224,169,59,.13)', col: '#ecc26b', bord: 'rgba(224,169,59,.26)', label: 'Outdated' },
    Unknown:  { bg: 'var(--surface)',       col: 'var(--text-3)', bord: 'var(--border)',  label: 'Unknown' },
  };
  return map[s];
}

interface DeploymentVersionDetail {
  id: string;
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
  const map: Record<string, { bg: string; col: string; bord: string; dot: string }> = {
    Healthy:    { bg: 'rgba(52,199,89,.13)',  col: '#5dd57b', bord: 'rgba(52,199,89,.24)',   dot: '#34C759' },
    Deploying:  { bg: 'rgba(224,169,59,.13)', col: '#ecc26b', bord: 'rgba(224,169,59,.26)',  dot: '#E0A93B' },
    Degraded:   { bg: 'rgba(241,85,108,.13)', col: '#ff8497', bord: 'rgba(241,85,108,.26)',  dot: '#F1556C' },
    Failed:     { bg: 'rgba(241,85,108,.13)', col: '#ff8497', bord: 'rgba(241,85,108,.26)',  dot: '#F1556C' },
    RolledBack: { bg: 'rgba(120,120,180,.13)',col: '#aab4ff', bord: 'rgba(120,120,180,.26)', dot: '#7880cc' },
    Superseded: { bg: 'rgba(150,150,150,.13)',col: 'var(--text-3)', bord: 'rgba(150,150,150,.26)', dot: '#888' },
  };
  return map[s ?? ''] ?? { bg: 'var(--surface)', col: 'var(--text-3)', bord: 'var(--border)', dot: '#888' };
}

export default function EnvDetail() {
  const { appId, aeId } = useParams<{ appId: string; aeId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<AEDetail | null>(null);
  const [envName, setEnvName] = useState('');
  const [appName, setAppName] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [error, setError] = useState('');
  const [techOpen, setTechOpen] = useState(false);
  const [upToDate, setUpToDate] = useState<UpToDateResult | null>(null);
  const [utdLoading, setUtdLoading] = useState(false);

  const loadUpToDate = useCallback(() => {
    if (!aeId) return;
    setUtdLoading(true);
    apiFetch(`/application-environments/${aeId}/up-to-date`)
      .then(setUpToDate)
      .catch(() => setUpToDate(null))
      .finally(() => setUtdLoading(false));
  }, [aeId]);

  useEffect(() => { loadUpToDate(); }, [loadUpToDate]);

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
      .catch(e => setError(e.message));
  }, [aeId]);

  if (error) return <div style={{ color: '#ff8497', fontSize: 13, padding: '40px 0' }}>{error}</div>;
  if (!data) return <Spinner />;

  const cv = data.current_version;
  const status = cv?.lifecycle_status ?? data.discovered_status ?? null;
  const p = statusPill(status);
  const label = envName || data.deployment_name;

  return (
    <div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
        {appName || appId} / {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
        <h1 style={{ fontSize: 23, fontWeight: 600, margin: 0 }}>
          {appName || appId} <span style={{ color: 'var(--text-3)' }}>/</span> {label}
        </h1>
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999, fontSize: 12, background: p.bg, color: p.col, border: `1px solid ${p.bord}` }}
          title={status === null ? 'Esta aplicação ainda não foi deployada através da DevShip — o estado fica Unknown até ao primeiro deploy.' : undefined}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, animation: status === 'Deploying' ? 'ds-pulse 1.4s infinite' : 'none' }} />
          {status ?? 'Unknown'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 22 }}>
        {upToDate?.status === 'UpToDate' ? (() => {
          const u = upToDatePill(upToDate.status);
          return (
            <button
              onClick={loadUpToDate}
              disabled={utdLoading}
              title={upToDate.reason ?? undefined}
              className="btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '9px 14px', borderRadius: 8, background: u.bg, color: u.col, border: `1px solid ${u.bord}`, cursor: utdLoading ? 'not-allowed' : 'pointer' }}
            >
              {utdLoading ? '…' : u.label}
            </button>
          );
        })() : (
          <button
            onClick={() => nav(`/app/${appId}/${aeId}/deploy`)}
            className="btn-primary hover-bright"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '9px 16px', borderRadius: 8 }}
          >
            <UpArrow /> {requiresApproval ? 'Solicitar deploy →' : 'Deploy →'}
          </button>
        )}
        <button onClick={() => nav(`/app/${appId}/${aeId}/rollback`)} className="btn-ghost" style={{ fontSize: 12.5, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>Rollback</button>
        <button onClick={() => nav(`/app/${appId}/${aeId}/history`)} className="btn-ghost" style={{ fontSize: 12.5, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>Histórico</button>
        <button onClick={() => setTechOpen(v => !v)} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{techOpen ? '▼' : '▶'}</span> Ver detalhes técnicos
        </button>
      </div>

      {techOpen && (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', margin: '-8px 0 22px', padding: '14px 16px', border: '1px solid var(--border-soft)', borderRadius: 12, background: 'var(--bg-2)' }}>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-3)', alignSelf: 'center', marginRight: 4 }}>debug ·</span>
          {([['Eventos', `/app/${appId}/${aeId}/events`], ['Logs', `/app/${appId}/${aeId}/logs`], ['Health Details', `/app/${appId}/${aeId}/health`], ['Pods', `/app/${appId}/${aeId}/pods`]] as [string, string][]).map(([l, path]) => (
            <button key={l} onClick={() => nav(path)} className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8 }}>{l}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px' }}>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>Versão atual</div>
          {cv ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 12.5 }}>
              {([
                ['Version', cv.image_tag ?? '—', 'var(--teal)'],
                ['Commit', cv.source_commit_sha ? cv.source_commit_sha.slice(0, 7) : '—', ''],
                [`HEAD (${label.toUpperCase()})`, upToDate?.gitops_head_sha ? upToDate.gitops_head_sha.slice(0, 7) : '—', ''],
                ['Started', cv.deployed_at ? new Date(cv.deployed_at).toLocaleString() : '—', ''],
                ['Autor', cv.requested_by_email ?? '—', ''],
              ] as [string, string, string][]).map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>{k}</span>
                  <span className="mono" style={{ color: c || 'inherit' }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Sem deploys ainda.</div>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Health</span>
            <span onClick={() => nav(`/app/${appId}/${aeId}/health`)} style={{ fontSize: 11.5, color: 'var(--teal)', cursor: 'pointer' }}>Ver health details →</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12.5 }}>
            {status === 'Deploying' ? (
              <>
                <ProbeRow label="Startup probe" state="checking" />
                <ProbeRow label="Readiness probe" state="waiting" />
                <ProbeRow label="Liveness probe" state="pending" />
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 14, borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>O novo pod ainda está a arrancar.</div>
              </>
            ) : status === 'Healthy' ? (
              <>
                <ProbeRow label="Startup probe" state="passing" />
                <ProbeRow label="Readiness probe" state="passing" />
                <ProbeRow label="Liveness probe" state="passing" />
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 14, borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>Sem erros recentes.</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Estado: {status ?? 'Desconhecido'}. Ver Health Details para mais info.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProbeRow({ label, state }: { label: string; state: 'passing' | 'checking' | 'waiting' | 'pending' }) {
  const icon = state === 'passing'
    ? <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(52,199,89,.16)', border: '1.5px solid #34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5dd57b', fontSize: 10, flex: 'none' }}>✓</span>
    : state === 'checking'
    ? <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--amber)', animation: 'ds-spin .9s linear infinite', flex: 'none' }} />
    : state === 'waiting'
    ? <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--border)', flex: 'none' }} />
    : <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed var(--border)', flex: 'none' }} />;

  const statusCol = state === 'passing' ? '#5dd57b' : state === 'checking' ? '#ecc26b' : 'var(--text-3)';
  const statusLabel = state === 'passing' ? 'Passing' : state === 'checking' ? 'Checking…' : state === 'waiting' ? 'Waiting' : '–';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {icon}
      <span>{label}</span>
      <span style={{ marginLeft: 'auto', color: statusCol }}>{statusLabel}</span>
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />A carregar…</div>;
}

function UpArrow() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M12 5L6.5 11M12 5L17.5 11" stroke="var(--teal-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
