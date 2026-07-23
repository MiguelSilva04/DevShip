import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, userFromBackend } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKey } from '../context/LanguageContext';
import { apiFetch } from '../api/client';
import { OB_TEAM_ID, OB_PROJECT_ID, OB_TEAM_NAME, OB_PROJ_NAME } from './Onboarding';

type MemberStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED';

interface ProjectSummary {
  id: string;
  name: string;
  setup_status: string;
}

interface TeamEntry {
  team_id: string;
  team_name: string;
  role: 'CLOUD_ENGINEER' | 'TECH_LEAD' | 'DEVELOPER';
  company_id: string;
  company_name: string;
  status: MemberStatus;
  projects: ProjectSummary[];
}

// Último Project escolhido nesta Team (gravado pelo dropdown em Settings), ou o mais
// antigo (projects[0], já vem ordenado por created_at do backend) se nunca escolheu.
function resolveActiveProject(t: TeamEntry): ProjectSummary | null {
  if (t.projects.length === 0) return null;
  const lastId = localStorage.getItem(`ob_last_project_${t.team_id}`);
  return t.projects.find(p => p.id === lastId) ?? t.projects[0];
}

interface DomainStatus {
  domain: string;
  has_company: boolean;
  company_id: string | null;
}

interface PendingTeamEntry {
  team_id: string;
  team_name: string;
  team_description: string | null;
  created_at: string;
  pending_user_id: string;
  pending_user_name: string;
  pending_user_email: string;
}

function roleBadge(role: string, t: (key: TranslationKey) => string): { bg: string; col: string; bord: string; label: string } {
  const badges: Record<string, { bg: string; col: string; bord: string; label: string }> = {
    CLOUD_ENGINEER: { bg:'rgba(43,199,180,.12)', col:'var(--teal)',   bord:'rgba(43,199,180,.3)', label:t('lobby.roleCloudEngineer') },
    TECH_LEAD:      { bg:'rgba(77,156,246,.12)', col:'var(--blue)',       bord:'rgba(77,156,246,.3)', label:t('lobby.roleTechLead')      },
    DEVELOPER:      { bg:'var(--surface-2)',      col:'var(--text-2)', bord:'var(--border)',       label:t('lobby.roleDeveloper')     },
  };
  return badges[role] ?? badges.DEVELOPER;
}

function setupStatus(entry: TeamEntry, activeProject: ProjectSummary | null, t: (key: TranslationKey) => string) {
  if (entry.status === 'PENDING_CONFIRMATION') {
    return { label:t('lobby.statusPendingConfirmation'), color:'var(--amber)', bg:'rgba(224,169,59,.13)', bord:'rgba(224,169,59,.26)', dot:'var(--amber)', dashed:false };
  }
  if (!activeProject) {
    return { label:t('lobby.statusOnboardingIncomplete'), color:'var(--text-3)', bg:'transparent', bord:'var(--border)', dot:'', dashed:true };
  }
  if (activeProject.setup_status === 'CONFIGURED') {
    return { label:t('lobby.statusConfigured'), color:'var(--green)', bg:'rgba(52,199,89,.13)', bord:'rgba(52,199,89,.24)', dot:'var(--green)', dashed:false };
  }
  return { label:t('lobby.statusOnboardingIncomplete'), color:'var(--text-3)', bg:'transparent', bord:'var(--border)', dot:'', dashed:true };
}

export default function Lobby() {
  const nav = useNavigate();
  const { user, token, logout, setUser } = useUser();
  const { t } = useLanguage();
  const [teams, setTeams] = useState<TeamEntry[] | null>(null);
  const [domainStatus, setDomainStatus] = useState<DomainStatus | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [pendingTeams, setPendingTeams] = useState<PendingTeamEntry[] | null>(null);
  const [pendingActionErr, setPendingActionErr] = useState('');

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch('/users/me/teams'),
      apiFetch('/users/me/domain-status'),
    ])
      .then(([teamsData, ds]: [TeamEntry[], DomainStatus]) => {
        setTeams(teamsData);
        setDomainStatus(ds);
        const activeTeams = teamsData.filter(t => t.status !== 'REJECTED');
        // Non-Cloud Engineers com projeto configurado vão direto para a app — Teams
        // pendentes de confirmação não contam como "prontas", mesmo sendo CLOUD_ENGINEER.
        const allConfigured = activeTeams.length > 0 && activeTeams.every(t => resolveActiveProject(t)?.setup_status === 'CONFIGURED' && t.status !== 'PENDING_CONFIRMATION');
        const isNonCloud = activeTeams.length > 0 && activeTeams.every(t => t.role !== 'CLOUD_ENGINEER');
        if (allConfigured && isNonCloud) {
          const t = activeTeams[0];
          const activeProject = resolveActiveProject(t);
          localStorage.setItem(OB_TEAM_ID, t.team_id);
          localStorage.setItem(OB_TEAM_NAME, t.team_name);
          if (activeProject) {
            localStorage.setItem(OB_PROJECT_ID, activeProject.id);
            localStorage.setItem(OB_PROJ_NAME, activeProject.name);
          }
          if (user) setUser(userFromBackend(user.name, user.email, t.role));
          nav('/app/home', { replace: true });
        }

        // Teams pendentes de confirmação da(s) Company(ies) onde já sou CE confirmado
        const confirmedCeCompanyIds = [...new Set(
          activeTeams.filter(t => t.role === 'CLOUD_ENGINEER' && t.status === 'CONFIRMED').map(t => t.company_id)
        )];
        if (confirmedCeCompanyIds.length > 0) {
          Promise.all(confirmedCeCompanyIds.map(cid => apiFetch(`/companies/${cid}/pending-teams`)))
            .then((lists: PendingTeamEntry[][]) => setPendingTeams(lists.flat()))
            .catch(() => setPendingTeams([]));
        }
      })
      .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : t('lobby.errLoad')));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function actOnPendingTeam(teamId: string, action: 'confirm' | 'reject') {
    setPendingActionErr('');
    apiFetch(`/teams/${teamId}/${action}`, { method: 'POST' })
      .then(() => setPendingTeams(prev => (prev ?? []).filter(p => p.team_id !== teamId)))
      .catch((e: unknown) => setPendingActionErr(e instanceof Error ? e.message : t('lobby.errPendingAction')));
  }

  // Real teams: token present
  if (token) {
    const firstName = user?.name.split(' ')[0] ?? '…';
    const activeTeams = (teams ?? []).filter(t => t.status !== 'REJECTED');

    let subtitle;
    if (activeTeams.length > 0) {
      subtitle = activeTeams[0].role === 'CLOUD_ENGINEER'
        ? t('lobby.subtitleCloudEngineer')
        : t('lobby.subtitleOther');
    }

    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
        <div style={{ maxWidth:620, margin:'0 auto', padding:'56px 26px 90px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:8 }}>
            <img src="/devship-logo.png" alt="DevShip" style={{ width:38, height:38 }} />
            <h1 style={{ fontSize:23, fontWeight:600, letterSpacing:'-.01em', margin:0, flex:1 }}>{t('lobby.welcome')}, {firstName}</h1>
            <button onClick={() => { logout(); nav('/login'); }} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', fontSize:12, color:'var(--text-3)', cursor:'pointer' }}>{t('lobby.logout')}</button>
          </div>
          <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, margin:'0 0 26px' }}>{subtitle}</p>

          {loadErr && (
            <div style={{ border:'1px solid rgba(241,85,108,.3)', background:'rgba(241,85,108,.08)', borderRadius:9, padding:'10px 13px', fontSize:12, color:'var(--red)', marginBottom:16 }}>{loadErr}</div>
          )}

          {teams === null && !loadErr && (
            <div style={{ color:'var(--text-3)', fontSize:13 }}>{t('lobby.loading')}</div>
          )}

          {/* Sem TeamMember ativo — dois casos: domínio já tem Company (pode candidatar-se
              OU criar nova Team) ou domínio novo (só pode criar Team, é bootstrap) */}
          {teams !== null && activeTeams.length === 0 && domainStatus !== null && (
            domainStatus.has_company ? (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ border:'1px solid rgba(224,169,59,.25)', borderRadius:13, padding:28, textAlign:'center', background:'rgba(224,169,59,.04)' }}>
                  <div style={{ fontSize:28, marginBottom:14 }}>⏳</div>
                  <div style={{ fontSize:15, fontWeight:600, marginBottom:10 }}>{t('lobby.waitingApproval')}</div>
                  <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, maxWidth:420, margin:'0 auto' }}>
                    <span className="mono" style={{ color:'var(--text)' }}>@{domainStatus.domain}</span> {t('lobby.domainHasTeamsInfo')}
                  </div>
                </div>
                <button onClick={() => nav('/onboarding')} className="btn-secondary" style={{ fontSize:13, padding:'10px 22px', borderRadius:9, alignSelf:'center' }}>
                  {t('lobby.createNewTeam')}
                </button>
              </div>
            ) : (
              // Domínio novo — bootstrap: pode iniciar onboarding e criar a primeira Team
              <div style={{ border:'1px solid var(--border)', borderRadius:13, padding:28, textAlign:'center' }}>
                <div style={{ fontSize:28, marginBottom:14 }}>🚀</div>
                <div style={{ fontSize:15, fontWeight:600, marginBottom:10 }}>{t('lobby.startOnboarding')}</div>
                <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, maxWidth:420, margin:'0 auto 20px' }}>
                  <span className="mono" style={{ color:'var(--text)' }}>@{domainStatus.domain}</span> {t('lobby.domainNewInfo')}
                </div>
                <button onClick={() => nav('/onboarding')} className="btn-primary hover-bright" style={{ fontSize:13, padding:'10px 22px', borderRadius:9 }}>
                  {t('lobby.createTeamAndConfigure')}
                </button>
              </div>
            )
          )}

          {pendingTeams !== null && pendingTeams.length > 0 && (
            <div style={{ marginBottom:26 }}>
              <div className="mono" style={{ fontSize:10.5, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:13 }}>{t('lobby.pendingTeamsHeader')}</div>
              {pendingActionErr && (
                <div style={{ border:'1px solid rgba(241,85,108,.3)', background:'rgba(241,85,108,.08)', borderRadius:9, padding:'10px 13px', fontSize:12, color:'var(--red)', marginBottom:12 }}>{pendingActionErr}</div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                {pendingTeams.map(p => (
                  <div key={p.team_id} style={{ border:'1px solid rgba(224,169,59,.25)', background:'rgba(224,169,59,.04)', borderRadius:13, padding:16, display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600 }}>{p.team_name}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{t('lobby.foundedBy')} {p.pending_user_name} ({p.pending_user_email})</div>
                    </div>
                    <button onClick={() => actOnPendingTeam(p.team_id, 'reject')} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'7px 14px', fontSize:12.5, color:'var(--text-2)', cursor:'pointer' }}>{t('lobby.reject')}</button>
                    <button onClick={() => actOnPendingTeam(p.team_id, 'confirm')} className="btn-primary hover-bright" style={{ fontSize:12.5, padding:'7px 14px', borderRadius:8 }}>{t('lobby.confirm')}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {teams !== null && activeTeams.length > 0 && (
            <>
              <div className="mono" style={{ fontSize:10.5, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:13 }}>{t('lobby.yourTeams')}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                {activeTeams.map(te => {
                  const badge = roleBadge(te.role, t);
                  const activeProject = resolveActiveProject(te);
                  const st = setupStatus(te, activeProject, t);
                  const initials = te.team_name.split(/[-_ ]/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '??';
                  const projectLine = activeProject?.name ?? t('lobby.projectToConfigure');

                  function goTo() {
                    // CE pendente de confirmação não avança — nem Developers sem onboarding concluído
                    if (te.status === 'PENDING_CONFIRMATION') return;
                    if (activeProject?.setup_status !== 'CONFIGURED' && te.role !== 'CLOUD_ENGINEER') return;

                    if (user) setUser(userFromBackend(user.name, user.email, te.role));
                    localStorage.setItem(OB_TEAM_ID, te.team_id);
                    localStorage.setItem(OB_TEAM_NAME, te.team_name);
                    if (activeProject) {
                      localStorage.setItem(OB_PROJECT_ID, activeProject.id);
                      localStorage.setItem(OB_PROJ_NAME, activeProject.name);
                    }

                    if (activeProject?.setup_status === 'CONFIGURED') { nav('/app/home'); return; }

                    // Cloud Engineer — retomar onboarding no passo correto
                    if (!activeProject) { nav('/onboarding/team'); return; }
                    const dest: Record<string, string> = {
                      PENDING_CLUSTER:      '/onboarding/aws-setup',
                      PENDING_ENVIRONMENTS: '/onboarding/environments',
                      PENDING_APPLICATIONS: '/onboarding/applications',
                    };
                    nav(dest[activeProject.setup_status ?? ''] ?? '/onboarding/team');
                  }

                  const clickable = te.status !== 'PENDING_CONFIRMATION' && (activeProject?.setup_status === 'CONFIGURED' || te.role === 'CLOUD_ENGINEER');

                  return (
                    <TeamButton
                      key={te.team_id}
                      initials={initials}
                      name={te.team_name}
                      project={projectLine}
                      badge={badge}
                      status={st}
                      onClick={goTo}
                      disabled={!clickable}
                    />
                  );
                })}
              </div>
              {activeTeams.some((te: TeamEntry) => te.role === 'CLOUD_ENGINEER') && (
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:14, lineHeight:1.6 }}>{t('lobby.cloudEngineerHint')}</div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Sem token — não autenticado
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <div style={{ maxWidth:620, margin:'0 auto', padding:'56px 26px 90px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:8 }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:38, height:38 }} />
          <h1 style={{ fontSize:23, fontWeight:600, letterSpacing:'-.01em', margin:0 }}>{t('lobby.welcomeGeneric')}</h1>
        </div>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, margin:'0 0 26px' }}>{t('lobby.loginToSeeTeams')}</p>
        <button onClick={() => nav('/login')} className="btn-primary hover-bright" style={{ fontSize:13, padding:'10px 20px', borderRadius:8 }}>{t('lobby.login')}</button>
      </div>
    </div>
  );
}

function TeamButton({ initials, name, project, badge, status, onClick, disabled }: {
  initials: string; name: string; project: string;
  badge:  { bg:string; col:string; bord:string; label:string };
  status: { label:string; color:string; bg:string; bord:string; dot:string; dashed?:boolean };
  onClick: () => void;
  disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display:'flex', alignItems:'center', gap:15, width:'100%', border:`1px solid ${hov && !disabled ? 'var(--text-3)' : 'var(--border)'}`, borderRadius:13, padding:16, background: hov && !disabled ? 'var(--surface-2)' : 'var(--surface)', cursor: disabled ? 'not-allowed' : 'pointer', textAlign:'left', color: disabled ? 'var(--text-3)' : 'var(--text)', transition:'all .15s', opacity: disabled ? 0.6 : 1 }}
    >
      <div style={{ width:38, height:38, borderRadius:10, background:'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600, flex:'none' }}>{initials}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>{name}</div>
        <div className="mono" style={{ fontSize:11.5, color:'var(--text-3)', marginTop:2 }}>{project}</div>
      </div>
      <span style={{ display:'inline-flex', padding:'4px 10px', borderRadius:7, fontSize:10.5, fontWeight:600, background:badge.bg, color:badge.col, border:`1px solid ${badge.bord}` }}>{badge.label}</span>
      <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, fontSize:10.5, background:status.bg, color:status.color, border:`1px ${status.dashed ? 'dashed' : 'solid'} ${status.bord}` }}>
        {status.dot && <span style={{ width:5, height:5, borderRadius:'50%', background:status.dot }}></span>}
        {status.label}
      </span>
      <span style={{ color:'var(--text-3)' }}>→</span>
    </button>
  );
}
