import { useUser } from '../../context/UserContext';

const TRANSLATION_ROWS: [string, string, string][] = [
  ['Não escondemos Kubernetes.', 'Traduzimo-lo.', 'Cada estado mostrado vem diretamente da Kubernetes API — versões, réplicas e probes reais, não uma camada que esconde o que corre no cluster.'],
  ['Não removemos GitOps.', 'Tornamo-lo observável.', 'O repositório GitOps continua a ser a fonte de verdade. A DevShip mostra o diff, o commit e o sync do ArgoCD a acontecer — em vez de os esconder atrás de um botão.'],
  ['Não substituímos Cloud Engineers.', 'Devolvemos-lhes tempo.', 'Os pedidos repetitivos de deploy deixam de passar por eles. Mantêm IAM, políticas de aprovação e governação do cluster — sem serem o gargalo.'],
];

const DEV_BENEFITS = [
  'Deploy e rollback num clique, por environment',
  'Estado, versões e health em tempo real',
  'Logs, eventos e pods da tua aplicação',
  'Acesso aos environments só via as tuas applications',
];

function HowItWorksDev() {
  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 6px' }}>Como funciona</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 30px', lineHeight:1.6 }}>
        A DevShip existe para tirar o Kubernetes do teu caminho — sem te esconder o que realmente acontece com a tua aplicação.
      </p>

      {/* O Problema */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>O problema que resolvemos</h2>
      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'22px 24px', marginBottom:28 }}>
        <p style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.7, margin:'0 0 18px', maxWidth:640 }}>
          Sem uma plataforma interna, publicar uma aplicação significa pedir, esperar e depender de quem domina a infraestrutura.
          O Cloud Engineer torna-se um gargalo; tu perdes o controlo do que acontece depois do "deploy".
        </p>
        <figure style={{ margin:0, border:'1px solid var(--border-soft)', borderRadius:10, overflow:'hidden', background:'var(--bg-2)' }}>
          <figcaption className="mono" style={{ display:'flex', alignItems:'center', gap:10, fontSize:10.5, color:'var(--text-3)', padding:'9px 14px', borderBottom:'1px solid var(--border-soft)' }}>
            <span style={{ color:'var(--teal)' }}>FIG.01</span><span>antes_vs_depois.png</span><span style={{ marginLeft:'auto' }}>o custo operacional da espera</span>
          </figcaption>
          <img src="/landing-dev.png" alt="A jornada de deploy: sem DevShip vs com DevShip" style={{ width:'100%', display:'block' }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
        </figure>
      </div>

      {/* O que ganhas */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>Deploy sem aprender Kubernetes</h2>
      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 24px', marginBottom:28 }}>
        {DEV_BENEFITS.map(t => (
          <div key={t} style={{ display:'flex', gap:10, fontSize:13, color:'var(--text-2)', marginBottom:11 }}>
            <span className="mono" style={{ color:'var(--teal)' }}>+</span> {t}
          </div>
        ))}
      </div>

      {/* Tradução */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>A mesma verdade, com menos fricção</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:1, border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:28 }}>
        {TRANSLATION_ROWS.map(([t1, t2, body], i) => (
          <div key={i} className="responsive-grid" style={{ display:'grid', gridTemplateColumns:'260px 1fr', background:'var(--surface)', borderBottom: i < TRANSLATION_ROWS.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            <div style={{ padding:'17px 20px', borderRight:'1px solid var(--border-soft)' }}>
              <span style={{ fontSize:14, fontWeight:600 }}>{t1}</span><br />
              <span style={{ fontSize:14, fontWeight:600, color:'var(--teal)' }}>{t2}</span>
            </div>
            <div style={{ padding:'17px 20px', fontSize:12.5, color:'var(--text-2)', lineHeight:1.6, display:'flex', alignItems:'center' }}>{body}</div>
          </div>
        ))}
      </div>

      {/* Permissões — reaproveita a mesma tabela de roles */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>Permissões por role</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:13 }}>
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
    </div>
  );
}

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
  const { user } = useUser();
  if (user?.role !== 'cloud') return <HowItWorksDev />;

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

      {/* Prerequisites */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>Pré-requisitos de infraestrutura</h2>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 20px', lineHeight:1.6 }}>
        A DevShip valida automaticamente o essencial no onboarding — mas há peças que continuam a ser tua responsabilidade configurar. Aqui está a lista completa, para que o primeiro deploy corra sem surpresas.
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
        <div style={{ border:'1px solid var(--border)', borderRadius:13, background:'var(--surface)', padding:'18px 20px' }}>
          <div style={{ fontSize:13.5, fontWeight:600, marginBottom:4 }}>Código e build</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>Responsabilidade tua, fora da DevShip</div>
          <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
            {['Repositório Git com o código da aplicação', 'Workflow GitHub Actions que faz build e push da imagem', 'Registo de imagens acessível a esse workflow (ECR ou equivalente)'].map(t => (
              <li key={t} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>
                <span style={{ color:'var(--text-3)', flex:'none', fontSize:11 }}>·</span>{t}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ border:'1px solid var(--border)', borderRadius:13, background:'var(--surface)', padding:'18px 20px' }}>
          <div style={{ fontSize:13.5, fontWeight:600, marginBottom:4 }}>Acesso ao cluster</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>Validado automaticamente no onboarding, passos 3-4</div>
          <ul style={{ margin:'0 0 12px', padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
            {['Cluster EKS alcançável', 'IAM Role com Access Entry e permissão de leitura (AmazonEKSViewPolicy)'].map(t => (
              <li key={t} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>
                <span style={{ color:'var(--text-3)', flex:'none', fontSize:11 }}>·</span>{t}
              </li>
            ))}
          </ul>
          <p style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.55, margin:0 }}>
            O onboarding guia-te por isto com os comandos AWS CLI exatos a correr — não precisas de adivinhar nem de usar Terraform se não quiseres.
          </p>
        </div>

        <div style={{ border:'1px solid var(--border)', borderRadius:13, background:'var(--surface)', padding:'18px 20px' }}>
          <div style={{ fontSize:13.5, fontWeight:600, marginBottom:4 }}>ArgoCD e Metrics API</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>Configuração manual, passo 5 do onboarding</div>
          <p style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.55, margin:'0 0 12px' }}>
            Isto não bloqueia o deploy — mas sem ele, o pipeline degrada silenciosamente: perdes o estado de sincronização do ArgoCD e as métricas de CPU/memória deixam de aparecer no ecrã Pods.
          </p>
          <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
            {['ArgoCD instalado no cluster, com as Applications já criadas', 'ClusterRole/ClusterRoleBinding a dar leitura sobre applications.argoproj.io', 'metrics-server instalado no cluster', 'ClusterRole/ClusterRoleBinding a dar leitura sobre metrics.k8s.io'].map(t => (
              <li key={t} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>
                <span style={{ color:'var(--text-3)', flex:'none', fontSize:11 }}>·</span>{t}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display:'flex', gap:12, alignItems:'flex-start', border:'1px solid rgba(224,169,59,.35)', background:'rgba(224,169,59,.07)', borderRadius:13, padding:'16px 18px' }}>
          <span style={{ color:'#ecc26b', fontSize:15, flex:'none' }}>⚠</span>
          <p style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.6, margin:0 }}>
            O <span style={{ color:'#ecc26b', fontWeight:600 }}>ClusterRoleBinding</span> não aponta para o ARN da tua IAM Role — aponta para a identidade da sessão assumida por essa role. O passo 5 do onboarding calcula isto automaticamente e dá-te o YAML já pronto a aplicar com <code className="mono">kubectl</code>.
          </p>
        </div>

        <p style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.6, margin:0 }}>
          Nenhuma destas duas últimas peças (ArgoCD, Metrics) tem equivalente no painel da AWS — são objetos Kubernetes, sempre aplicados via <code className="mono">kubectl</code>, seja qual for a forma como configuraste o resto (Terraform, AWS CLI, ou à mão na consola).
        </p>
      </div>

      {/* Roles */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>Permissões por role</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:13, marginBottom:28 }}>
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
