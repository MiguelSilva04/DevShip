import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { type LifecycleStatus, type UpToDateStatus, lifecycleColor, LIFECYCLE_LABEL, UP_TO_DATE_LABEL } from '../../lib/lifecycle';
import Breadcrumb from '../../components/Breadcrumb';

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
  return lifecycleColor(s, { bg: 'var(--surface)', col: 'var(--text-3)', bord: 'var(--border)', dot: '#888' });
}

export default function AppDetail() {
  const { appId } = useParams<{ appId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<AppDetail | null>(null);
  const [error, setError] = useState('');
  const [upToDate, setUpToDate] = useState<Record<string, UpToDateStatus>>({});

  useEffect(() => {
    if (!appId) return;
    apiFetch(`/applications/${appId}`)
      .then((d: AppDetail) => setData(d))
      .catch(e => setError(e.message));
  }, [appId]);

  // Recomputa quando o lifecycle_status de algum environment muda (ex: deploy concluído) —
  // manter isto preso a [appId] deixava o badge "Up to date" parado no valor do primeiro load.
  const statusesKey = data?.environments.map(ae => `${ae.id}:${ae.lifecycle_status}`).join(',') ?? '';
  useEffect(() => {
    if (!data) return;
    data.environments.forEach(ae => {
      apiFetch(`/application-environments/${ae.id}/up-to-date`)
        .then((r: { status: UpToDateStatus }) => setUpToDate(prev => ({ ...prev, [ae.id]: r.status })))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusesKey]);

  if (error) return <div style={{ color: '#ff8497', fontSize: 13, padding: '40px 0' }}>{error}</div>;
  if (!data) return <Spinner />;

  return (
    <div>
      <Breadcrumb segments={[
        { label: 'aplicações', to: '/app/home' },
        { label: data.name },
      ]} />
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
          <span>Environment</span><span>Estado</span><span></span><span style={{ textAlign: 'right' }}>Ações</span>
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
                <span
                  className={ae.lifecycle_status === null ? 'ds-tooltip' : undefined}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 999, fontSize: 11, background: p.bg, color: p.col, border: `1px solid ${p.bord}` }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, animation: ae.lifecycle_status === 'Deploying' ? 'ds-pulse 1.4s infinite' : 'none' }} />
                  {ae.lifecycle_status ? LIFECYCLE_LABEL[ae.lifecycle_status] : 'Desconhecido'}
                  {ae.lifecycle_status === null && (
                    <span className={`ds-tooltip-bubble${i === 0 ? ' ds-tooltip-bubble-below' : ''}`}>
                      A aplicação "{data.name}" ainda não foi <em>deployada</em> em {ae.environment_name} através da DevShip — o estado fica Desconhecido até ao primeiro deploy.
                    </span>
                  )}
                </span>
              </span>
              <span />
              <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {!upToDate[ae.id] ? (
                  <button disabled style={{ fontSize: 11.5, padding: '6px 13px', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)', cursor: 'default', opacity: .7 }}>
                    A verificar…
                  </button>
                ) : upToDate[ae.id] === 'UpToDate' ? (
                  <button
                    disabled
                    title="Já está tudo deployado — sem commits novos desde o último deploy."
                    style={{ fontSize: 11.5, padding: '6px 13px', borderRadius: 7, background: 'rgba(52,199,89,.13)', color: '#5dd57b', border: '1px solid rgba(52,199,89,.24)', cursor: 'default' }}
                  >
                    {UP_TO_DATE_LABEL.UpToDate}
                  </button>
                ) : (
                  <button onClick={() => nav(`/app/${appId}/${ae.id}/deploy`)} className="btn-primary" style={{ fontSize: 11.5, padding: '6px 13px', borderRadius: 7 }}>Deploy</button>
                )}
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
