import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { apiFetch, type ApiError } from '../../api/client';
import GithubIdentityPrompt, { GITHUB_IDENTITY_ERROR } from '../../components/GithubIdentityPrompt';
import Breadcrumb from '../../components/Breadcrumb';
import { upToDateLabel } from '../../lib/lifecycle';
import { useLanguage } from '../../context/LanguageContext';
import AccessDenied from '../../components/AccessDenied';

interface AEDetail {
  id: string;
  application_id: string;
  environment_id: string;
  deployment_name: string;
  current_version: { image_tag: string | null; source_commit_sha: string | null } | null;
}

interface PendingCommit {
  sha: string;
  type: string | null;
  message: string;
  author: string;
  date: string;
}

interface PendingCommitsResponse {
  current_sha: string | null;
  head_sha: string | null;
  commits: PendingCommit[];
  reason: string | null;
}

const COMMIT_TYPE_COLOR: Record<string, string> = {
  feat: 'var(--green)',
  fix: 'var(--amber)',
  chore: 'var(--text-3)',
  docs: 'var(--blue)',
  refactor: '#c792ea',
  test: 'var(--blue)',
};

export default function Deploy() {
  const { appId, aeId } = useParams<{ appId: string; aeId: string }>();
  const nav = useNavigate();
  const { user } = useUser();
  const { t } = useLanguage();
  const UP_TO_DATE_LABEL = upToDateLabel(t);

  const [aeDetail, setAeDetail] = useState<AEDetail | null>(null);
  const [appName, setAppName] = useState('');
  const [envName, setEnvName] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [pending, setPending] = useState<PendingCommitsResponse | null>(null);

  useEffect(() => {
    if (!aeId) return;
    const projectId = localStorage.getItem('ob_project_id');
    (async () => {
      const d: AEDetail = await apiFetch(`/application-environments/${aeId}`);
      setAeDetail(d);
      const [app, envs, pendingCommits] = await Promise.all([
        apiFetch(`/applications/${d.application_id}`),
        projectId ? apiFetch(`/projects/${projectId}/environments`) : Promise.resolve([]),
        apiFetch(`/application-environments/${aeId}/pending-commits`),
      ]);
      setAppName(app.name);
      const env = (envs as { id: string; name: string; requires_approval: boolean }[]).find(e => e.id === d.environment_id);
      if (env) { setEnvName(env.name); setRequiresApproval(env.requires_approval); }
      setPending(pendingCommits);
    })().catch((e: ApiError) => { if (e.status === 403) setForbidden(true); else setError(e.message); });
  }, [aeId]);

  async function submit() {
    if (!aeId) return;
    setLoading(true);
    setError('');
    try {
      const req = await apiFetch(`/application-environments/${aeId}/deploy`, {
        method: 'POST',
        body: JSON.stringify({ justification: justification || null }),
      });
      // req.id is the deployment_request id — navigate to execution screen
      nav(`/app/${appId}/${aeId}/exec/${req.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('409') || msg.toLowerCase().includes('em curso') || msg.toLowerCase().includes('already')) {
        setError(t('deploy.errDeployInProgress'));
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  const envLabel = envName || aeDetail?.deployment_name || aeId || '';
  const appLabel = appName || appId || '';
  // Já up to date: sem commit anterior não há nada para comparar (deixa prosseguir, é o
  // primeiro deploy); com deploy anterior e pending-commits a devolver 0 commits novos,
  // não há nada para enviar — mesma regra usada no botão da lista em EnvDetail.tsx.
  const isUpToDate = !!aeDetail?.current_version && !!pending && !pending.reason && pending.commits.length === 0;

  if (forbidden) return <AccessDenied />;

  return (
    <div style={{ maxWidth: 720 }}>
      <Breadcrumb segments={[
        { label: appLabel, to: appId ? `/app/${appId}` : undefined },
        { label: envLabel, to: (appId && aeId) ? `/app/${appId}/${aeId}` : undefined },
        { label: t('deploy.breadcrumbDeploy') },
      ]} />
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>
        {requiresApproval ? t('deploy.requestDeploy') : t('deploy.deploy')} — <span style={{ color: 'var(--text-2)' }}>{envLabel}</span>
      </h1>

      {requiresApproval && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', border: '1px solid rgba(224,169,59,.35)', borderRadius: 9, background: 'rgba(224,169,59,.07)', fontSize: 12, color: 'var(--amber)', margin: '10px 0 18px' }}>
          <span>⚠</span> {t('deploy.approvalNotice')}
        </div>
      )}

      {/* Nova versão */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>{t('deploy.newVersion')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13 }}>
          <div>
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{t('deploy.commitOfVersion')}</span>
            <div className="mono" style={{ marginTop: 3 }}>
              {aeDetail?.current_version
                ? (aeDetail.current_version.source_commit_sha ?? pending?.current_sha ?? '').slice(0, 7) || '—'
                : t('deploy.noPreviousDeploy')}
            </div>
          </div>
          {pending?.head_sha && (
            <>
              <span style={{ color: 'var(--text-3)' }}>→</span>
              <div>
                <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{t('deploy.headForEnv')} ({envLabel.toUpperCase()})</span>
                <div className="mono" style={{ marginTop: 3, color: 'var(--teal)', fontWeight: 600 }}>{pending.head_sha.slice(0, 7)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Commits incluídos */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>
          {t('deploy.commitsIncluded')} {pending && pending.commits.length > 0 && `(${pending.commits.length})`}
        </div>
        {pending?.reason ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{pending.reason}</div>
        ) : pending && pending.commits.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{t('deploy.noNewCommits')}</div>
        ) : pending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.commits.map(c => (
              <div key={c.sha} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13 }}>
                {c.type && (
                  <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: COMMIT_TYPE_COLOR[c.type] ?? 'var(--text-3)', minWidth: 42 }}>{c.type}</span>
                )}
                <span style={{ flex: 1 }}>{c.message}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{c.author} · {c.date.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{t('deploy.loading')}</div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>
          {t('deploy.justification')} <span style={{ color: 'var(--text-3)' }}>{t('deploy.optional')}</span>
        </label>
        <textarea
          value={justification}
          onChange={e => setJustification(e.target.value)}
          placeholder={requiresApproval ? t('deploy.justificationPlaceholderApproval') : t('deploy.justificationPlaceholderNormal')}
          rows={3}
          style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(241,85,108,.08)', border: '1px solid rgba(241,85,108,.3)', fontSize: 12.5, color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          {error === GITHUB_IDENTITY_ERROR && <GithubIdentityPrompt onConfigured={() => setError('')} />}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {!pending ? (
          <button disabled style={{ fontSize: 13, padding: '10px 20px', borderRadius: 9, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)', cursor: 'default', opacity: .7 }}>
            {t('deploy.checking')}
          </button>
        ) : isUpToDate ? (
          <button
            disabled
            title={t('deploy.alreadyDeployedTitle')}
            style={{ fontSize: 13, padding: '10px 20px', borderRadius: 9, fontWeight: 600, background: 'rgba(52,199,89,.13)', color: 'var(--green)', border: '1px solid rgba(52,199,89,.24)', cursor: 'default' }}
          >
            {UP_TO_DATE_LABEL.UpToDate}
          </button>
        ) : (
          <button
            className="btn-primary hover-bright"
            onClick={submit}
            disabled={loading}
            style={{ fontSize: 13, padding: '10px 20px', borderRadius: 9, fontWeight: 600, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? t('deploy.sending') : requiresApproval ? t('deploy.requestDeployButton') : t('deploy.confirmDeployButton')}
          </button>
        )}
        <button onClick={() => nav(`/app/${appId}/${aeId}`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>{t('deploy.cancel')}</button>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>
          {t('deploy.deployingAs')} <span style={{ color: 'var(--text-2)' }}>{user?.name ?? '—'}</span>
        </span>
      </div>
    </div>
  );
}
