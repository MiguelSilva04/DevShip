import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../../api/client';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

interface DeploymentRequest {
  id: string;
  application_environment_id: string;
  status: RequestStatus;
  source_commit_sha: string | null;
  justification: string | null;
  requested_at: string;
  approved_at: string | null;
  completed_at: string | null;
}

export default function Approvals() {
  const nav = useNavigate();
  const [pending, setPending] = useState<DeploymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/deployment-requests?request_status=PENDING')
      .then((data: DeploymentRequest[]) => { setPending(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <Spinner />;
  if (error) return <div style={{ color: '#ff8497', fontSize: 13, padding: '40px 0' }}>{error}</div>;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.01em', margin: '0 0 6px' }}>Aprovações</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 24px' }}>Pedidos de deploy a aguardar decisão.</p>

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 11px', color: '#ecc26b' }}>
        Pendentes{' '}
        <span style={{ background: 'rgba(224,169,59,.15)', color: '#ecc26b', fontSize: 11, padding: '1px 7px', borderRadius: 9, marginLeft: 6 }}>{pending.length}</span>
      </h2>

      {pending.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '20px 0' }}>Sem pedidos pendentes.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pending.map(req => (
            <div key={req.id} style={{ border: '1px solid rgba(224,169,59,.25)', borderRadius: 13, background: 'var(--surface)', padding: '17px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>env:</span>
                <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{req.application_environment_id}</span>
                {req.source_commit_sha && (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>{req.source_commit_sha.slice(0, 7)}</span>
                )}
              </div>
              {req.justification && (
                <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 12px', fontStyle: 'italic' }}>"{req.justification}"</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {new Date(req.requested_at).toLocaleString()}
                </span>
                <button
                  onClick={() => nav(`/app/approvals/${req.id}`)}
                  style={{ marginLeft: 'auto', fontSize: 12, padding: '7px 14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }}
                >
                  Ver detalhes →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />A carregar…</div>;
}
