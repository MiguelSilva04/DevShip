import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { apiFetch } from '../../api/client';
import GithubIdentityPrompt, { GITHUB_IDENTITY_ERROR } from '../../components/GithubIdentityPrompt';

interface DeploymentVersionDetail {
  id: string;
  image_tag: string | null;
  source_commit_sha: string | null;
  lifecycle_status: string;
  created_at: string;
}

interface AEDetail {
  id: string;
  application_id: string;
  environment_id: string;
  deployment_name: string;
  current_version: DeploymentVersionDetail | null;
}

export default function Rollback() {
  const { appId, aeId } = useParams<{ appId: string; aeId: string }>();
  const nav = useNavigate();
  const { user } = useUser();

  const [current, setCurrent] = useState<DeploymentVersionDetail | null>(null);
  const [target, setTarget] = useState<DeploymentVersionDetail | null>(null);
  const [envName, setEnvName] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!aeId) return;
    const projectId = localStorage.getItem('ob_project_id');
    (async () => {
      const ae: AEDetail = await apiFetch(`/application-environments/${aeId}`);
      setCurrent(ae.current_version);

      const [hist, envs] = await Promise.all([
        apiFetch(`/application-environments/${aeId}/history?limit=50`),
        projectId ? apiFetch(`/projects/${projectId}/environments`) : Promise.resolve([]),
      ]);

      // Rollback always targets the last version that was healthy, excluding the current
      // one — no manual selection (design doc rule). Superseded means "was Healthy, later
      // replaced", and RolledBack means "was abandoned via a rollback" — both count here,
      // mirroring the backend's target lookup (backend/api/routes/deploy.py create_rollback).
      const lastValid = (hist as DeploymentVersionDetail[]).find(
        v => (v.lifecycle_status === 'Healthy' || v.lifecycle_status === 'Superseded' || v.lifecycle_status === 'RolledBack')
          && v.id !== ae.current_version?.id
      );
      setTarget(lastValid ?? null);

      const env = (envs as { id: string; name: string; requires_approval: boolean }[]).find(e => e.id === ae.environment_id);
      if (env) { setEnvName(env.name); setRequiresApproval(env.requires_approval); }
      setReady(true);
    })().catch(e => { setError(e.message); setReady(true); });
  }, [aeId]);

  async function submit() {
    if (!aeId || !target) return;
    setLoading(true);
    setError('');
    try {
      const req = await apiFetch(`/application-environments/${aeId}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ justification: justification || null }),
      });
      nav(`/app/${appId}/${aeId}/exec/${req.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('409') || msg.toLowerCase().includes('em curso') || msg.toLowerCase().includes('already')) {
        setError('Já existe um deploy em curso para este environment.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  const envLabel = envName || aeId || '';
  const targetingRolledBack = target?.lifecycle_status === 'RolledBack';
  const approvalNeeded = requiresApproval || targetingRolledBack;

  return (
    <div style={{ maxWidth: 660 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>{appId} / {envLabel} / rollback</div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Rollback — <span style={{ color: 'var(--text-2)' }}>{envLabel}</span></h1>
      <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '0 0 18px' }}>
        Reverte sempre para a última versão saudável — não é possível escolher outra versão manualmente.
      </p>

      {requiresApproval && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', border: '1px solid rgba(224,169,59,.35)', borderRadius: 9, background: 'rgba(224,169,59,.07)', fontSize: 12, color: '#ecc26b', margin: '10px 0 18px' }}>
          <span>⚠</span> Este environment requer aprovação para rollback.
        </div>
      )}

      {targetingRolledBack && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', border: '1px solid rgba(241,85,108,.35)', borderRadius: 9, background: 'rgba(241,85,108,.07)', fontSize: 12, color: '#ff8497', margin: '10px 0 18px' }}>
          <span>⚠</span> Esta versão foi anteriormente abandonada via rollback. Justificação obrigatória e aprovação de Tech Lead/Cloud Engineer.
        </div>
      )}

      {/* Current version */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '18px 22px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>Versão atual (FROM)</div>
        {current ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--teal)' }}>{current.source_commit_sha ? current.source_commit_sha.slice(0, 7) : '—'}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(current.created_at).toLocaleString()}</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Sem deploys ainda.</div>
        )}
      </div>

      {/* Target version — last healthy, no manual selection */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          Última versão saudável (TO)
        </div>
        {target ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{target.source_commit_sha ? target.source_commit_sha.slice(0, 7) : '—'}</span>
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{new Date(target.created_at).toLocaleString()}</div>
            </div>
          </div>
        ) : ready ? (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>Sem versão saudável anterior para rollback.</div>
        ) : (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>A carregar…</div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>
          Justificação {!targetingRolledBack && <span style={{ color: 'var(--text-3)' }}>(opcional)</span>}
        </label>
        <textarea
          value={justification}
          onChange={e => setJustification(e.target.value)}
          placeholder={approvalNeeded ? 'Descreve o motivo deste pedido de rollback…' : 'Notas sobre este rollback…'}
          rows={3}
          style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(241,85,108,.08)', border: '1px solid rgba(241,85,108,.3)', fontSize: 12.5, color: '#ff8497', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          {error === GITHUB_IDENTITY_ERROR && <GithubIdentityPrompt onConfigured={() => setError('')} />}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          className="hover-bright"
          onClick={submit}
          disabled={loading || !target || (targetingRolledBack && !justification.trim())}
          style={{ fontSize: 13, padding: '10px 20px', borderRadius: 9, fontWeight: 600, background: 'rgba(241,85,108,.15)', color: '#ff8497', border: '1px solid rgba(241,85,108,.35)', cursor: (loading || !target || (targetingRolledBack && !justification.trim())) ? 'not-allowed' : 'pointer', opacity: (loading || !target || (targetingRolledBack && !justification.trim())) ? 0.7 : 1 }}
        >
          {loading ? 'A enviar…' : approvalNeeded ? 'Enviar pedido de rollback' : 'Confirmar rollback'}
        </button>
        <button onClick={() => nav(`/app/${appId}/${aeId}`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>Cancelar</button>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>
          Como <span style={{ color: 'var(--text-2)' }}>{user?.name ?? '—'}</span>
        </span>
      </div>
    </div>
  );
}
