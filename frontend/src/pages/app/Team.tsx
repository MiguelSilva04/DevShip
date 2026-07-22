import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { OB_TEAM_ID, OB_PROJECT_ID } from '../Onboarding';
import { useUser } from '../../context/UserContext';

interface Member { team_member_id: string; user_id: string; name: string; email: string; role: string; joined_at: string; application_ids: string[]; }
interface Candidate { user_id: string; name: string; email: string; }
interface TeamInfo { id: string; name: string; description: string | null; domain: string; }
interface AppItem { id: string; name: string; source_repository: string; }

const ROLE_LABEL: Record<string, string> = {
  CLOUD_ENGINEER: 'Cloud Engineer',
  TECH_LEAD: 'Tech Lead',
  DEVELOPER: 'Developer',
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  CLOUD_ENGINEER: ['Gerir cluster', 'Team & settings', 'Deploy', 'Rollback', 'Aprovar'],
  TECH_LEAD: ['Deploy', 'Rollback', 'Aprovar pedidos', 'Consultar'],
  DEVELOPER: ['Deploy dev/staging', 'Rollback dev/staging', 'Solicitar p/ produção'],
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// position: fixed ancorado à posição real do botão via getBoundingClientRect — um
// tooltip absoluto normal fica cortado pelo overflow: hidden da tabela quando a linha
// está perto do fundo do container; fixed escapa a qualquer ancestral com overflow.
function HighlightTooltip({ anchor, children }: { anchor: HTMLElement; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const r = anchor.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left });
  }, [anchor]);

  if (!pos) return null;
  return (
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: 240, zIndex: 200, background: 'var(--teal)', border: '1px solid var(--teal)', borderRadius: 8, padding: '10px 12px', fontSize: 12, lineHeight: 1.45, fontWeight: 500, color: 'var(--teal-ink)', boxShadow: '0 8px 22px rgba(0,0,0,.4)' }}>
      <span style={{ position: 'absolute', top: -6, left: 16, width: 11, height: 11, background: 'var(--teal)', transform: 'rotate(45deg)', borderRadius: 2 }} />
      {children}
    </div>
  );
}

function MemberAccessButton({ m, isBusy, highlighted, onOpen }: { m: Member; isBusy: boolean; highlighted: boolean; onOpen: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  // No primeiro render depois de o membro passar de candidato a membro, a ref ainda é
  // null (só fica preenchida depois do commit ao DOM) — sem este estado, a condição
  // "highlighted && btnRef.current" via renderização falha sempre nesse primeiro ciclo
  // e a tooltip nunca chega a aparecer. Forçar um re-render extra depois do mount resolve.
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (highlighted) forceRender(n => n + 1);
  }, [highlighted]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={onOpen}
        disabled={isBusy}
        style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 7, border: `1px solid ${highlighted ? 'var(--teal)' : 'var(--border)'}`, background: 'transparent', color: 'var(--text-2)', cursor: isBusy ? 'default' : 'pointer', textAlign: 'left' }}
      >
        {m.application_ids.length} app{m.application_ids.length !== 1 ? 's' : ''} · editar
      </button>
      {highlighted && btnRef.current && (
        <HighlightTooltip anchor={btnRef.current}>
          Próximo passo: escolhe as aplicações a que {m.name.split(' ')[0]} vai ter acesso.
        </HighlightTooltip>
      )}
    </div>
  );
}

type AllowedRole = 'DEVELOPER' | 'TECH_LEAD';

export default function Team() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const [members, setMembers] = useState<Member[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateRoles, setCandidateRoles] = useState<Record<string, AllowedRole>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamErr, setTeamErr] = useState('');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [accessMember, setAccessMember] = useState<Member | null>(null);
  const [accessSelection, setAccessSelection] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessErr, setAccessErr] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [removingErr, setRemovingErr] = useState('');
  const [highlightMemberId, setHighlightMemberId] = useState<string | null>(
    (location.state as { newDeveloperId?: string } | null)?.newDeveloperId ?? null
  );

  useEffect(() => {
    if (location.state) nav(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teamId = localStorage.getItem(OB_TEAM_ID);
  const projectId = localStorage.getItem(OB_PROJECT_ID);

  function load() {
    if (!teamId) { setErr('Team não encontrada.'); return; }
    apiFetch(`/teams/${teamId}/members`)
      .then(({ members: m, candidates: c }: { members: Member[]; candidates: Candidate[] }) => {
        setMembers(m);
        setCandidates(c);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Erro ao carregar team.'));
    apiFetch(`/teams/${teamId}`).then(setTeam).catch(() => setTeam(null));
    if (projectId) {
      apiFetch(`/projects/${projectId}/applications`).then(setApps).catch(() => setApps([]));
    }
  }

  useEffect(load, [teamId]);

  function openAccess(m: Member) {
    setAccessMember(m);
    setAccessSelection(m.application_ids);
    setAccessErr('');
  }

  function toggleAccess(appId: string) {
    setAccessSelection(prev => prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]);
  }

  async function saveAccess() {
    if (!teamId || !accessMember) return;
    setSavingAccess(true); setAccessErr('');
    try {
      const updated: Member = await apiFetch(`/teams/${teamId}/members/${accessMember.team_member_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ application_ids: accessSelection }),
      });
      setMembers(prev => prev.map(x => x.team_member_id === updated.team_member_id ? updated : x));
      setAccessMember(null);
    } catch (e: unknown) {
      setAccessErr(e instanceof Error ? e.message : 'Erro ao guardar acessos.');
    } finally { setSavingAccess(false); }
  }

  function openEditTeam() {
    setEditName(team?.name ?? '');
    setEditDescription(team?.description ?? '');
    setTeamErr('');
    setShowEditTeam(true);
  }

  async function saveTeam() {
    if (!teamId) return;
    setSavingTeam(true); setTeamErr('');
    try {
      const updated: TeamInfo = await apiFetch(`/teams/${teamId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName, description: editDescription }),
      });
      setTeam(updated);
      setShowEditTeam(false);
    } catch (e: unknown) {
      setTeamErr(e instanceof Error ? e.message : 'Erro ao guardar equipa.');
    } finally { setSavingTeam(false); }
  }

  async function addCandidate(candidate: Candidate) {
    if (!teamId) return;
    const role = candidateRoles[candidate.user_id] ?? 'DEVELOPER';
    setBusy(candidate.user_id);
    try {
      const member: Member = await apiFetch(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: candidate.user_id, role }),
      });
      setMembers(prev => [...prev, member]);
      setCandidates(prev => prev.filter(c => c.user_id !== candidate.user_id));
      if (role === 'DEVELOPER') setHighlightMemberId(member.team_member_id);
      window.dispatchEvent(new CustomEvent('devship:team-changed'));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao adicionar membro.');
    } finally { setBusy(null); }
  }

  // A CLOUD_ENGINEER pode gerir qualquer membro; um TECH_LEAD só pode gerir DEVELOPERs
  // (regra espelhada no backend em _require_manageable_target).
  function canManage(target: Member) {
    if (user?.role === 'cloud') return true;
    if (user?.role === 'tech') return target.role === 'DEVELOPER';
    return false;
  }

  async function removeMember(m: Member) {
    if (!teamId) return;
    setBusy(m.team_member_id);
    try {
      await apiFetch(`/teams/${teamId}/members/${m.team_member_id}`, { method: 'DELETE' });
      // Refaz a lista toda em vez de só filtrar localmente: o utilizador removido pode
      // voltar a aparecer como candidato (mesmo domínio, já sem team), e só o backend
      // sabe dizer isso com certeza.
      load();
      setConfirmRemove(null);
      window.dispatchEvent(new CustomEvent('devship:team-changed'));
    } catch (e: unknown) {
      setRemovingErr(e instanceof Error ? e.message : 'Erro ao remover membro.');
    } finally { setBusy(null); }
  }

  async function changeRole(m: Member, role: AllowedRole) {
    if (!teamId || role === m.role) return;
    setBusy(m.team_member_id);
    try {
      const updated: Member = await apiFetch(`/teams/${teamId}/members/${m.team_member_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role, application_ids: role === 'DEVELOPER' ? [] : undefined }),
      });
      setMembers(prev => prev.map(x => x.team_member_id === m.team_member_id ? updated : x));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao alterar role.');
    } finally { setBusy(null); }
  }

  const canAddMembers = user?.role === 'cloud' || user?.role === 'tech';
  const readOnly = !canAddMembers; // Developer: read-only access to the Team page
  const anyManageable = members.some(m => canManage(m) && m.role !== 'CLOUD_ENGINEER');
  const memberGridColumns = anyManageable ? '1fr 160px 120px 100px 80px' : '1fr 160px 120px 100px';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Equipa</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
            {readOnly ? 'Membros da equipa.' : 'Membros da equipa e candidatos descobertos automaticamente.'}
          </p>
        </div>
        {canAddMembers && (
          <button onClick={() => nav('/app/team/add')} className="btn-primary hover-bright" style={{ fontSize: 12.5, padding: '9px 16px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span>+</span> Adicionar membro
          </button>
        )}
      </div>

      {err && (
        <div style={{ display: 'flex', gap: 9, border: '1px solid rgba(241,85,108,.3)', background: 'rgba(241,85,108,.08)', borderRadius: 9, padding: '10px 13px', marginBottom: 16 }}>
          <span style={{ color: '#ff8497' }}>✕</span>
          <span style={{ fontSize: 12, color: '#ff9aaa' }}>{err}</span>
        </div>
      )}

      {/* Team identity */}
      {team && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Identidade da equipa</span>
            {user?.role === 'cloud' && (
              <button onClick={openEditTeam} style={{ fontSize: 12, padding: '6px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>
                Editar equipa
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flex: 'none' }}>{initials(team.name)}</div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{team.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>{team.description || 'Sem descrição.'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit team modal */}
      {showEditTeam && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowEditTeam(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 30px', maxWidth: 440, width: '100%', margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 14px' }}>Editar equipa</h2>
            {teamErr && <div style={{ fontSize: 12, color: '#ff9aaa', marginBottom: 10 }}>{teamErr}</div>}
            <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>Nome</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }}
            />
            <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>Descrição</label>
            <textarea
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={saveTeam}
                disabled={savingTeam || !editName.trim()}
                className="btn-primary hover-bright"
                style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, fontWeight: 600, opacity: (savingTeam || !editName.trim()) ? .6 : 1 }}
              >
                {savingTeam ? 'A guardar…' : 'Guardar'}
              </button>
              <button onClick={() => setShowEditTeam(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Members table */}
      {members.length > 0 && (
        <>
        <div className="responsive-table-hint" style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>↔ desliza para o lado para ver todas as colunas</div>
        <div className="responsive-table-grid" style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', marginBottom: 24 }}>
          <div style={{ minWidth: 560, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: memberGridColumns, gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            <span>Membros</span><span>Role</span><span>Aplicações</span><span>Desde</span>{anyManageable && <span style={{ textAlign: 'right' }}>Ação</span>}
          </div>
          {members.map((m, i) => {
            const isOwner = m.role === 'CLOUD_ENGINEER';
            const manageable = canManage(m) && !isOwner;
            const isBusy = busy === m.team_member_id;
            return (
              <div key={m.team_member_id} style={{ display: 'grid', gridTemplateColumns: memberGridColumns, gap: 12, padding: '14px 20px', borderBottom: i < members.length - 1 ? '1px solid var(--border-soft)' : 'none', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, flex: 'none' }}>{initials(m.name)}</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
                      {m.name}
                      {isOwner && <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 5, background: 'rgba(43,199,180,.12)', color: 'var(--teal)', border: '1px solid rgba(43,199,180,.28)', fontWeight: 600 }}>Proprietário</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{m.email}</div>
                  </div>
                </div>
                {manageable ? (
                  <select
                    value={m.role}
                    onChange={e => changeRole(m, e.target.value as AllowedRole)}
                    className="select-base"
                    disabled={isBusy}
                    style={{ fontSize: 12.5 }}
                  >
                    <option value="DEVELOPER">Developer</option>
                    <option value="TECH_LEAD">Tech Lead</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{ROLE_LABEL[m.role] ?? m.role}</span>
                )}
                {m.role === 'DEVELOPER' ? (
                  manageable ? (
                    <MemberAccessButton
                      m={m}
                      isBusy={isBusy}
                      highlighted={highlightMemberId === m.team_member_id && !confirmRemove}
                      onOpen={() => { openAccess(m); setHighlightMemberId(null); }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.application_ids.length} app{m.application_ids.length !== 1 ? 's' : ''}</span>
                  )
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                )}
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{formatDate(m.joined_at)}</span>
                {anyManageable && (
                  <div style={{ textAlign: 'right' }}>
                    {manageable && (
                      <button
                        onClick={() => { setConfirmRemove(m); setRemovingErr(''); }}
                        disabled={isBusy}
                        style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? .6 : 1 }}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
        </>
      )}

      {/* Remove member confirmation modal */}
      {confirmRemove && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setConfirmRemove(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 30px', maxWidth: 420, width: '100%', margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px' }}>Remover membro</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 18px', lineHeight: 1.6 }}>
              Tens a certeza que queres remover <strong>{confirmRemove.name}</strong> da equipa? Perde acesso imediato a todas as applications.
            </p>
            {removingErr && <div style={{ fontSize: 12, color: '#ff9aaa', marginBottom: 10 }}>{removingErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => removeMember(confirmRemove)}
                disabled={busy === confirmRemove.team_member_id}
                style={{ background: 'rgba(241,85,108,.15)', border: '1px solid rgba(241,85,108,.35)', color: '#ff8497', fontSize: 13, padding: '10px 20px', borderRadius: 9, cursor: busy === confirmRemove.team_member_id ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: busy === confirmRemove.team_member_id ? .6 : 1 }}
              >
                {busy === confirmRemove.team_member_id ? 'A remover…' : 'Remover'}
              </button>
              <button onClick={() => setConfirmRemove(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Application access modal */}
      {accessMember && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setAccessMember(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 30px', maxWidth: 440, width: '100%', margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px' }}>Aplicações de {accessMember.name}</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 18px', lineHeight: 1.6 }}>
              Um Developer só vê e faz deploy nas aplicações selecionadas.
            </p>
            {accessErr && <div style={{ fontSize: 12, color: '#ff9aaa', marginBottom: 10 }}>{accessErr}</div>}
            {apps.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Nenhuma aplicação neste projeto ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {apps.map(a => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', border: `1px solid ${accessSelection.includes(a.id) ? 'rgba(43,199,180,.4)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: accessSelection.includes(a.id) ? 'rgba(43,199,180,.05)' : 'var(--bg-2)' }}>
                    <input type="checkbox" checked={accessSelection.includes(a.id)} onChange={() => toggleAccess(a.id)} style={{ accentColor: 'var(--teal)', flex: 'none' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.source_repository}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={saveAccess}
                disabled={savingAccess}
                className="btn-primary hover-bright"
                style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, fontWeight: 600, opacity: savingAccess ? .6 : 1 }}
              >
                {savingAccess ? 'A guardar…' : 'Guardar'}
              </button>
              <button onClick={() => setAccessMember(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions legend */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setShowPermissions(v => !v)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', fontSize: 12.5, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ transform: showPermissions ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform .15s' }}>›</span>
          Ver permissões por role
        </button>
        {showPermissions && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, marginTop: 14, padding: '18px 20px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
            {(['CLOUD_ENGINEER', 'TECH_LEAD', 'DEVELOPER'] as const).map(role => (
              <div key={role}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: role === 'CLOUD_ENGINEER' ? 'var(--teal)' : role === 'TECH_LEAD' ? '#7fb6f9' : 'var(--text)', marginBottom: 6 }}>{ROLE_LABEL[role]}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.7 }}>{ROLE_PERMISSIONS[role].join(' · ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidates — only visible to whoever can act on them (CE, Tech Lead) */}
      {canAddMembers && candidates.length > 0 && (
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
                  disabled={busy === c.user_id || user?.role === 'tech'}
                  title={user?.role === 'tech' ? 'Um Tech Lead só pode adicionar Developers.' : undefined}
                >
                  <option value="DEVELOPER">Developer</option>
                  {user?.role === 'cloud' && <option value="TECH_LEAD">Tech Lead</option>}
                </select>
                <button
                  onClick={() => addCandidate(c)}
                  disabled={busy === c.user_id}
                  className="btn-primary hover-bright"
                  style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, opacity: busy === c.user_id ? .6 : 1 }}
                >
                  {busy === c.user_id ? 'A adicionar…' : 'Adicionar'}
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

    </div>
  );
}
