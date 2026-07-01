import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { apiFetch } from '../../api/client';

interface AEDetail {
  id: string;
  application_id: string;
  environment_id: string;
  deployment_name: string;
}

export default function Deploy() {
  const { appId, aeId } = useParams<{ appId: string; aeId: string }>();
  const nav = useNavigate();
  const { user } = useUser();

  const [aeDetail, setAeDetail] = useState<AEDetail | null>(null);
  const [appName, setAppName] = useState('');
  const [envName, setEnvName] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!aeId) return;
    apiFetch(`/application-environments/${aeId}`)
      .then((d: AEDetail) => {
        setAeDetail(d);
        const projectId = localStorage.getItem('ob_project_id');
        return Promise.all([
          apiFetch(`/applications/${d.application_id}`).catch(() => null),
          projectId ? apiFetch(`/projects/${projectId}/environments`).catch(() => null) : Promise.resolve(null),
        ]);
      })
      .then(([app, envs]) => {
        if (!app || !aeDetail) return; // aeDetail not yet set in closure, handled below
        setAppName(app?.name ?? '');
        if (envs && Array.isArray(envs) && aeDetail) {
          const env = (envs as { id: string; name: string; requires_approval: boolean }[]).find(e => e.id === aeDetail.environment_id);
          if (env) { setEnvName(env.name); setRequiresApproval(env.requires_approval); }
        }
      })
      .catch(e => setError(e.message));
  }, [aeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // second pass once aeDetail is set — needed because the first .then closure captures stale aeDetail
  useEffect(() => {
    if (!aeDetail) return;
    const projectId = localStorage.getItem('ob_project_id');
    Promise.all([
      apiFetch(`/applications/${aeDetail.application_id}`).catch(() => null),
      projectId ? apiFetch(`/projects/${projectId}/environments`).catch(() => null) : Promise.resolve(null),
    ]).then(([app, envs]) => {
      if (app) setAppName(app.name);
      if (envs && Array.isArray(envs)) {
        const env = (envs as { id: string; name: string; requires_approval: boolean }[]).find(e => e.id === aeDetail.environment_id);
        if (env) { setEnvName(env.name); setRequiresApproval(env.requires_approval); }
      }
    });
  }, [aeDetail]);

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
        setError('Já existe um deploy em curso para este environment.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  const envLabel = envName || aeDetail?.deployment_name || aeId || '';
  const appLabel = appName || appId || '';

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>{appLabel} / {envLabel} / deploy</div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>
        {requiresApproval ? 'Solicitar deploy' : 'Deploy'} — <span style={{ color: 'var(--text-2)' }}>{envLabel}</span>
      </h1>

      {requiresApproval && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', border: '1px solid rgba(224,169,59,.35)', borderRadius: 9, background: 'rgba(224,169,59,.07)', fontSize: 12, color: '#ecc26b', margin: '10px 0 18px' }}>
          <span>⚠</span> Este environment requer aprovação antes de executar.
        </div>
      )}

      {/* Context card */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>Contexto do deploy</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 28px', fontSize: 13 }}>
          {([['Application', appLabel], ['Environment', envLabel]] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{k}</span>
              <div className="mono" style={{ marginTop: 3 }}>{v || '—'}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 9, background: 'var(--bg-2)', border: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
          O commit exato é determinado pela branch configurada no momento do deploy. {/* ponytail: no commits endpoint in MVP */}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>
          Justificação <span style={{ color: 'var(--text-3)' }}>(opcional)</span>
        </label>
        <textarea
          value={justification}
          onChange={e => setJustification(e.target.value)}
          placeholder={requiresApproval ? 'Descreve o motivo deste pedido de deploy…' : 'Notas sobre este deploy…'}
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
          className="btn-primary hover-bright"
          onClick={submit}
          disabled={loading}
          style={{ fontSize: 13, padding: '10px 20px', borderRadius: 9, fontWeight: 600, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'A enviar…' : requiresApproval ? 'Solicitar deploy →' : 'Confirmar deploy →'}
        </button>
        <button onClick={() => nav(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>Cancelar</button>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>
          A fazer deploy como <span style={{ color: 'var(--text-2)' }}>{user?.name ?? '—'}</span>
        </span>
      </div>
    </div>
  );
}
