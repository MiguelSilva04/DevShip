import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { apiFetch } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';
import Breadcrumb from '../../components/Breadcrumb';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  RUNNING: 'Em curso',
  SUCCESS: 'Concluído',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
};

interface DeploymentRequest {
  id: string;
  application_environment_id: string;
  status: RequestStatus;
  source_commit_sha: string | null;
  justification: string | null;
  failure_reason: string | null;
  requested_at: string;
  requested_by_email: string | null;
  approved_at: string | null;
  approved_by_email: string | null;
  completed_at: string | null;
}

interface PendingCommitsResponse {
  current_sha: string | null;
  head_sha: string | null;
  commits: { sha: string }[];
  reason: string | null;
}

export default function Approval() {
  const { reqId } = useParams<{ reqId: string }>();
  const nav = useNavigate();
  const { user } = useUser();
  const canDecide = user?.role === 'tech' || user?.role === 'cloud';

  const [req, setReq] = useState<DeploymentRequest | null>(null);
  const { appLabel, envLabel, appId, aeId } = useAppEnvBreadcrumb(undefined, req?.application_environment_id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState<PendingCommitsResponse | null>(null);

  useEffect(() => {
    if (!reqId) return;
    apiFetch(`/deployment-requests/${reqId}`)
      .then((d: DeploymentRequest) => { setReq(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [reqId]);

  useEffect(() => {
    // source_commit_sha só é preenchido quando o deploy é disparado (trigger_deploy) — para
    // um pedido ainda PENDING, mostra o HEAD do branch que seria usado em vez de "—".
    if (!req || req.source_commit_sha || !req.application_environment_id) return;
    apiFetch(`/application-environments/${req.application_environment_id}/pending-commits`)
      .then(setPending)
      .catch(() => setPending(null));
  }, [req]);

  async function approve() {
    if (!reqId) return;
    setActing(true); setActionError('');
    try {
      const updated: DeploymentRequest = await apiFetch(`/deployment-requests/${reqId}/approve`, { method: 'POST' });
      setReq(updated);
      window.dispatchEvent(new CustomEvent('devship:approvals-changed'));
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
      window.dispatchEvent(new CustomEvent('devship:approvals-changed'));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <div style={{ color: '#ff8497', fontSize: 13, padding: '40px 0' }}>{error}</div>;
  if (!req) return null;

  // Aprovar transiciona logo PENDING → APPROVED → RUNNING na mesma chamada (trigger_deploy
  // corre a seguir a aprovar) — a resposta já vem RUNNING, não fica presa em APPROVED. Por
  // isso "resolvido" tem de cobrir todo o estado não-PENDING, senão este ecrã continua a
  // mostrar os botões de decisão para um pedido que já foi aprovado e está a decorrer.
  const resolved = req.status !== 'PENDING';

  if (resolved) {
    const approved = req.status !== 'REJECTED' && req.status !== 'CANCELLED';
    const inProgress = req.status === 'RUNNING' || req.status === 'SUCCESS' || req.status === 'FAILED';
    const icon = req.status === 'REJECTED' || req.status === 'CANCELLED' || req.status === 'FAILED' ? '✕' : '✓';
    const color = req.status === 'REJECTED' || req.status === 'CANCELLED' || req.status === 'FAILED' ? '#ff8497' : '#5dd57b';
    const bg = req.status === 'REJECTED' || req.status === 'CANCELLED' || req.status === 'FAILED' ? 'rgba(241,85,108,.14)' : 'rgba(52,199,89,.14)';

    const message: Record<RequestStatus, string> = {
      PENDING: '',
      APPROVED: 'O deploy foi aprovado e entrará em execução.',
      REJECTED: 'O deploy foi rejeitado. O Developer será notificado.',
      RUNNING: 'O deploy foi aprovado e está em execução.',
      SUCCESS: 'O deploy foi aprovado e concluiu com sucesso.',
      FAILED: 'O deploy foi aprovado, mas falhou durante a execução.',
      CANCELLED: 'O pedido foi cancelado.',
    };

    return (
      <div style={{ maxWidth: 560, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 18px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          {icon}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', color }}>
          Deploy {STATUS_LABEL[req.status].toLowerCase()}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 22px' }}>
          {message[req.status]}
          {req.approved_by_email && (
            <><br />{approved ? 'Aprovado' : 'Rejeitado'} por <strong>{req.approved_by_email}</strong>.</>
          )}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {inProgress && appId && req.application_environment_id && (
            <button
              onClick={() => nav(`/app/${appId}/${req.application_environment_id}/exec/${req.id}`)}
              className="btn-primary hover-bright"
              style={{ fontSize: 13, padding: '9px 18px', borderRadius: 9, fontWeight: 600 }}
            >
              Ver execução →
            </button>
          )}
          <button onClick={() => nav('/app/approvals')} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, padding: '9px 18px', borderRadius: 9, cursor: 'pointer' }}>Voltar às aprovações</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 660 }}>
      <Breadcrumb segments={[
        { label: 'aprovações', to: '/app/approvals' },
        { label: appLabel, to: appId ? `/app/${appId}` : undefined },
        { label: envLabel, to: (appId && aeId) ? `/app/${appId}/${aeId}` : undefined },
      ]} />
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 20px' }}>Pedido de Aprovação de Deploy</h1>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px', marginBottom: 14 }}>
        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px 28px', fontSize: 13 }}>
          {([
            ['Aplicação', appLabel],
            ['Ambiente', envLabel],
            ['Estado', STATUS_LABEL[req.status]],
            ['Commit', req.source_commit_sha
              ? req.source_commit_sha.slice(0, 7)
              : pending?.head_sha
              ? `${pending.head_sha.slice(0, 7)} (a aguardar aprovação)`
              : '—'],
            ['Pedido por', req.requested_by_email ?? '—'],
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
