import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { OB_TEAM_ID } from '../Onboarding';

interface Member { user_id: string; name: string; email: string; role: string; }
interface Candidate { user_id: string; name: string; email: string; }

const ROLE_LABEL: Record<string, string> = {
  CLOUD_ENGINEER: 'Cloud Engineer',
  TECH_LEAD: 'Tech Lead',
  DEVELOPER: 'Developer',
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

type AllowedRole = 'DEVELOPER' | 'TECH_LEAD';

export default function Team() {
  const nav = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateRoles, setCandidateRoles] = useState<Record<string, AllowedRole>>({});
  const [err, setErr] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const teamId = localStorage.getItem(OB_TEAM_ID);

  useEffect(() => {
    if (!teamId) { setErr('Team não encontrada.'); return; }
    apiFetch(`/teams/${teamId}/members`)
      .then(({ members: m, candidates: c }: { members: Member[]; candidates: Candidate[] }) => {
        setMembers(m);
        setCandidates(c);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Erro ao carregar team.'));
  }, [teamId]);

  async function addCandidate(candidate: Candidate) {
    if (!teamId) return;
    const role = candidateRoles[candidate.user_id] ?? 'DEVELOPER';
    setRemoving(candidate.user_id);
    try {
      const member: Member = await apiFetch(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: candidate.user_id, role }),
      });
      setMembers(prev => [...prev, member]);
      setCandidates(prev => prev.filter(c => c.user_id !== candidate.user_id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao adicionar membro.');
    } finally { setRemoving(null); }
  }

  const cloudEngineers = members.filter(m => m.role === 'CLOUD_ENGINEER');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Team</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Membros da equipa e candidatos descobertos automaticamente.</p>
        </div>
        <button onClick={() => nav('/app/team/add')} className="btn-primary hover-bright" style={{ fontSize: 12.5, padding: '9px 16px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span>+</span> Adicionar membro
        </button>
      </div>

      {err && (
        <div style={{ display: 'flex', gap: 9, border: '1px solid rgba(241,85,108,.3)', background: 'rgba(241,85,108,.08)', borderRadius: 9, padding: '10px 13px', marginBottom: 16 }}>
          <span style={{ color: '#ff8497' }}>✕</span>
          <span style={{ fontSize: 12, color: '#ff9aaa' }}>{err}</span>
        </div>
      )}

      {/* Members table */}
      {members.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            <span>Membro</span><span>Role</span><span style={{ textAlign: 'right' }}>Ação</span>
          </div>
          {members.map((m, i) => {
            const isOwner = m.role === 'CLOUD_ENGINEER';
            return (
              <div key={m.user_id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px', gap: 12, padding: '14px 20px', borderBottom: i < members.length - 1 ? '1px solid var(--border-soft)' : 'none', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, flex: 'none' }}>{initials(m.name)}</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
                      {m.name}
                      {isOwner && <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 5, background: 'rgba(43,199,180,.12)', color: 'var(--teal)', border: '1px solid rgba(43,199,180,.28)', fontWeight: 600 }}>OWNER</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{m.email}</div>
                  </div>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{ROLE_LABEL[m.role] ?? m.role}</span>
                <div style={{ textAlign: 'right' }}>
                  {!isOwner && (
                    <button style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>
                      Remover
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Candidates */}
      {candidates.length > 0 && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 13 }}>Candidatos do mesmo domínio</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
            {candidates.map((c, i) => (
              <div key={c.user_id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 20px', borderBottom: i < candidates.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, flex: 'none' }}>{initials(c.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{c.email}</div>
                </div>
                <select
                  value={candidateRoles[c.user_id] ?? 'DEVELOPER'}
                  onChange={e => setCandidateRoles(prev => ({ ...prev, [c.user_id]: e.target.value as AllowedRole }))}
                  className="select-base"
                  disabled={removing === c.user_id}
                >
                  <option value="DEVELOPER">Developer</option>
                  <option value="TECH_LEAD">Tech Lead</option>
                </select>
                <button
                  onClick={() => addCandidate(c)}
                  disabled={removing === c.user_id}
                  className="btn-primary hover-bright"
                  style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, opacity: removing === c.user_id ? .6 : 1 }}
                >
                  {removing === c.user_id ? 'A adicionar…' : 'Adicionar'}
                </button>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.6 }}>
            Candidatos são utilizadores registados com o mesmo domínio de email que ainda não pertencem a nenhuma team.
            São adicionados como <strong>Developer</strong> — altera a role em "Adicionar membro" se necessário.
          </div>
        </div>
      )}

      {/* MVP notice if Cloud Engineer already exists */}
      {cloudEngineers.length >= 1 && (
        <div style={{ display: 'flex', gap: 10, border: '1px solid rgba(77,156,246,.28)', background: 'rgba(77,156,246,.08)', borderRadius: 11, padding: '12px 15px', marginTop: 20 }}>
          <span style={{ color: '#7fb6f9' }}>ⓘ</span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Neste MVP cada team tem um único Cloud Engineer. Para transferir o controlo, contacta o suporte.
          </span>
        </div>
      )}
    </div>
  );
}
