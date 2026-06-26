import { useNavigate } from 'react-router-dom';

const pipeline = [
  { idx:'01', kind:'TRIGGER',   title:'Developer',     note:'Pede deploy da versão HEAD do repositório', border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'DeployRequest', hasEdge:true },
  { idx:'02', kind:'VALIDATE',  title:'DevShip',       note:'Valida permissões, aprovações e gera o workflow', border:'rgba(43,199,180,.4)', bg:'rgba(43,199,180,.07)', titleCol:'var(--teal)', edge:'WorkflowPayload', hasEdge:true },
  { idx:'03', kind:'BUILD',     title:'GitHub Actions', note:'Constrói a imagem Docker e faz push para o ECR', border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'ImageTag', hasEdge:true },
  { idx:'04', kind:'GITOPS',    title:'GitOps Repo',   note:'Atualiza o manifesto deployment.yaml com o novo tag', border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'GitCommit', hasEdge:true },
  { idx:'05', kind:'SYNC',      title:'ArgoCD',        note:'Deteta a alteração e sincroniza com o cluster', border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'ApplyManifest', hasEdge:true },
  { idx:'06', kind:'RUNTIME',   title:'Kubernetes',    note:'Aplica o manifesto e aguarda pods saudáveis', border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'HealthStatus', hasEdge:true },
  { idx:'07', kind:'OBSERVE',   title:'DevShip',       note:'Lê probes em tempo real e atualiza o estado', border:'rgba(43,199,180,.4)', bg:'rgba(43,199,180,.07)', titleCol:'var(--teal)', edge:'', hasEdge:false },
];

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="landing-bg" style={{ minHeight:'100vh', color:'var(--text)', fontFamily:"'Geist','Inter',system-ui,sans-serif" }}>
      {/* NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', gap:18, padding:'0 26px', height:58, background:'rgba(10,12,16,.86)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--line-2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:26, height:26 }} />
          <span style={{ fontSize:15.5, fontWeight:600, letterSpacing:'-.01em' }}>DevShip</span>
          <span className="mono" style={{ fontSize:10, fontWeight:600, letterSpacing:'.22em', color:'var(--teal)', background:'rgba(43,199,180,.1)', border:'1px solid rgba(43,199,180,.3)', borderRadius:5, padding:'3px 8px 3px 9px', marginLeft:4 }}>IDP</span>
        </div>
        <div style={{ display:'flex', gap:24, marginLeft:26, fontSize:13, color:'var(--text-2)' }}>
          <a href="#problema" className="hover-teal">O Problema</a>
          <a href="#pipeline" className="hover-teal">Pipeline</a>
          <a href="#traducao" className="hover-teal">Tradução</a>
          <a href="#estados"  className="hover-teal">Estados</a>
          <a href="#roles"    className="hover-teal">Roles</a>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:14 }}>
          <span onClick={() => nav('/login')}    style={{ fontSize:13, color:'var(--text-2)', cursor:'pointer' }} className="hover-teal">Entrar</span>
          <span onClick={() => nav('/register')} className="btn-primary hover-bright" style={{ fontSize:13, fontWeight:600, padding:'8px 16px', borderRadius:7, cursor:'pointer' }}>Criar Conta →</span>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1.15fr .85fr', borderLeft:'1px solid var(--line-2)', borderRight:'1px solid var(--line-2)' }}>
          <div style={{ padding:'64px 44px 56px', borderRight:'1px solid var(--line-2)' }}>
            <div className="mono" style={{ fontSize:11.5, letterSpacing:'.14em', color:'var(--teal)', marginBottom:22 }}>INTERNAL DEVELOPER PLATFORM · AWS&nbsp;EKS</div>
            <h1 style={{ fontSize:48, lineHeight:1.06, fontWeight:700, letterSpacing:'-.03em', margin:0 }}>
              Traduzimos Kubernetes.<br />
              <span style={{ color:'var(--text-3)' }}>Não o escondemos.</span>
            </h1>
            <p style={{ fontSize:16, lineHeight:1.65, color:'var(--text-2)', maxWidth:460, margin:'22px 0 0' }}>
              A DevShip dá aos developers deploys self-service sobre AWS EKS — sem YAML nem kubectl — mantendo nos Cloud Engineers o controlo total da infraestrutura e visibilidade ponta-a-ponta.
            </p>
            <div style={{ display:'flex', gap:11, marginTop:30, flexWrap:'wrap' }}>
              <span onClick={() => nav('/register')} className="btn-primary hover-bright" style={{ fontSize:14, fontWeight:600, padding:'12px 22px', borderRadius:8, cursor:'pointer' }}>Criar Conta →</span>
              <span onClick={() => nav('/login')}    className="btn-secondary"            style={{ fontSize:14, fontWeight:500, padding:'12px 20px', borderRadius:8, cursor:'pointer' }}>Entrar</span>
              <a href="#pipeline"                                                          style={{ fontSize:14, fontWeight:500, color:'var(--text)', border:'1px solid var(--line-2)', padding:'12px 20px', borderRadius:8 }} className="hover-teal">Ver a arquitetura</a>
            </div>
          </div>
          <div style={{ padding:30, display:'flex', flexDirection:'column', justifyContent:'center', background:'var(--panel-2)' }}>
            <div className="mono" style={{ fontSize:10.5, color:'var(--text-3)', letterSpacing:'.1em', marginBottom:14 }}>// LIVE · engineering-team/my-project</div>
            <div style={{ border:'1px solid var(--line-2)', borderRadius:10, background:'var(--panel)', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 13px', borderBottom:'1px solid var(--line)' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)' }}></span>
                <span className="mono" style={{ fontSize:11, color:'var(--text-2)' }}>backend</span>
                <span className="mono" style={{ marginLeft:'auto', fontSize:11, color:'var(--teal)' }}>v1.2.3</span>
              </div>
              <div className="mono" style={{ fontSize:11, color:'var(--text-2)', padding:'6px 0' }}>
                {[['DEV','var(--green)','● Healthy','v1.2.3'],['STAGING','var(--amber)','◐ Deploying','v1.2.3'],['PROD','var(--green)','● Healthy','v1.2.1']].map(([env,c,s,v]) => (
                  <div key={env} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 13px' }}>
                    <span style={{ width:54, color:'var(--text-3)' }}>{env}</span>
                    <span style={{ flex:1, color:c as string }}>{s}</span>
                    <span style={{ color:'var(--text-3)' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop:'1px solid var(--line)', padding:'9px 13px', display:'flex', alignItems:'center', gap:8 }}>
                <span className="mono" style={{ fontSize:10, color:'var(--text-3)' }}>probe</span>
                <span className="mono" style={{ fontSize:10, color:'var(--green)' }}>startup✓</span>
                <span className="mono" style={{ fontSize:10, color:'var(--green)' }}>ready✓</span>
                <span className="mono" style={{ fontSize:10, color:'var(--green)' }}>live✓</span>
              </div>
            </div>
            <div className="mono" style={{ fontSize:10, color:'var(--text-3)', marginTop:12, lineHeight:1.6 }}>fonte: Kubernetes API · leitura em tempo real</div>
          </div>
        </div>
        <div className="mono" style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-3)', border:'1px solid var(--line-2)', borderTop:'none', padding:'8px 16px' }}>
          <span>DEPLOY MAIS RÁPIDO</span><span style={{ color:'var(--text-2)' }}>·</span><span style={{ color:'var(--teal)' }}>MANTÉM O CONTROLO</span>
        </div>
      </header>

      {/* PROBLEMA */}
      <section id="problema" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px' }}>
          <SectionLabel n="01" label="O Problema" />
          <h2 style={{ fontSize:30, fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>Entre o developer e o cluster há demasiada espera</h2>
          <p style={{ fontSize:14.5, color:'var(--text-2)', lineHeight:1.7, maxWidth:600, margin:'16px 0 0' }}>Sem uma plataforma interna, publicar uma aplicação significa pedir, esperar e depender de quem domina a infraestrutura. O Cloud Engineer torna-se um gargalo; o developer perde o controlo do que acontece depois do "deploy".</p>
          <figure style={{ margin:'30px 0 0', border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden', background:'var(--panel)' }}>
            <figcaption className="mono" style={{ display:'flex', alignItems:'center', gap:10, fontSize:10.5, color:'var(--text-3)', padding:'9px 14px', borderBottom:'1px solid var(--line)' }}>
              <span style={{ color:'var(--teal)' }}>FIG.01</span><span>antes_vs_depois.png</span><span style={{ marginLeft:'auto', color:'var(--text-2)' }}>o custo operacional da espera</span>
            </figcaption>
            <img src="/landing-dev.png" alt="A jornada de deploy: sem DevShip vs com DevShip" style={{ width:'100%', display:'block' }} />
          </figure>
        </div>
      </section>

      {/* PIPELINE */}
      <section id="pipeline" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px', background:'var(--panel-2)' }}>
          <SectionLabel n="02" label="Pipeline de Deployment" />
          <h2 style={{ fontSize:30, fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>Um clique. Sete passos rastreáveis.</h2>
          <p style={{ fontSize:14.5, color:'var(--text-2)', lineHeight:1.7, maxWidth:600, margin:'16px 0 30px' }}>Do pedido do developer até pods saudáveis em produção. Cada aresta transporta um artefacto concreto — e cada passo é observável na plataforma.</p>
          <div>
            {pipeline.map(n => (
              <div key={n.idx} style={{ display:'flex', gap:16 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:'none', width:34 }}>
                  <div className="mono" style={{ width:34, height:34, borderRadius:9, border:`1px solid ${n.border}`, background:n.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:n.titleCol }}>{n.idx}</span>
                  </div>
                  {n.hasEdge && <span style={{ width:1, flex:1, minHeight:26, background:'var(--line-2)', margin:'4px 0' }}></span>}
                </div>
                <div style={{ flex:1, paddingBottom: n.hasEdge ? 4 : 0 }}>
                  <div style={{ border:`1px solid ${n.border}`, borderRadius:10, background:n.bg, padding:'13px 16px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                    <span className="mono" style={{ fontSize:9.5, letterSpacing:'.1em', color:'var(--text-3)', width:72, flex:'none' }}>{n.kind}</span>
                    <span style={{ fontSize:14, fontWeight:600, color:n.titleCol, width:140, flex:'none' }}>{n.title}</span>
                    <span style={{ fontSize:12.5, color:'var(--text-2)' }}>{n.note}</span>
                  </div>
                  {n.hasEdge && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0 0 3px' }}>
                      <span style={{ color:'var(--text-3)', fontSize:11 }}>↓</span>
                      <span className="mono" style={{ fontSize:10, color:'var(--text-3)' }}>entrega:</span>
                      <span className="mono" style={{ fontSize:10, color:'var(--teal)' }}>{n.edge}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRADUÇÃO */}
      <section id="traducao" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px' }}>
          <SectionLabel n="03" label="Traduzir, não esconder" />
          <h2 style={{ fontSize:30, fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>A mesma verdade, com menos fricção</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 64px 1fr', alignItems:'center', gap:0, marginTop:30 }}>
            <div style={{ border:'1px solid var(--line-2)', borderRadius:10, background:'var(--panel-2)', overflow:'hidden' }}>
              <div className="mono" style={{ fontSize:10.5, color:'var(--text-3)', padding:'9px 14px', borderBottom:'1px solid var(--line)' }}>deployment.yaml · o que o Kubernetes te pede</div>
              <pre className="mono" style={{ margin:0, padding:'15px 16px', fontSize:11, lineHeight:1.65, color:'#aeb6c6', overflowX:'auto' }}>{`apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: app-prod
spec:
  replicas: 3
  strategy: { type: RollingUpdate }
  template:
    spec:
      containers:
        - name: app
          image: company/backend:v1.2.3
          readinessProbe:
            httpGet: { path: /health/ready }`}</pre>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <img src="/devship-logo.png" alt="" style={{ width:24, height:24, opacity:.9 }} />
                <span style={{ color:'var(--teal)', fontSize:14 }}>▶</span>
              </div>
            </div>
            <div style={{ border:'1px solid var(--teal)', borderRadius:10, background:'rgba(43,199,180,.05)', overflow:'hidden' }}>
              <div className="mono" style={{ fontSize:10.5, color:'var(--teal)', padding:'9px 14px', borderBottom:'1px solid rgba(43,199,180,.25)' }}>backend / PROD · o que a DevShip te mostra</div>
              <div style={{ padding:'15px 16px', display:'flex', flexDirection:'column', gap:11, fontSize:12.5 }}>
                {[['Versão','v1.2.3','var(--teal)'],['Réplicas','3 / 3 prontas',''],['Estratégia','RollingUpdate',''],['Readiness','passing','var(--green)']].map(([k,v,c]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ color:'var(--text-3)' }}>{k}</span>
                    <span className="mono" style={{ color: c || 'inherit' }}>{v}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'var(--text-3)' }}>Estado</span>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, color:'var(--green)' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)' }}></span>Healthy
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop:38, display:'flex', flexDirection:'column', gap:1, border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden' }}>
            {[
              ['Não escondemos Kubernetes.','Traduzimo-lo.','Cada estado mostrado vem diretamente da Kubernetes API — versões, réplicas e probes reais, não uma camada que esconde o que corre no cluster.'],
              ['Não removemos GitOps.','Tornamo-lo observável.','O repositório GitOps continua a ser a fonte de verdade. A DevShip mostra o diff, o commit e o sync do ArgoCD a acontecer — em vez de os esconder atrás de um botão.'],
              ['Não substituímos Cloud Engineers.','Devolvemos-lhes tempo.','Os pedidos repetitivos de deploy deixam de passar por eles. Mantêm IAM, políticas de aprovação e governação do cluster — sem serem o gargalo.'],
            ].map(([t1,t2,body],i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'300px 1fr', background:'var(--panel)', borderBottom: i<2 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ padding:'20px 22px', borderRight:'1px solid var(--line)' }}>
                  <span style={{ fontSize:16, fontWeight:600 }}>{t1}</span><br />
                  <span style={{ fontSize:16, fontWeight:600, color:'var(--teal)' }}>{t2}</span>
                </div>
                <div style={{ padding:'20px 22px', fontSize:13, color:'var(--text-2)', lineHeight:1.65, display:'flex', alignItems:'center' }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ESTADOS */}
      <section id="estados" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px', background:'var(--panel-2)' }}>
          <SectionLabel n="04" label="LifecycleStatus" />
          <h2 style={{ fontSize:30, fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>O estado real de um deployment, como máquina de estados</h2>
          <p style={{ fontSize:14.5, color:'var(--text-2)', lineHeight:1.7, maxWidth:600, margin:'16px 0 32px' }}>
            Cada ApplicationEnvironment percorre estados explícitos. As health probes determinam a transição de <span className="mono" style={{ color:'var(--amber)' }}>Deploying</span> para <span className="mono" style={{ color:'var(--green)' }}>Healthy</span> — ou despoletam um rollback.
          </p>
          <div style={{ overflowX:'auto' }}>
            <div style={{ minWidth:820, display:'flex', alignItems:'center' }}>
              <StateBox label="Pending" sub="estado inicial" color="var(--text-3)" border="var(--border)" bg="var(--panel)" />
              <Arrow label="apply" color="var(--text-3)" />
              <StateBox label="Deploying" sub="a aplicar"  color="var(--amber)" border="rgba(217,154,48,.4)" bg="rgba(217,154,48,.06)" />
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:84 }}>
                <span className="mono" style={{ fontSize:9, color:'var(--green)', marginBottom:4 }}>probes ✓</span>
                <div style={{ display:'flex', alignItems:'center', width:'100%' }}><span style={{ flex:1, height:1, background:'var(--green)', opacity:.5 }}></span><span style={{ color:'var(--green)', fontSize:10 }}>▶</span></div>
                <span className="mono" style={{ fontSize:9, color:'var(--red)', marginTop:6 }}>probes ✗</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <StateBox label="Healthy"     sub="estável"     color="var(--green)" border="rgba(63,191,99,.45)"  bg="rgba(63,191,99,.06)" />
                <StateBox label="Degraded"    sub="a falhar"    color="var(--red)"   border="rgba(229,85,107,.45)" bg="rgba(229,85,107,.06)" />
              </div>
              <Arrow label="rollback" color="var(--blue)" />
              <StateBox label="Rolled Back" sub="versão anterior" color="#8fbcf7" border="rgba(91,157,240,.4)" bg="rgba(91,157,240,.06)" />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:0, marginTop:30, border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden' }}>
            {[
              ['startup probe','Confirma que o container arrancou antes de qualquer tráfego.'],
              ['readiness probe','Decide se o pod recebe pedidos. Falha aqui → Degraded.'],
              ['liveness probe','Reinicia o pod se deixar de responder em runtime.'],
            ].map(([t,d],i) => (
              <div key={t} style={{ padding:'18px 20px', borderRight: i<2 ? '1px solid var(--line)' : 'none' }}>
                <div className="mono" style={{ fontSize:10.5, color:'var(--text-3)', marginBottom:8 }}>{t}</div>
                <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.55 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px' }}>
          <SectionLabel n="05" label="Uma plataforma, duas perspetivas" />
          <h2 style={{ fontSize:30, fontWeight:700, letterSpacing:'-.02em', margin:'0 0 30px', maxWidth:640, lineHeight:1.18 }}>Cada role vê exatamente o que precisa</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden' }}>
            <div style={{ padding:'26px 26px', borderRight:'1px solid var(--line-2)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:18 }}>
                <span className="mono" style={{ fontSize:10, color:'#8fbcf7', border:'1px solid rgba(91,157,240,.35)', borderRadius:5, padding:'2px 8px' }}>DEVELOPER</span>
                <span className="mono" style={{ fontSize:10, color:'var(--text-3)' }}>/ Tech Lead</span>
              </div>
              <h3 style={{ fontSize:18, fontWeight:600, margin:'0 0 14px' }}>Deploy sem aprender Kubernetes</h3>
              {['Deploy e rollback num clique, por environment','Estado, versões e health em tempo real','Logs, eventos e pods da aplicação','Acede a environments só via as suas applications'].map(t => (
                <div key={t} style={{ display:'flex', gap:10, fontSize:13, color:'var(--text-2)', marginBottom:11 }}>
                  <span className="mono" style={{ color:'var(--teal)' }}>+</span> {t}
                </div>
              ))}
            </div>
            <div style={{ padding:'26px 26px', background:'var(--panel-2)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:18 }}>
                <span className="mono" style={{ fontSize:10, color:'var(--teal)', border:'1px solid rgba(43,199,180,.35)', borderRadius:5, padding:'2px 8px' }}>CLOUD ENGINEER</span>
              </div>
              <h3 style={{ fontSize:18, fontWeight:600, margin:'0 0 14px' }}>Controlo total da infraestrutura</h3>
              {['Liga o cluster EKS via IAM role + ExternalId','Configura environments, namespaces e GitOps','Define aprovações e RBAC por environment','Vê todos os environments — mesmo sem applications'].map(t => (
                <div key={t} style={{ display:'flex', gap:10, fontSize:13, color:'var(--text-2)', marginBottom:11 }}>
                  <span className="mono" style={{ color:'var(--teal)' }}>+</span> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ARQUITETURA */}
      <section style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px', background:'var(--panel-2)' }}>
          <SectionLabel n="06" label="Arquitetura completa" />
          <h2 style={{ fontSize:30, fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>A ponte entre quem escreve código e o cluster que o corre</h2>
          <figure style={{ margin:'30px 0 0', border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden', background:'var(--panel)' }}>
            <figcaption className="mono" style={{ display:'flex', alignItems:'center', gap:10, fontSize:10.5, color:'var(--text-3)', padding:'9px 14px', borderBottom:'1px solid var(--line)' }}>
              <span style={{ color:'var(--teal)' }}>FIG.02</span><span>devship_em_acao.png</span><span style={{ marginLeft:'auto', color:'var(--text-2)' }}>abstração sem perda de controlo</span>
            </figcaption>
            <img src="/landing-arch.png" alt="DevShip em ação — arquitetura completa" style={{ width:'100%', display:'block' }} />
          </figure>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px 70px' }}>
        <div style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:30, flexWrap:'wrap' }}>
          <div>
            <h2 style={{ fontSize:26, fontWeight:700, letterSpacing:'-.02em', margin:0, lineHeight:1.2 }}>Pronto para deixar de ser o gargalo?</h2>
            <p className="mono" style={{ fontSize:12, color:'var(--text-3)', margin:'12px 0 0' }}>login como Cloud Engineer · Tech Lead · Developer — a vista adapta-se</p>
          </div>
          <div style={{ display:'flex', gap:11, flexWrap:'wrap' }}>
            <span onClick={() => nav('/register')} className="btn-primary hover-bright" style={{ fontSize:14, fontWeight:600, padding:'13px 24px', borderRadius:8, cursor:'pointer' }}>Criar Conta →</span>
            <span onClick={() => nav('/login')}    className="btn-secondary"            style={{ fontSize:14, fontWeight:500, padding:'13px 22px', borderRadius:8, cursor:'pointer' }}>Entrar</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:'1px solid var(--line-2)', background:'var(--panel-2)' }}>
        <div style={{ maxWidth:1180, margin:'0 auto', padding:'30px 26px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:22, height:22 }} />
          <span style={{ fontSize:14, fontWeight:600 }}>DevShip</span>
          <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>Internal Developer Platform · AWS EKS · GitOps</span>
          <span className="mono" style={{ marginLeft:'auto', fontSize:11, color:'var(--text-3)' }}>© 2026 · deploy mais rápido, mantém o controlo</span>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:16, marginBottom:8 }}>
      <span className="mono" style={{ fontSize:12, color:'var(--teal)', letterSpacing:'.1em' }}>{n}</span>
      <span className="mono" style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'.18em', textTransform:'uppercase' }}>{label}</span>
      <span style={{ flex:1, height:1, background:'var(--line)' }}></span>
    </div>
  );
}

function StateBox({ label, sub, color, border, bg }: { label:string; sub:string; color:string; border:string; bg:string }) {
  return (
    <div style={{ border:`1px solid ${border}`, borderRadius:9, padding:'12px 16px', background:bg }}>
      <span className="mono" style={{ fontSize:9.5, color:'var(--text-3)' }}>{sub}</span>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:5 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:color }}></span>
        <span style={{ fontSize:13, fontWeight:600, color }}>{label}</span>
      </div>
    </div>
  );
}

function Arrow({ label, color }: { label:string; color:string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:60 }}>
      <span className="mono" style={{ fontSize:9, color, marginBottom:4 }}>{label}</span>
      <div style={{ display:'flex', alignItems:'center', width:'100%' }}>
        <span style={{ flex:1, height:1, background:color, opacity:.5 }}></span>
        <span style={{ color, fontSize:10 }}>▶</span>
      </div>
    </div>
  );
}
