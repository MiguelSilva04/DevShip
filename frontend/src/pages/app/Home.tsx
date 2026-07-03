import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';

type LifecycleStatus = 'Deploying' | 'Healthy' | 'Degraded' | 'Failed' | 'RolledBack' | 'Superseded';

interface AEStatus {
  id: string;
  environment_name: string;
  lifecycle_status: LifecycleStatus | null;
}

interface AppWithStatus {
  id: string;
  name: string;
  environments: AEStatus[];
}

interface HomepageData {
  total_application_environments: number;
  healthy_count: number;
  degraded_count: number;
  deploys_today: number;
  applications: AppWithStatus[];
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
  return map[s ?? ''] ?? { bg: 'var(--surface-2)', col: 'var(--text-3)', bord: 'var(--border)', dot: 'var(--text-3)' };
}

function isActive(s: LifecycleStatus | null) {
  return s === 'Deploying';
}

export default function Home() {
  const nav = useNavigate();
  const [data, setData] = useState<HomepageData | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [picker, setPicker] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const projectId = localStorage.getItem('ob_project_id');
    if (!projectId) { setError('Project não encontrado. Faz onboarding primeiro.'); return; }
    apiFetch(`/projects/${projectId}/homepage`)
      .then(d => {
        setData(d);
        // open the first app by default
        if (d.applications.length > 0) setOpen({ [d.applications[0].id]: true });
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div style={{ color: '#ff8497', fontSize: 13, padding: '40px 0' }}>{error}</div>;
  if (!data) return <Spinner />;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.01em', margin: '0 0 18px' }}>Overview</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13, marginBottom: 26 }}>
        <StatCard label="Total App Environments" value={String(data.total_application_environments)} />
        <StatCard label="Healthy" value={String(data.healthy_count)} valueColor="#5dd57b" />
        <StatCard label="Degraded" value={String(data.degraded_count)} valueColor="#ff8497" sub={data.degraded_count > 0 ? 'Needs attention' : undefined} highlight={data.degraded_count > 0} />
        <StatCard label="Deploys hoje" value={String(data.deploys_today)} />
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 13px' }}>Applications</h2>

      {data.applications.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '24px 0' }}>Sem applications configuradas.</div>
      )}

      {data.applications.map(app => (
        <div key={app.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden', marginBottom: 12 }}>
          <button
            onClick={() => setOpen(p => ({ ...p, [app.id]: !p[app.id] }))}
            style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '16px 18px', textAlign: 'left', color: 'var(--text)' }}
          >
            <span style={{ color: 'var(--text-3)', fontSize: 12, width: 12 }}>{open[app.id] ? '▼' : '▶'}</span>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{app.name}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {app.environments.map(ae => {
                const p = statusPill(ae.lifecycle_status);
                return (
                  <span key={ae.id} className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, padding: '3px 9px', borderRadius: 6, background: p.bg, border: `1px solid ${p.bord}`, color: p.col }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.dot, animation: isActive(ae.lifecycle_status) ? 'ds-pulse 1.4s infinite' : 'none' }} />
                    {ae.environment_name}
                  </span>
                );
              })}
            </span>
          </button>

          {open[app.id] && (
            <div style={{ borderTop: '1px solid var(--border-soft)' }}>
              {app.environments.map((ae, i) => {
                const p = statusPill(ae.lifecycle_status);
                return (
                  <button
                    key={ae.id}
                    onClick={() => nav(`/app/${app.id}/${ae.id}`)}
                    className="hover-surface2"
                    style={{ display: 'flex', alignItems: 'center', gap: 15, width: '100%', background: 'transparent', border: 'none', borderBottom: i < app.environments.length - 1 ? '1px solid var(--border-soft)' : 'none', cursor: 'pointer', padding: '13px 18px', textAlign: 'left', color: 'var(--text)' }}
                  >
                    <span className="mono" style={{ fontSize: 12, width: 90, color: 'var(--text-2)' }}>{ae.environment_name}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 999, fontSize: 11, background: p.bg, color: p.col, border: `1px solid ${p.bord}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, animation: isActive(ae.lifecycle_status) ? 'ds-pulse 1.4s infinite' : 'none' }} />
                      {ae.lifecycle_status ?? 'Unknown'}
                    </span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 13 }}>→</span>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-soft)', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setPicker(p => ({ ...p, [app.id]: !p[app.id] }))}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(43,199,180,.3)', background: 'rgba(43,199,180,.08)', color: 'var(--teal)', fontWeight: 600, fontSize: 12, padding: '7px 14px', borderRadius: 8, cursor: 'pointer' }}
              className="hover-bright"
            >
              <DeployIcon />Deploy
            </button>
            {picker[app.id] ? (
              <>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>para:</span>
                {app.environments.map(ae => (
                  <button
                    key={ae.id}
                    onClick={() => nav(`/app/${app.id}/${ae.id}/deploy`)}
                    className="mono"
                    style={{ fontSize: 11.5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '6px 12px', borderRadius: 7, cursor: 'pointer' }}
                  >
                    {ae.environment_name}
                  </button>
                ))}
              </>
            ) : (
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Escolhe o environment de destino</span>
            )}
            <button onClick={() => nav(`/app/${app.id}`)} className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 8px', borderRadius: 7 }}>Ver app →</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, valueColor, sub, highlight }: { label: string; value: string; valueColor?: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ border: `1px solid ${highlight ? 'rgba(241,85,108,.3)' : 'var(--border)'}`, borderRadius: 13, background: highlight ? 'linear-gradient(180deg,rgba(241,85,108,.07),var(--surface))' : 'var(--surface)', padding: '16px 18px' }}>
      <div style={{ fontSize: 11.5, color: highlight ? '#ff8497' : 'var(--text-2)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
        <span className="mono" style={{ fontSize: 28, fontWeight: 600, color: valueColor ?? 'var(--text)' }}>{value}</span>
        {sub && <span style={{ fontSize: 10.5, color: '#ff8497' }}>{sub}</span>}
      </div>
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />A carregar…</div>;
}

function DeployIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}><path d="M12 5V19M12 5L6.5 11M12 5L17.5 11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
