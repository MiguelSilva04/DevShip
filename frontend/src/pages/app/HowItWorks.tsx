const PIPELINE = [
  { step:1, title:'Developer faz commit', desc:'Push para o repositório Git. O DevShip deteta a nova versão disponível.', icon:'💻' },
  { step:2, title:'Escolha do environment', desc:'Developer seleciona o environment de destino (DEV, STAGING ou PROD).', icon:'🎯' },
  { step:3, title:'Validação de permissões', desc:'O sistema verifica a role do utilizador. PROD requer aprovação adicional.', icon:'🔐' },
  { step:4, title:'Pedido de aprovação (PROD)', desc:'Para PROD, um pedido é enviado ao Tech Lead ou Cloud Engineer.', icon:'✋' },
  { step:5, title:'Aprovação e execução', desc:'Após aprovação, o pipeline é ativado e os manifests Kubernetes são aplicados via GitOps.', icon:'🚀' },
  { step:6, title:'Health checks', desc:'O sistema aguarda que os pods fiquem Ready, verificando startup, readiness e liveness probes.', icon:'🩺' },
  { step:7, title:'Deploy concluído', desc:'O tráfego é promovido para a nova versão. O histórico fica registado.', icon:'✅' },
];

const ROLES = [
  { name:'Cloud Engineer', color:'var(--teal)', bg:'rgba(43,199,180,.08)', border:'rgba(43,199,180,.25)', perms:['Gestão total de environments','Adicionar e remover membros','Configurações do projecto','Aprovar e rejeitar deploys PROD','Deploy em todos os environments','Ver histórico completo'] },
  { name:'Tech Lead',      color:'#7fb6f9',     bg:'rgba(77,156,246,.08)', border:'rgba(77,156,246,.25)', perms:['Aprovar e rejeitar deploys PROD','Deploy em todos os environments','Ver histórico do projecto'] },
  { name:'Developer',      color:'var(--text)', bg:'var(--surface)',       border:'var(--border)',         perms:['Deploy em DEV e STAGING','Pedir aprovação para PROD','Ver environments das suas apps','Ver histórico das suas apps'] },
];

export default function HowItWorks() {
  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 6px' }}>Como funciona</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 30px', lineHeight:1.6 }}>
        O DevShip é uma plataforma de continuous delivery desenhada para equipas que fazem deploy em Kubernetes usando GitOps.
      </p>

      {/* Pipeline */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>Pipeline de deploy</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:0, border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden', marginBottom:28 }}>
        {PIPELINE.map((p, i) => (
          <div key={p.step} style={{ display:'flex', alignItems:'flex-start', gap:16, padding:'16px 20px', borderBottom: i < PIPELINE.length-1 ? '1px solid var(--border-soft)' : 'none' }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flex:'none' }}>{p.icon}</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:10, flex:1 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', minWidth:20 }}>{p.step}.</span>
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, marginBottom:3 }}>{p.title}</div>
                <div style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.55 }}>{p.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Roles */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>Permissões por role</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:13, marginBottom:28 }}>
        {ROLES.map(r => (
          <div key={r.name} style={{ border:`1px solid ${r.border}`, borderRadius:13, background:r.bg, padding:'18px 18px' }}>
            <div style={{ fontSize:14, fontWeight:600, color:r.color, marginBottom:13 }}>{r.name}</div>
            <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
              {r.perms.map(p => (
                <li key={p} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>
                  <span style={{ color:r.color, flex:'none', fontSize:11 }}>✓</span>{p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Architecture note */}
      <div style={{ border:'1px solid var(--border-soft)', borderRadius:13, background:'var(--bg-2)', padding:'18px 20px' }}>
        <div style={{ fontSize:12, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:10 }}>Arquitectura</div>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.65, margin:0 }}>
          O DevShip assenta em GitOps: cada deploy atualiza manifests num repositório Git dedicado, que um controller Kubernetes (ex: ArgoCD) reconcilia com o cluster. Isto garante auditabilidade total, rollback imediato e separação entre o plano de controlo e o plano de execução.
        </p>
        {/* Architecture image */}
        <img src="/landing-arch.png" alt="Arquitectura DevShip" style={{ width:'100%', marginTop:16, borderRadius:9, opacity:.85 }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
      </div>
    </div>
  );
}
