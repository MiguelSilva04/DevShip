import { useNavigate } from 'react-router-dom';

const MEMBERS = [
  { name:'Jane Smith',   email:'jane.smith@horizonlabs.io',   initials:'JS', role:'Cloud Engineer', canDeploy:true,  canApprove:true,  isOwner:true  },
  { name:'John Doe',     email:'john.doe@horizonlabs.io',     initials:'JD', role:'Tech Lead',      canDeploy:true,  canApprove:true,  isOwner:false },
  { name:'Bob Johnson',  email:'bob.johnson@horizonlabs.io',  initials:'BJ', role:'Developer',      canDeploy:true,  canApprove:false, isOwner:false },
  { name:'Alice Torres', email:'alice.torres@horizonlabs.io', initials:'AT', role:'Developer',      canDeploy:true,  canApprove:false, isOwner:false },
];

export default function Team() {
  const nav = useNavigate();

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 4px' }}>Team</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', margin:0 }}>Membros da equipa e as suas permissões no projecto.</p>
        </div>
        <button onClick={() => nav('/app/team/add')} className="btn-primary hover-bright" style={{ fontSize:12.5, padding:'9px 16px', borderRadius:9, display:'inline-flex', alignItems:'center', gap:7 }}>
          <span>+</span> Adicionar membro
        </button>
      </div>

      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 160px 90px 90px 80px', gap:12, padding:'12px 20px', borderBottom:'1px solid var(--border)', fontSize:10.5, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
          <span>Membro</span><span>Role</span><span>Deploy</span><span>Aprovar</span><span style={{ textAlign:'right' }}>Ação</span>
        </div>
        {MEMBERS.map((m, i) => (
          <div key={m.email} style={{ display:'grid', gridTemplateColumns:'1fr 160px 90px 90px 80px', gap:12, padding:'14px 20px', borderBottom: i < MEMBERS.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:11 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11.5, fontWeight:600, flex:'none' }}>{m.initials}</div>
              <div>
                <div style={{ fontSize:13.5, fontWeight:500, display:'flex', alignItems:'center', gap:7 }}>
                  {m.name}
                  {m.isOwner && <span style={{ fontSize:9.5, padding:'1px 6px', borderRadius:5, background:'rgba(43,199,180,.12)', color:'var(--teal)', border:'1px solid rgba(43,199,180,.28)', fontWeight:600 }}>OWNER</span>}
                </div>
                <div style={{ fontSize:11.5, color:'var(--text-3)' }}>{m.email}</div>
              </div>
            </div>
            <span style={{ fontSize:12.5, color:'var(--text-2)' }}>{m.role}</span>
            <PermBadge ok={m.canDeploy} />
            <PermBadge ok={m.canApprove} />
            <div style={{ textAlign:'right' }}>
              {!m.isOwner && (
                <button style={{ fontSize:11.5, padding:'5px 11px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', cursor:'pointer' }}>Remover</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PermBadge({ ok }: { ok:boolean }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color: ok ? '#5dd57b' : 'var(--text-3)' }}>
      {ok ? '✓ Sim' : '— Não'}
    </span>
  );
}
