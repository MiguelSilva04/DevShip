import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function Lobby() {
  const nav = useNavigate();
  const { user } = useUser();
  const isCloud = user?.role === 'cloud';
  const isDev   = user?.role === 'dev';

  const roleBadge = isCloud
    ? { bg:'rgba(43,199,180,.12)', col:'var(--teal)',  bord:'rgba(43,199,180,.3)', label:'Cloud Engineer' }
    : user?.role === 'tech'
    ? { bg:'rgba(77,156,246,.12)', col:'#7fb6f9',      bord:'rgba(77,156,246,.3)', label:'Tech Lead' }
    : { bg:'var(--surface-2)',     col:'var(--text-2)', bord:'var(--border)',       label:'Developer' };

  const title    = user ? `Bem-vindo, ${user.name.split(' ')[0]}` : 'Bem-vindo à DevShip';
  const subtitle = isCloud
    ? 'Escolhe um projeto para entrar ou cria uma nova equipa.'
    : isDev
    ? 'Escolhe o projeto em que participas.'
    : 'Escolhe o projeto ou cria uma nova equipa.';

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <div style={{ maxWidth:620, margin:'0 auto', padding:'56px 26px 90px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:8 }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:38, height:38 }} />
          <h1 style={{ fontSize:23, fontWeight:600, letterSpacing:'-.01em', margin:0 }}>{title}</h1>
        </div>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, margin:'0 0 26px' }}>{subtitle}</p>

        <div className="mono" style={{ fontSize:10.5, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:13 }}>As tuas teams</div>

        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          {/* Configured team */}
          <TeamButton
            initials="ET"
            name="engineering-team"
            project="my-project"
            badge={roleBadge}
            status={{ label:'Configurado', color:'#5dd57b', bg:'rgba(52,199,89,.13)', bord:'rgba(52,199,89,.24)', dot:'#34C759' }}
            onClick={() => nav('/app/home')}
          />

          {/* Unconfigured (Cloud Engineer only) */}
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

          {/* Second team (Dev) */}
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

