import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { apiFetch } from '../../api/client';

interface DeploymentVersionDetail {
  id: string;
  image_tag: string | null;
  version_label: string | null;
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
  const [history, setHistory] = useState<DeploymentVersionDetail[]>([]);
  const [envName, setEnvName] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [target, setTarget] = useState<string>('');
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      // Only versions with a real image can be rolled back to, and never the current one.
      const targets = (hist as DeploymentVersionDetail[]).filter(
        v => v.image_tag && v.id !== ae.current_version?.id
      );
      setHistory(targets);
      if (targets.length > 0) setTarget(targets[0].id);

      const env = (envs as { id: string; name: string; requires_approval: boolean }[]).find(e => e.id === ae.environment_id);
      if (env) { setEnvName(env.name); setRequiresApproval(env.requires_approval); }
    })().catch(e => setError(e.message));
  }, [aeId]);

  async function submit() {
    if (!aeId || !target) return;
    setLoading(true);
    setError('');
    try {
      const req = await apiFetch(`/application-environments/${aeId}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ deployment_version_id: target, justification: justification || null }),
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

  return (
    <div style={{ maxWidth: 660 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>{appId} / {envLabel} / rollback</div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Rollback — <span style={{ color: 'var(--text-2)' }}>{envLabel}</span></h1>

      {requiresApproval && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', border: '1px solid rgba(224,169,59,.35)', borderRadius: 9, background: 'rgba(224,169,59,.07)', fontSize: 12, color: '#ecc26b', margin: '10px 0 18px' }}>
          <span>⚠</span> Este environment requer aprovação para rollback.
        </div>
      )}

      {/* Current version */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '18px 22px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>Versão atual (FROM)</div>
        {current ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--teal)' }}>{current.version_label ?? current.image_tag ?? '—'}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{current.source_commit_sha ? current.source_commit_sha.slice(0, 7) : '—'}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(current.created_at).toLocaleString()}</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Sem deploys ainda.</div>
        )}
      </div>

      {/* Target version */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          Escolhe a versão para reverter (TO)
        </div>
        {history.map((h, i) => (
          <label key={h.id} htmlFor={`rb-${h.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', cursor: 'pointer', borderBottom: i < history.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            <input id={`rb-${h.id}`} type="radio" name="target" checked={target === h.id} onChange={() => setTarget(h.id)} style={{ marginTop: 3, accentColor: 'var(--teal)', flex: 'none' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{h.version_label ?? h.image_tag}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{h.source_commit_sha ? h.source_commit_sha.slice(0, 7) : '—'}</span>
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{new Date(h.created_at).toLocaleString()}</div>
            </div>
          </label>
        ))}
        {history.length === 0 && (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>Sem versões elegíveis para rollback.</div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>
          Justificação <span style={{ color: 'var(--text-3)' }}>(opcional)</span>
        </label>
        <textarea
          value={justification}
          onChange={e => setJustification(e.target.value)}
          placeholder={requiresApproval ? 'Descreve o motivo deste pedido de rollback…' : 'Notas sobre este rollback…'}
          rows={3}
          style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(241,85,108,.08)', border: '1px solid rgba(241,85,108,.3)', fontSize: 12.5, color: '#ff8497' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          className="hover-bright"
          onClick={submit}
          disabled={loading || !target}
          style={{ fontSize: 13, padding: '10px 20px', borderRadius: 9, fontWeight: 600, background: 'rgba(241,85,108,.15)', color: '#ff8497', border: '1px solid rgba(241,85,108,.35)', cursor: loading || !target ? 'not-allowed' : 'pointer', opacity: loading || !target ? 0.7 : 1 }}
        >
          {loading ? 'A enviar…' : requiresApproval ? 'Enviar pedido de rollback' : 'Confirmar rollback'}
        </button>
        <button onClick={() => nav(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>Cancelar</button>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>
          Como <span style={{ color: 'var(--text-2)' }}>{user?.name ?? '—'}</span>
        </span>
      </div>
    </div>
  );
}
