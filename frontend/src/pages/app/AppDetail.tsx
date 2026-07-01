import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';

type LifecycleStatus = 'Deploying' | 'Healthy' | 'Degraded' | 'Failed' | 'RolledBack' | 'Superseded';

interface AEStatus {
  id: string;
  environment_name: string;
  lifecycle_status: LifecycleStatus | null;
}

interface AppDetail {
  id: string;
  name: string;
  source_repository: string;
  description: string | null;
  environments: AEStatus[];
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

export default function AppDetail() {
  const { appId } = useParams<{ appId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<AppDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!appId) return;
    apiFetch(`/applications/${appId}`)
      .then(setData)
      .catch(e => setError(e.message));
  }, [appId]);

  if (error) return <div style={{ color: '#ff8497', fontSize: 13, padding: '40px 0' }}>{error}</div>;
  if (!data) return <Spinner />;

  return (
    <div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Applications / {data.name}</div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 23, fontWeight: 600, margin: 0 }}>{data.name}</h1>
        {data.source_repository && (
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 5 }}>{data.source_repository}</div>
        )}
        {data.description && (
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>{data.description}</div>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 130px 1fr 200px', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          <span>Environment</span><span>Status</span><span></span><span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {data.environments.length === 0 && (
          <div style={{ padding: '20px', fontSize: 13, color: 'var(--text-3)' }}>Sem environments configurados.</div>
        )}

        {data.environments.map((ae, i) => {
          const p = statusPill(ae.lifecycle_status);
          return (
            <div key={ae.id} style={{ display: 'grid', gridTemplateColumns: '160px 130px 1fr 200px', gap: 12, padding: '15px 20px', borderBottom: i < data.environments.length - 1 ? '1px solid var(--border-soft)' : 'none', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 13 }}>{ae.environment_name}</span>
              <span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 999, fontSize: 11, background: p.bg, color: p.col, border: `1px solid ${p.bord}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, animation: ae.lifecycle_status === 'Deploying' ? 'ds-pulse 1.4s infinite' : 'none' }} />
                  {ae.lifecycle_status ?? 'Unknown'}
                </span>
              </span>
              <span />
              <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => nav(`/app/${appId}/${ae.id}/deploy`)} className="btn-primary" style={{ fontSize: 11.5, padding: '6px 13px', borderRadius: 7 }}>Deploy</button>
                <button onClick={() => nav(`/app/${appId}/${ae.id}`)} className="btn-secondary" style={{ fontSize: 11.5, padding: '6px 13px', borderRadius: 7 }}>Ver detalhes</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />A carregar…</div>;
}
