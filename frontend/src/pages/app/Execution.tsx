import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
type Severity = 'INFO' | 'WARNING' | 'ERROR';

interface DeploymentEvent {
  id: string;
  event_type: string;
  source: string;
  severity: Severity;
  message: string | null;
  event_timestamp: string;
}

interface DeploymentRequest {
  id: string;
  status: RequestStatus;
  source_commit_sha: string | null;
  failure_reason: string | null;
  requested_at: string;
  completed_at: string | null;
}

interface RequestWithEvents {
  request: DeploymentRequest;
  events: DeploymentEvent[];
}

const TERMINAL: RequestStatus[] = ['SUCCESS', 'FAILED', 'CANCELLED'];

function severityColor(s: Severity) {
  if (s === 'ERROR') return '#ff8497';
  if (s === 'WARNING') return '#ecc26b';
  return 'var(--text-3)';
}

function statusStyle(s: RequestStatus) {
  if (s === 'SUCCESS') return { bg: 'rgba(52,199,89,.12)', col: '#5dd57b', bord: 'rgba(52,199,89,.28)', dot: '#34C759', anim: false };
  if (s === 'FAILED' || s === 'CANCELLED') return { bg: 'rgba(241,85,108,.12)', col: '#ff8497', bord: 'rgba(241,85,108,.28)', dot: '#F1556C', anim: false };
  return { bg: 'rgba(224,169,59,.12)', col: '#ecc26b', bord: 'rgba(224,169,59,.28)', dot: '#E0A93B', anim: true };
}

function statusLabel(s: RequestStatus) {
  const map: Record<RequestStatus, string> = {
    PENDING: 'Pendente', APPROVED: 'Aprovado', REJECTED: 'Rejeitado',
    RUNNING: 'Em curso', SUCCESS: 'Concluído', FAILED: 'Falhou', CANCELLED: 'Cancelado',
  };
  return map[s] ?? s;
}

export default function Execution() {
  const { appId, aeId, reqId } = useParams<{ appId: string; aeId: string; reqId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<RequestWithEvents | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reqId) return;

    // initial load
    apiFetch(`/deployment-requests/${reqId}/events`)
      .then(setData)
      .catch(e => setError(e.message));

    const id = setInterval(async () => {
      try {
        const d: RequestWithEvents = await apiFetch(`/deployment-requests/${reqId}/events`);
        setData(d);
        if (TERMINAL.includes(d.request.status)) clearInterval(id);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        clearInterval(id);
      }
    }, 3000);

    return () => clearInterval(id);
  }, [reqId]);

  if (error) return <div style={{ color: '#ff8497', fontSize: 13, padding: '40px 0' }}>{error}</div>;
  if (!data) return <Spinner />;

  const { request, events } = data;
  const st = statusStyle(request.status);
  const isTerminal = TERMINAL.includes(request.status);

  return (
    <div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>{appId} / {aeId} / execução</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Execução do Deploy</h1>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999, fontSize: 12, background: st.bg, color: st.col, border: `1px solid ${st.bord}` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, animation: st.anim ? 'ds-pulse 1.4s infinite' : 'none' }} />
          {statusLabel(request.status)}
        </span>
      </div>

      {request.status === 'FAILED' && request.failure_reason && (
        <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 10, background: 'rgba(241,85,108,.08)', border: '1px solid rgba(241,85,108,.3)', fontSize: 13, color: '#ff8497' }}>
          <strong>Falha:</strong> {request.failure_reason}
        </div>
      )}

      {request.source_commit_sha && (
        <div style={{ marginBottom: 18 }} className="mono">
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Commit: </span>
          <span style={{ fontSize: 12, color: 'var(--teal)' }}>{request.source_commit_sha.slice(0, 7)}</span>
        </div>
      )}

      {/* Events timeline */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Eventos</span>
          {!isTerminal && <span style={{ fontSize: 11, color: 'var(--teal)', animation: 'ds-pulse 1.4s infinite' }}>● live</span>}
        </div>

        {events.length === 0 ? (
          <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-3)' }}>
            {isTerminal ? 'Sem eventos registados.' : 'A aguardar eventos…'}
          </div>
        ) : (
          <div className="mono" style={{ background: 'var(--bg-2)', padding: '14px 18px', fontSize: 11.5, lineHeight: 1.9, maxHeight: 320, overflowY: 'auto' }}>
            {events.map(ev => {
              const ts = new Date(ev.event_timestamp).toLocaleTimeString();
              const col = severityColor(ev.severity);
              return (
                <div key={ev.id}>
                  <span style={{ color: 'var(--text-3)', marginRight: 12 }}>{ts}</span>
                  <span style={{ marginRight: 10, color: col }}>[{ev.severity}]</span>
                  <span style={{ color: ev.severity !== 'INFO' ? col : 'var(--text-2)' }}>
                    {ev.event_type}{ev.message ? ` — ${ev.message}` : ''}
                  </span>
                </div>
              );
            })}
            {!isTerminal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ borderRight: '2px solid var(--teal)', animation: 'ds-blink 1s step-end infinite', paddingRight: 2 }} />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {isTerminal && request.status === 'SUCCESS' && (
          <button onClick={() => nav(`/app/${appId}/${aeId}`)} className="btn-primary" style={{ fontSize: 12.5, padding: '9px 16px', borderRadius: 9 }}>Ver Environment →</button>
        )}
        <button onClick={() => nav(`/app/${appId}/${aeId}`)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 12.5, padding: '9px 16px', borderRadius: 9, cursor: 'pointer' }}>Voltar ao Environment</button>
      </div>
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />A carregar…</div>;
}
