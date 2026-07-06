import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { OB_TEAM_ID, OB_PROJECT_ID } from '../Onboarding';
import { useUser } from '../../context/UserContext';

interface Candidate { user_id: string; name: string; email: string; }
interface AppItem { id: string; name: string; source_repository: string; }

type AllowedRole = 'DEVELOPER' | 'TECH_LEAD';

const ROLES: { id: AllowedRole; label: string; desc: string }[] = [
  { id: 'DEVELOPER', label: 'Developer',  desc: 'Pode fazer deploy para DEV e STAGING. Pede aprovação para PROD.' },
  { id: 'TECH_LEAD', label: 'Tech Lead',  desc: 'Pode aprovar deploys para PROD e fazer deploy em todos os environments.' },
];

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function AddMember() {
  const nav = useNavigate();
  const { user } = useUser();
  const isTechLead = user?.role === 'tech';
  const availableRoles = isTechLead ? ROLES.filter(r => r.id === 'DEVELOPER') : ROLES;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [role, setRole] = useState<AllowedRole>('DEVELOPER');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasCloudEngineer, setHasCloudEngineer] = useState(false);
  const [apps, setApps] = useState<AppItem[]>([]);
  const [appIds, setAppIds] = useState<string[]>([]);

  const teamId = localStorage.getItem(OB_TEAM_ID);
  const projectId = localStorage.getItem(OB_PROJECT_ID);

  useEffect(() => {
    if (!teamId) return;
    apiFetch(`/teams/${teamId}/members`)
      .then(({ members, candidates: c }: { members: { role: string }[]; candidates: Candidate[] }) => {
        setCandidates(c);
        setHasCloudEngineer(members.some(m => m.role === 'CLOUD_ENGINEER'));
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Erro ao carregar candidatos.'));
    if (projectId) {
      apiFetch(`/projects/${projectId}/applications`).then(setApps).catch(() => setApps([]));
    }
  }, [teamId]);

  function toggleApp(appId: string) {
    setAppIds(prev => prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]);
  }

  async function submit() {
    if (!selected) { setErr('Seleciona um utilizador.'); return; }
    if (!teamId) { setErr('Team não encontrada.'); return; }
    setLoading(true); setErr('');
    try {
      await apiFetch(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: selected, role, application_ids: role === 'DEVELOPER' ? appIds : [] }),
      });
      nav('/app/team');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao adicionar membro.');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 540 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>Adicionar membro</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.6 }}>
        Utilizadores registados com o mesmo domínio de email que ainda não pertencem a nenhuma team.
      </p>

      {hasCloudEngineer && (
        <div style={{ display: 'flex', gap: 10, border: '1px solid rgba(77,156,246,.28)', background: 'rgba(77,156,246,.08)', borderRadius: 11, padding: '12px 15px', marginBottom: 20 }}>
          <span style={{ color: '#7fb6f9' }}>ⓘ</span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Neste MVP cada team tem um único Cloud Engineer. Só podes adicionar <strong>Developer</strong> ou <strong>Tech Lead</strong>.
          </span>
        </div>
      )}

      {err && (
        <div style={{ display: 'flex', gap: 9, border: '1px solid rgba(241,85,108,.3)', background: 'rgba(241,85,108,.08)', borderRadius: 9, padding: '10px 13px', marginBottom: 16 }}>
          <span style={{ color: '#ff8497' }}>✕</span>
          <span style={{ fontSize: 12, color: '#ff9aaa' }}>{err}</span>
        </div>
      )}

      {candidates.length === 0 && !err && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 13, padding: '28px 22px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, marginBottom: 20 }}>
          Nenhum candidato disponível — todos os utilizadores do domínio já pertencem a uma team.
        </div>
      )}

      {candidates.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>Utilizador</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.map(c => (
              <label key={c.user_id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', border: `1px solid ${selected === c.user_id ? 'rgba(43,199,180,.4)' : 'var(--border)'}`, borderRadius: 11, cursor: 'pointer', background: selected === c.user_id ? 'rgba(43,199,180,.05)' : 'var(--surface)' }}>
                <input type="radio" name="candidate" value={c.user_id} checked={selected === c.user_id} onChange={() => setSelected(c.user_id)} style={{ accentColor: 'var(--teal)', flex: 'none' }} />
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, flex: 'none' }}>{initials(c.name)}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{c.email}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>Role</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {availableRoles.map(r => (
            <label key={r.id} htmlFor={`role-${r.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '14px 16px', border: `1px solid ${role === r.id ? 'rgba(43,199,180,.4)' : 'var(--border)'}`, borderRadius: 11, cursor: 'pointer', background: role === r.id ? 'rgba(43,199,180,.05)' : 'var(--surface)' }}>
              <input id={`role-${r.id}`} type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} style={{ marginTop: 2, accentColor: 'var(--teal)', flex: 'none' }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {role === 'DEVELOPER' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>Applications</div>
          {apps.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Nenhuma application neste projeto ainda — podes atribuir mais tarde em Team.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {apps.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', border: `1px solid ${appIds.includes(a.id) ? 'rgba(43,199,180,.4)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: appIds.includes(a.id) ? 'rgba(43,199,180,.05)' : 'var(--surface)' }}>
                  <input type="checkbox" checked={appIds.includes(a.id)} onChange={() => toggleApp(a.id)} style={{ accentColor: 'var(--teal)', flex: 'none' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.source_repository}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={submit}
          disabled={loading || !selected}
          className="btn-primary hover-bright"
          style={{ fontSize: 13, padding: '10px 20px', borderRadius: 9, fontWeight: 600, opacity: (!selected || loading) ? .6 : 1 }}
        >
          {loading ? 'A adicionar…' : 'Adicionar membro'}
        </button>
        <button onClick={() => nav('/app/team')} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>Cancelar</button>
      </div>
    </div>
  );
}
