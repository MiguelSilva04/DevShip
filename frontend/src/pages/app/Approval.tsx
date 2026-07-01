import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { apiFetch } from '../../api/client';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

interface DeploymentRequest {
  id: string;
  application_environment_id: string;
  status: RequestStatus;
  source_commit_sha: string | null;
  justification: string | null;
  failure_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  completed_at: string | null;
}

export default function Approval() {
  const { reqId } = useParams<{ reqId: string }>();
  const nav = useNavigate();
  const { user } = useUser();
  const canDecide = user?.role === 'tech' || user?.role === 'cloud';

  const [req, setReq] = useState<DeploymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!reqId) return;
    apiFetch(`/deployment-requests/${reqId}`)
      .then((d: DeploymentRequest) => { setReq(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [reqId]);

  async function approve() {
    if (!reqId) return;
    setActing(true); setActionError('');
    try {
      const updated: DeploymentRequest = await apiFetch(`/deployment-requests/${reqId}/approve`, { method: 'POST' });
      setReq(updated);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  }

  async function reject() {
    if (!reqId || !rejectNote.trim()) return;
    setActing(true); setActionError('');
    try {
      const updated: DeploymentRequest = await apiFetch(`/deployment-requests/${reqId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ justification: rejectNote }),
      });
      setReq(updated);
      setShowReject(false);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <div style={{ color: '#ff8497', fontSize: 13, padding: '40px 0' }}>{error}</div>;
  if (!req) return null;

  const resolved = req.status === 'APPROVED' || req.status === 'REJECTED';

  if (resolved) {
    const approved = req.status === 'APPROVED';
    return (
      <div style={{ maxWidth: 560, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 18px', background: approved ? 'rgba(52,199,89,.14)' : 'rgba(241,85,108,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          {approved ? '✓' : '✕'}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', color: approved ? '#5dd57b' : '#ff8497' }}>
          Deploy {approved ? 'aprovado' : 'rejeitado'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 22px' }}>
          {approved
            ? 'O deploy foi aprovado e entrará em execução.'
            : 'O deploy foi rejeitado. O Developer será notificado.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => nav('/app/approvals')} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, padding: '9px 18px', borderRadius: 9, cursor: 'pointer' }}>Voltar aos approvals</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 660 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>approvals / {reqId}</div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 20px' }}>Pedido de Aprovação de Deploy</h1>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px 28px', fontSize: 13 }}>
          {([
            ['Application Env', req.application_environment_id],
            ['Status', req.status],
            ['Commit', req.source_commit_sha ? req.source_commit_sha.slice(0, 7) : '—'],
            ['Pedido em', new Date(req.requested_at).toLocaleString()],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{k}</span>
              <div className="mono" style={{ marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {req.justification && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '18px 22px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Nota do Developer</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{req.justification}</p>
        </div>
      )}

      {actionError && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(241,85,108,.08)', border: '1px solid rgba(241,85,108,.3)', fontSize: 12.5, color: '#ff8497' }}>{actionError}</div>
      )}

      {canDecide ? (
        <>
          {showReject ? (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>
                Motivo da rejeição <span style={{ color: '#ff8497' }}>*</span>
              </label>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Descreve o motivo da rejeição…"
                rows={3}
                style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  onClick={reject}
                  disabled={acting || !rejectNote.trim()}
                  style={{ background: 'rgba(241,85,108,.1)', border: '1px solid rgba(241,85,108,.3)', color: '#ff8497', fontSize: 13, padding: '10px 20px', borderRadius: 9, cursor: acting || !rejectNote.trim() ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: acting || !rejectNote.trim() ? 0.6 : 1 }}
                >
                  {acting ? 'A rejeitar…' : 'Confirmar rejeição'}
                </button>
                <button onClick={() => setShowReject(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary hover-bright" onClick={approve} disabled={acting} style={{ fontSize: 13, padding: '10px 20px', borderRadius: 9, fontWeight: 600, opacity: acting ? 0.7 : 1, cursor: acting ? 'not-allowed' : 'pointer' }}>
                {acting ? 'A aprovar…' : 'Aprovar deploy'}
              </button>
              <button
                onClick={() => setShowReject(true)}
                style={{ background: 'rgba(241,85,108,.1)', border: '1px solid rgba(241,85,108,.3)', color: '#ff8497', fontSize: 13, padding: '10px 20px', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}
              >
                Rejeitar
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', border: '1px solid rgba(224,169,59,.3)', borderRadius: 12, background: 'rgba(224,169,59,.06)', fontSize: 13, color: '#ecc26b' }}>
          <span>⏳</span>
          <span>A aguardar aprovação de um <strong>Tech Lead</strong>.</span>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />A carregar…</div>;
}
