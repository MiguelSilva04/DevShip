import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { apiFetch } from '../api/client';
import { OB_TEAM_ID, OB_PROJECT_ID, OB_TEAM_NAME, OB_PROJ_NAME } from './Onboarding';

interface TeamEntry {
  team_id: string;
  team_name: string;
  role: 'CLOUD_ENGINEER' | 'TECH_LEAD' | 'DEVELOPER';
  project_id: string | null;
  project_name: string | null;
  setup_status: string | null;
}

const ROLE_BADGE: Record<string, { bg: string; col: string; bord: string; label: string }> = {
  CLOUD_ENGINEER: { bg:'rgba(43,199,180,.12)', col:'var(--teal)',   bord:'rgba(43,199,180,.3)', label:'Cloud Engineer' },
  TECH_LEAD:      { bg:'rgba(77,156,246,.12)', col:'#7fb6f9',       bord:'rgba(77,156,246,.3)', label:'Tech Lead'      },
  DEVELOPER:      { bg:'var(--surface-2)',      col:'var(--text-2)', bord:'var(--border)',       label:'Developer'      },
};

function setupStatus(entry: TeamEntry) {
  if (!entry.project_id) {
    return { label:'Onboarding por concluir', color:'var(--text-3)', bg:'transparent', bord:'var(--border)', dot:'', dashed:true };
  }
  if (entry.setup_status === 'CONFIGURED') {
    return { label:'Configurado', color:'#5dd57b', bg:'rgba(52,199,89,.13)', bord:'rgba(52,199,89,.24)', dot:'#34C759', dashed:false };
  }
  return { label:'Onboarding por concluir', color:'var(--text-3)', bg:'transparent', bord:'var(--border)', dot:'', dashed:true };
}

export default function Lobby() {
  const nav = useNavigate();
  const { user, token } = useUser();
  const [teams, setTeams] = useState<TeamEntry[] | null>(null);
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    if (!token) return; // demo mode — no fetch
    apiFetch('/users/me/teams')
      .then(setTeams)
      .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : 'Erro ao carregar teams.'));
  }, [token]);

  // Demo mode: token absent, user set via demo button
  const isDemo = !token && !!user;
  const isCloud = user?.role === 'cloud';
  const isDev   = user?.role === 'dev';

  const firstName = user?.name.split(' ')[0] ?? 'utilizador';
  const title    = `Bem-vindo, ${firstName}`;
  const subtitle = isCloud
    ? 'Escolhe um projeto para entrar ou cria uma nova equipa.'
    : isDev
    ? 'Escolhe o projeto em que participas.'
    : 'Escolhe o projeto ou cria uma nova equipa.';

  // Real teams: token present
  if (token) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
        <div style={{ maxWidth:620, margin:'0 auto', padding:'56px 26px 90px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:8 }}>
            <img src="/devship-logo.png" alt="DevShip" style={{ width:38, height:38 }} />
            <h1 style={{ fontSize:23, fontWeight:600, letterSpacing:'-.01em', margin:0 }}>{title}</h1>
          </div>
          <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, margin:'0 0 26px' }}>
            {teams && teams.length > 0
              ? (teams[0].role === 'CLOUD_ENGINEER' ? 'Escolhe um projeto para entrar ou cria uma nova equipa.' : 'Escolhe o projeto em que participas.')
              : 'Carregando as tuas teams…'}
          </p>

          {loadErr && (
            <div style={{ border:'1px solid rgba(241,85,108,.3)', background:'rgba(241,85,108,.08)', borderRadius:9, padding:'10px 13px', fontSize:12, color:'#ff9aaa', marginBottom:16 }}>{loadErr}</div>
          )}

          {teams === null && !loadErr && (
            <div style={{ color:'var(--text-3)', fontSize:13 }}>A carregar…</div>
          )}

          {teams !== null && teams.length === 0 && (
            <div style={{ border:'1px solid var(--border)', borderRadius:13, padding:24, textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Ainda não pertences a nenhuma team</div>
              <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:18 }}>Cria a tua primeira team e torna-te Cloud Engineer.</div>
              <button onClick={() => nav('/onboarding')} className="btn-primary hover-bright" style={{ fontSize:13, padding:'10px 20px', borderRadius:8 }}>Criar Team →</button>
            </div>
          )}

          {teams !== null && teams.length > 0 && (
            <>
              <div className="mono" style={{ fontSize:10.5, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:13 }}>As tuas teams</div>
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                {teams.map(t => {
                  const badge = ROLE_BADGE[t.role] ?? ROLE_BADGE.DEVELOPER;
                  const status = setupStatus(t);
                  const initials = t.team_name.split(/[-_ ]/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??';
                  const projectLine = t.project_name ?? 'projeto por configurar';
                  function resumeOnboarding() {
                    // Restore localStorage so onboarding steps can pick up where they left off
                    localStorage.setItem(OB_TEAM_ID, t.team_id);
                    localStorage.setItem(OB_TEAM_NAME, t.team_name);
                    if (t.project_id) localStorage.setItem(OB_PROJECT_ID, t.project_id);
                    if (t.project_name) localStorage.setItem(OB_PROJ_NAME, t.project_name);

                    if (!t.project_id) { nav('/onboarding/project'); return; }
                    const dest: Record<string, string> = {
                      PENDING_CLUSTER:      '/onboarding/aws-setup',
                      PENDING_ENVIRONMENTS: '/onboarding/environments',
                      PENDING_APPLICATIONS: '/onboarding/applications',
                    };
                    nav(dest[t.setup_status ?? ''] ?? '/onboarding');
                  }

                  const onClick = t.setup_status === 'CONFIGURED'
                    ? () => nav('/app/home')
                    : t.role === 'CLOUD_ENGINEER'
                    ? resumeOnboarding
                    : undefined;
                  return (
                    <TeamButton
                      key={t.team_id}
                      initials={initials}
                      name={t.team_name}
                      project={projectLine}
                      badge={badge}
                      status={status}
                      onClick={onClick ?? (() => {})}
                    />
                  );
                })}
              </div>
              {teams.some(t => t.role === 'CLOUD_ENGINEER') && (
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:14, lineHeight:1.6 }}>Como Cloud Engineer podes criar e gerir múltiplas teams.</div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Demo mode (mock user set via demo buttons, no real token)
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <div style={{ maxWidth:620, margin:'0 auto', padding:'56px 26px 90px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:8 }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:38, height:38 }} />
          <h1 style={{ fontSize:23, fontWeight:600, letterSpacing:'-.01em', margin:0 }}>{isDemo ? title : 'Bem-vindo à DevShip'}</h1>
        </div>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, margin:'0 0 26px' }}>{isDemo ? subtitle : 'Faz login para ver as tuas teams.'}</p>

        {!isDemo && (
          <button onClick={() => nav('/login')} className="btn-primary hover-bright" style={{ fontSize:13, padding:'10px 20px', borderRadius:8 }}>Entrar →</button>
        )}

        {isDemo && (
          <>
            <div className="mono" style={{ fontSize:10.5, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:13 }}>As tuas teams</div>
            <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
              <TeamButton
                initials="ET"
                name="engineering-team"
                project="my-project"
                badge={isCloud
                  ? { bg:'rgba(43,199,180,.12)', col:'var(--teal)', bord:'rgba(43,199,180,.3)', label:'Cloud Engineer' }
                  : user?.role === 'tech'
                  ? { bg:'rgba(77,156,246,.12)', col:'#7fb6f9', bord:'rgba(77,156,246,.3)', label:'Tech Lead' }
                  : { bg:'var(--surface-2)', col:'var(--text-2)', bord:'var(--border)', label:'Developer' }}
                status={{ label:'Configurado', color:'#5dd57b', bg:'rgba(52,199,89,.13)', bord:'rgba(52,199,89,.24)', dot:'#34C759' }}
                onClick={() => nav('/app/home')}
              />
              {isCloud && (
                <TeamButton
                  initials="NT"
                  name="new-team"
                  project="projeto por configurar"
                  badge={{ bg:'rgba(43,199,180,.12)', col:'var(--teal)', bord:'rgba(43,199,180,.3)', label:'Cloud Engineer' }}
                  status={{ label:'Onboarding por concluir', color:'var(--text-3)', bg:'transparent', bord:'var(--border)', dot:'', dashed:true }}
                  onClick={() => nav('/onboarding')}
                />
              )}
              {isDev && (
                <TeamButton
                  initials="PT"
                  name="platform-team"
                  project="infra-tools · 1 application"
                  badge={{ bg:'var(--surface-2)', col:'var(--text-2)', bord:'var(--border)', label:'Developer' }}
                  status={{ label:'Configurado', color:'#5dd57b', bg:'rgba(52,199,89,.13)', bord:'rgba(52,199,89,.24)', dot:'#34C759' }}
                  onClick={() => nav('/app/home')}
                />
              )}
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:14, lineHeight:1.6 }}>
              {isCloud ? 'Como Cloud Engineer podes criar e gerir múltiplas teams.' : 'Contacta o Cloud Engineer da tua equipa para seres adicionado a outros projetos.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TeamButton({ initials, name, project, badge, status, onClick }: {
  initials: string; name: string; project: string;
  badge:  { bg:string; col:string; bord:string; label:string };
  status: { label:string; color:string; bg:string; bord:string; dot:string; dashed?:boolean };
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display:'flex', alignItems:'center', gap:15, width:'100%', border:`1px solid ${hov ? 'var(--text-3)' : 'var(--border)'}`, borderRadius:13, padding:16, background: hov ? 'var(--surface-2)' : 'var(--surface)', cursor:'pointer', textAlign:'left', color:'var(--text)', transition:'all .15s' }}
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
