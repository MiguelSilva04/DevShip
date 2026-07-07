import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useUser, userFromBackend } from '../../context/UserContext';
import { OB_TEAM_ID } from '../Onboarding';

interface TeamEntry { team_id: string; role: 'CLOUD_ENGINEER' | 'TECH_LEAD' | 'DEVELOPER'; }

export default function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, setUser, logout: authLogout } = useUser();
  const [project, setProject] = useState<{ name: string; team_name: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [candidateCount, setCandidateCount] = useState(0);

  useEffect(() => {
    const projectId = localStorage.getItem('ob_project_id');
    if (!projectId) return;
    apiFetch(`/projects/${projectId}`).then(setProject).catch(() => setProject(null));
  }, []);

  // Role só é normalmente definido pelo Lobby ao escolher a team — se por alguma razão
  // chegámos aqui sem role (ex: sessão restaurada de um estado antigo), resolve-o aqui
  // para o nav e a role label não ficarem em branco indefinidamente.
  useEffect(() => {
    if (!user || user.role) return;
    const teamId = localStorage.getItem(OB_TEAM_ID);
    apiFetch('/users/me/teams')
      .then((teams: TeamEntry[]) => {
        const t = teamId ? teams.find(t => t.team_id === teamId) : teams[0];
        if (t) setUser(userFromBackend(user.name, user.email, t.role));
      })
      .catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCloud = user?.role === 'cloud';
  const canApprove = user?.role === 'cloud' || user?.role === 'tech';
  // Team page: Cloud Engineer manages everything, Tech Lead can add Developers only,
  // Developer gets read-only access — all three roles can open the page.
  const canViewTeam = user?.role === 'cloud' || user?.role === 'tech' || user?.role === 'dev';
  const canManageTeam = user?.role === 'cloud' || user?.role === 'tech';

  useEffect(() => {
    if (!canApprove) return;
    apiFetch('/deployment-requests?request_status=PENDING')
      .then((rows: unknown[]) => setPendingCount(rows.length))
      .catch(() => setPendingCount(0));
  }, [canApprove]);

  useEffect(() => {
    if (!canManageTeam) return;
    const teamId = localStorage.getItem(OB_TEAM_ID);
    if (!teamId) return;
    apiFetch(`/teams/${teamId}/members`)
      .then(({ candidates }: { candidates: unknown[] }) => setCandidateCount(candidates.length))
      .catch(() => setCandidateCount(0));
  }, [canManageTeam]);

  const at = (path: string) => loc.pathname === `/app/${path}` || loc.pathname.startsWith(`/app/${path}/`);
  const active = (path: string): React.CSSProperties => ({
    background: at(path) ? 'var(--surface-2)' : 'transparent',
    color: at(path) ? 'var(--text)' : 'var(--text-2)',
  });

  function logout() { authLogout(); nav('/'); }

  return (
    <div style={{ display:'flex', alignItems:'flex-start', minHeight:'100vh' }}>
      {/* Sidebar */}
      <aside style={{ position:'sticky', top:0, height:'100vh', width:226, flex:'none', background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'16px 12px', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, padding:'4px 10px 16px' }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:26, height:26 }} />
          <span style={{ fontSize:15, fontWeight:600 }}>DevShip</span>
        </div>

        <NavBtn icon={IconGrid}   label="Aplicações" style={active('home')}         onClick={() => nav('/app/home')} />
        {isCloud && <NavBtn icon={IconLayers} label="Ambientes" style={active('environments')} onClick={() => nav('/app/environments')} />}
        {canApprove && (
          <NavBtn icon={IconShield} label="Aprovações" style={active('approvals')} onClick={() => nav('/app/approvals')}>
            {pendingCount > 0 && (
              <span style={{ marginLeft:'auto', background:'var(--teal)', color:'var(--teal-ink)', fontSize:10, fontWeight:600, minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>{pendingCount}</span>
            )}
          </NavBtn>
        )}
        {canViewTeam && (
          <NavBtn icon={IconUsers} label="Equipa" style={active('team')} onClick={() => nav('/app/team')}>
            {canManageTeam && candidateCount > 0 && (
              <span style={{ marginLeft:'auto', background:'var(--teal)', color:'var(--teal-ink)', fontSize:10, fontWeight:600, minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>{candidateCount}</span>
            )}
          </NavBtn>
        )}
        {isCloud && <NavBtn icon={IconSettings} label="Definições"  style={active('settings')}  onClick={() => nav('/app/settings')} />}
        <NavBtn icon={IconBook} label="Como funciona" style={active('how')} onClick={() => nav('/app/how')} />

        {/* User */}
        <button
          onClick={logout}
          style={{ marginTop:'auto', display:'flex', alignItems:'center', gap:10, padding:'11px 12px', borderRadius:9, border:'none', borderTop:'1px solid var(--border-soft)', background:'transparent', cursor:'pointer', textAlign:'left', color:'var(--text)', width:'100%' }}
          className="hover-surface2"
        >
          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flex:'none' }}>
            {user?.initials ?? '?'}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.name ?? 'Utilizador'}</div>
            <div style={{ fontSize:10, color:'var(--text-3)' }}>{user?.roleLabel ?? ''}</div>
          </div>
          <IconLogout style={{ marginLeft:'auto', flex:'none', color:'var(--text-3)', width:15, height:15 }} />
        </button>
      </aside>

      {/* Main */}
      <main style={{ flex:1, minWidth:0 }}>
        {/* Topbar */}
        <div style={{ position:'sticky', top:0, zIndex:30, display:'flex', alignItems:'center', gap:14, padding:'14px 26px', background:'rgba(15,17,23,.85)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--border)' }}>
          {project && (
            <span className="mono" style={{ fontSize:13, color:'var(--text-2)' }}>
              {project.team_name} <span style={{ color:'var(--text-3)' }}>/</span> <span style={{ color:'var(--text)' }}>{project.name}</span>
            </span>
          )}
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            {canApprove && (
              <button onClick={() => nav('/app/approvals')} className="btn-secondary" style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12, padding:'7px 12px', borderRadius:8 }}>
                Aprovações
                {pendingCount > 0 && (
                  <span style={{ background:'var(--teal)', color:'var(--teal-ink)', fontSize:10, fontWeight:600, minWidth:17, height:17, borderRadius:9, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>{pendingCount}</span>
                )}
              </button>
            )}
            {canViewTeam && (
              <button onClick={() => nav('/app/team')} className="btn-secondary" style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12, padding:'7px 12px', borderRadius:8 }}>
                Equipa
                {canManageTeam && candidateCount > 0 && (
                  <span style={{ background:'var(--teal)', color:'var(--teal-ink)', fontSize:10, fontWeight:600, minWidth:17, height:17, borderRadius:9, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>{candidateCount}</span>
                )}
              </button>
            )}
            {isCloud && <button onClick={() => nav('/app/settings')} className="btn-secondary" style={{ fontSize:12, padding:'7px 12px', borderRadius:8 }}>Definições</button>}
          </div>
        </div>

        <div style={{ padding:'26px 30px 90px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavBtn({ icon: Icon, label, style, onClick, children }: {
  icon: React.FC<{style?:React.CSSProperties}>;
  label: string;
  style: React.CSSProperties;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="nav-item" style={style}>
      <Icon style={{ flex:'none', width:15, height:15 }} />
      {label}
      {children}
    </button>
  );
}

// SVG Icons
function IconGrid({ style }: { style?: React.CSSProperties }) {
  return <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>;
}
function IconLayers({ style }: { style?: React.CSSProperties }) {
  return <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function IconShield({ style }: { style?: React.CSSProperties }) {
  return <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>;
}
function IconUsers({ style }: { style?: React.CSSProperties }) {
  return <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function IconSettings({ style }: { style?: React.CSSProperties }) {
  return <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
function IconBook({ style }: { style?: React.CSSProperties }) {
  return <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
}
function IconLogout({ style }: { style?: React.CSSProperties }) {
  return <svg style={style} viewBox="0 0 24 24" fill="none"><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
