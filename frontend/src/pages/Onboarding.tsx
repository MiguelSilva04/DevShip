import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Step = 'intro' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'review' | 'done';
const STEPS: Step[] = ['intro','step1','step2','step3','step4','step5','step6','review','done'];
const STEP_LABELS = ['Criar Team','Criar Project','Preparar AWS / EKS','Configurar Cluster','Configurar Environments','Importar Applications','Revisão'];

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('intro');
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [cArn,    setCArn]    = useState('');
  const [cRegion, setCRegion] = useState('us-east-1');
  const [cIam,    setCIam]    = useState('');
  const [cValid,  setCValid]  = useState<null|'ok'|'err'>(null);
  const [beOpen, setBeOpen] = useState(true);
  const [feOpen, setFeOpen] = useState(false);
  const [whyTrustOpen, setWhyTrustOpen] = useState(false);
  const [whyPermOpen,  setWhyPermOpen]  = useState(false);
  const [whyCliOpen,   setWhyCliOpen]   = useState(false);
  const [envItems, setEnvItems] = useState<{name:string;ns:string;order:number;approval:boolean}[]>([]);
  const [copied, setCopied] = useState<string|null>(null);

  function copyLabel(k:string) { setCopied(k); setTimeout(() => setCopied(null), 1500); }

  const idx = STEPS.indexOf(step);
  const stepNum = idx <= 0 ? 0 : idx;
  const showBar = step !== 'intro' && step !== 'done';
  const showNav = !['intro','done'].includes(step);

  function next() {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i+1]);
  }
  function back() {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i-1]);
  }

  function addEnv(name:string, ns:string, order:number) {
    if (!envItems.find(e => e.name === name)) setEnvItems(prev => [...prev, { name, ns, order, approval: name==='PROD' }]);
  }

  const nextLabel = step === 'step6' ? 'Ir para revisão →' : step === 'review' ? 'Finalizar →' : 'Continuar →';

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      {/* Sticky header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'rgba(15,17,23,.85)', backdropFilter:'blur(14px)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 26px' }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:28, height:28 }} />
          <span style={{ fontSize:15, fontWeight:600 }}>DevShip</span>
          <div style={{ width:1, height:20, background:'var(--border)' }}></div>
          <span style={{ fontSize:13, color:'var(--text-2)' }}>Onboarding</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 11px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(43,199,180,.12)', color:'var(--teal)', border:'1px solid rgba(43,199,180,.3)' }}>Apenas Cloud Engineer</span>
          {showBar && <span className="mono" style={{ marginLeft:'auto', fontSize:11, color:'var(--text-3)' }}>Passo {Math.max(stepNum,1)} de 6</span>}
        </div>
        {showBar && (
          <div style={{ display:'flex', gap:5, padding:'0 26px 12px' }}>
            {Array.from({length:6}).map((_,i) => (
              <span key={i} style={{ flex:1, height:3, borderRadius:3, background: i < stepNum ? 'var(--teal)' : 'var(--border)' }}></span>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth:760, margin:'0 auto', padding:'40px 26px 140px' }}>

        {/* INTRO */}
        {step === 'intro' && (
          <>
            <div style={{ textAlign:'center' }}>
              <img src="/devship-logo.png" alt="DevShip" style={{ width:50, height:50, display:'block', margin:'0 auto 18px' }} />
              <h1 style={{ fontSize:26, fontWeight:600, letterSpacing:'-.02em', margin:0 }}>Vamos configurar o teu projeto</h1>
              <p style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.7, maxWidth:520, margin:'12px auto 0' }}>A DevShip liga-se ao teu cluster AWS EKS e importa as applications a partir do GitOps. Este onboarding é executado pelo <span style={{ color:'var(--text)' }}>Cloud Engineer</span>.</p>
            </div>
            <div style={{ border:'1px solid var(--border)', borderRadius:16, background:'var(--surface)', padding:8, marginTop:28 }}>
              {STEP_LABELS.map((label,i) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderBottom: i < STEP_LABELS.length-1 ? '1px solid var(--border-soft)' : 'none' }}>
                  <span style={{ width:26, height:26, borderRadius:8, background:'var(--surface-2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Geist Mono,monospace', fontSize:12, color:'var(--text-2)', flex:'none' }}>{i+1}</span>
                  <span style={{ fontSize:14, fontWeight:500 }}>{label}</span>
                </div>
              ))}
            </div>
            <button onClick={next} className="btn-primary hover-bright" style={{ width:'100%', fontSize:14.5, padding:14, borderRadius:11, marginTop:24 }}>Começar onboarding →</button>
          </>
        )}

        {/* STEP 1 — Team */}
        {step === 'step1' && (
          <>
            <StepLabel n={1} label="Criar Team" sub="Uma Team agrupa pessoas e projetos." />
            <FormCard>
              <FormField label="Nome *"><input className="input-base input-mono" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="engineering-team" /></FormField>
              <FormField label="Descrição (opcional)"><textarea className="input-base" value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="Equipa de engenharia da plataforma" rows={3} /></FormField>
            </FormCard>
          </>
        )}

        {/* STEP 2 — Project */}
        {step === 'step2' && (
          <>
            <StepLabel n={2} label="Criar Project" sub="Um Project liga-se a um cluster e contém as applications." />
            <FormCard>
              <FormField label="Nome *"><input className="input-base input-mono" value={projName} onChange={e => setProjName(e.target.value)} placeholder="my-project" /></FormField>
              <FormField label="Descrição (opcional)"><textarea className="input-base" value={projDesc} onChange={e => setProjDesc(e.target.value)} placeholder="Aplicação principal" rows={3} /></FormField>
            </FormCard>
          </>
        )}

        {/* STEP 3 — AWS */}
        {step === 'step3' && (
          <>
            <StepLabel n={3} label="Preparar AWS / EKS" sub="Cria uma IAM role para a DevShip assumir em read-only." />
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* ExternalId */}
              <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 22px' }}>
                <div style={{ fontSize:13.5, fontWeight:600, marginBottom:13 }}>1 · ExternalId</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:9, padding:'9px 9px 9px 14px' }}>
                  <code className="mono" style={{ fontSize:13, color:'var(--teal)', flex:1 }}>ext-7f3a9c2b-4e1d-devship</code>
                  <button onClick={() => copyLabel('ext')} className="btn-secondary" style={{ fontSize:11.5, padding:'6px 12px', borderRadius:7 }}>{copied==='ext' ? 'Copiado ✓' : 'Copiar'}</button>
                </div>
              </div>

              {/* Trust Policy */}
              <CodeBlock
                title="2 · Trust Policy"
                desc="Permite à DevShip assumir a role com o ExternalId acima."
                filename="trust-policy.json"
                code={`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::306667525254:root" },
    "Action": "sts:AssumeRole",
    "Condition": {
      "StringEquals": { "sts:ExternalId": "ext-7f3a9c2b-4e1d-devship" }
    }
  }]
}`}
                copyKey="trust" copied={copied} onCopy={copyLabel}
                whyOpen={whyTrustOpen} onWhy={() => setWhyTrustOpen(v=>!v)}
                whyTitle="Trust Policy — o quê e porquê"
                whyBody="A Trust Policy define quem tem permissão para assumir esta IAM Role. O ExternalId é uma camada adicional de segurança que protege contra o ataque confused deputy."
              />

              {/* Permission Policy */}
              <CodeBlock
                title="3 · Permission Policy"
                desc="Permissões mínimas de leitura sobre o cluster EKS."
                filename="permission-policy.json"
                code={`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["eks:ListClusters","eks:DescribeCluster","ecr:DescribeRepositories","ecr:ListImages"],
    "Resource": "*"
  }]
}`}
                copyKey="perm" copied={copied} onCopy={copyLabel}
                whyOpen={whyPermOpen} onWhy={() => setWhyPermOpen(v=>!v)}
                whyTitle="Permission Policy — o quê e porquê"
                whyBody="Define o que a DevShip pode fazer depois de assumir a role. As permissões são exclusivamente de leitura — a DevShip nunca escreve nem altera recursos na tua conta AWS."
              />

              {/* EKS Access Entry */}
              <CodeBlock
                title="4 · EKS Access Entry"
                desc="Dá à role acesso de leitura dentro do cluster ao nível da Kubernetes API."
                filename="eks-access.sh"
                code={`aws eks create-access-entry \\
  --cluster-name NOME_DO_SEU_CLUSTER \\
  --principal-arn arn:aws:iam::306667525254:role/AccessPlatformDevShip \\
  --type STANDARD

aws eks associate-access-policy \\
  --cluster-name NOME_DO_SEU_CLUSTER \\
  --principal-arn arn:aws:iam::306667525254:role/AccessPlatformDevShip \\
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSViewPolicy \\
  --access-scope type=cluster`}
                copyKey="cli" copied={copied} onCopy={copyLabel}
                whyOpen={whyCliOpen} onWhy={() => setWhyCliOpen(v=>!v)}
                whyTitle="EKS Access Entry — o quê e porquê"
                whyBody="A Trust Policy e a Permission Policy dão à DevShip acesso à AWS API — mas o cluster Kubernetes tem o seu próprio sistema de autorização. O EKS Access Entry regista a IAM Role diretamente no cluster."
              />
            </div>
          </>
        )}

        {/* STEP 4 — Cluster */}
        {step === 'step4' && (
          <>
            <StepLabel n={4} label="Configurar Cluster" sub="Indica os dados da role e valida a ligação." />
            <FormCard>
              <FormField label="Cluster ARN *"><input className="input-base input-mono" value={cArn} onChange={e => setCArn(e.target.value)} placeholder="arn:aws:eks:us-east-1:123456789012:cluster/prod-cluster" /></FormField>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:17 }}>
                <FormField label="Region"><input className="input-base input-mono" value={cRegion} onChange={e => setCRegion(e.target.value)} /></FormField>
                <FormField label="IAM Role ARN *"><input className="input-base input-mono" value={cIam} onChange={e => setCIam(e.target.value)} placeholder="arn:aws:iam::…:role/DevShipAccess" /></FormField>
              </div>
              <div>
                <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:8 }}>ExternalId</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:9, padding:'9px 9px 9px 14px' }}>
                  <code className="mono" style={{ fontSize:13, color:'var(--teal)', flex:1 }}>ext-7f3a9c2b-4e1d-devship</code>
                  <button onClick={() => copyLabel('ext4')} className="btn-secondary" style={{ fontSize:11.5, padding:'6px 12px', borderRadius:7 }}>{copied==='ext4' ? 'Copiado ✓' : 'Copiar'}</button>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:13, marginTop:18 }}>
                <button onClick={() => setCValid('ok')} className="btn-secondary" style={{ fontSize:13, padding:'10px 18px', borderRadius:9 }}>Validar ligação</button>
                <span style={{ fontSize:12, color:'var(--text-3)' }}>Preenche os ARNs e valida.</span>
              </div>
              {cValid === 'ok' && (
                <div style={{ display:'flex', gap:12, border:'1px solid rgba(52,199,89,.3)', background:'rgba(52,199,89,.08)', borderRadius:12, padding:'15px 17px', marginTop:16 }}>
                  <span style={{ color:'#5dd57b', fontSize:15 }}>✓</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#7ee094' }}>Cluster ligado com sucesso</div>
                    <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:3 }}>A DevShip conseguiu assumir a role e descrever o cluster.</div>
                  </div>
                </div>
              )}
            </FormCard>
          </>
        )}

        {/* STEP 5 — Environments */}
        {step === 'step5' && (
          <>
            <StepLabel n={5} label="Configurar Environments" sub="Adiciona os ambientes do projeto." />
            <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:20 }}>
              {['DEV','STAGING','PROD'].map((name,i) => (
                <button key={name} onClick={() => addEnv(name, name==='DEV'?'app-dev':name==='STAGING'?'app-staging':'app-prod', i+1)}
                  style={{ border:'1px dashed var(--border)', background:'transparent', color:'var(--text-2)', fontFamily:'Geist Mono,monospace', fontSize:12, padding:'7px 14px', borderRadius:8, cursor:'pointer' }}
                  className="hover-teal">+ {name}</button>
              ))}
            </div>
            {envItems.length === 0 && (
              <div style={{ border:'1px dashed var(--border)', borderRadius:14, padding:34, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>Ainda sem environments. Adiciona um a partir das sugestões acima.</div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {envItems.map(env => (
                <div key={env.name} style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 22px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                    <span className="mono" style={{ fontSize:12, fontWeight:500, padding:'4px 11px', borderRadius:7, background:'rgba(43,199,180,.1)', color:'var(--teal)', border:'1px solid rgba(43,199,180,.28)' }}>{env.name}</span>
                    <button onClick={() => setEnvItems(prev => prev.filter(e => e.name !== env.name))} style={{ marginLeft:'auto', border:'none', background:'transparent', color:'var(--text-3)', fontSize:12, cursor:'pointer' }} className="hover-teal">Remover</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:15 }}>
                    <FormField label="Namespace *"><input className="input-base input-mono" defaultValue={env.ns} placeholder="app-dev" /></FormField>
                    <FormField label="GitOps Base Path"><input className="input-base input-mono" defaultValue={`apps/${env.name.toLowerCase()}`} placeholder="apps/dev" /></FormField>
                    <FormField label="Source Branch"><input className="input-base input-mono" defaultValue="main" placeholder="main" /></FormField>
                    <FormField label="Deployment Order"><input className="input-base input-mono" type="number" defaultValue={env.order} style={{ maxWidth:80 }} /></FormField>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:24, marginTop:16, flexWrap:'wrap' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ width:19, height:19, borderRadius:6, border:`1.5px solid ${env.approval ? 'var(--teal)' : 'var(--border)'}`, background: env.approval ? 'var(--teal)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {env.approval && <span style={{ color:'var(--teal-ink)', fontSize:11 }}>✓</span>}
                      </span>
                      <span style={{ fontSize:13 }}>Requires Approval</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* STEP 6 — Import Apps */}
        {step === 'step6' && (
          <>
            <StepLabel n={6} label="Importar Applications" sub="" />
            <div style={{ display:'flex', gap:12, border:'1px solid rgba(77,156,246,.28)', background:'rgba(77,156,246,.08)', borderRadius:12, padding:'14px 16px', margin:'18px 0 20px' }}>
              <span style={{ color:'#7fb6f9' }}>ⓘ</span>
              <span style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.55 }}>A DevShip percorreu o repositório GitOps e encontrou os manifestos com <code className="mono" style={{ color:'var(--teal)' }}>kind: Deployment</code>.</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <ImportApp name="backend" path="apps/backend/deployment.yaml" open={beOpen} onToggle={() => setBeOpen(v=>!v)} replicas={3} />
              <ImportApp name="frontend" path="apps/frontend/deployment.yaml" open={feOpen} onToggle={() => setFeOpen(v=>!v)} replicas={2} />
            </div>
          </>
        )}

        {/* REVIEW */}
        {step === 'review' && (
          <>
            <h1 style={{ fontSize:23, fontWeight:600, margin:'0 0 6px' }}>Revisão de Applications</h1>
            <p style={{ fontSize:13.5, color:'var(--text-2)', margin:'0 0 24px' }}>Confirma o que vai ser importado.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                { name:'backend',  replicas:3, envs:['DEV · Encontrado','STAGING · Encontrado','PROD · Não configurado'], found:[true,true,false] },
                { name:'frontend', replicas:2, envs:['DEV · Encontrado','STAGING · Não configurado','PROD · Não configurado'], found:[true,false,false] },
              ].map(app => (
                <div key={app.name} style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 22px' }}>
                  <div style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>{app.name}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'13px 22px', fontSize:12.5 }}>
                    {[['Deployment Name',app.name],['Replicas',String(app.replicas)],['Strategy','RollingUpdate'],['Manifest Path',`apps/${app.name}/deployment.yaml`]].map(([k,v]) => (
                      <div key={k}><span style={{ color:'var(--text-3)' }}>{k}</span><div className="mono" style={{ marginTop:3 }}>{v}</div></div>
                    ))}
                  </div>
                  <div style={{ borderTop:'1px solid var(--border-soft)', marginTop:16, paddingTop:14 }}>
                    <div style={{ fontSize:11.5, color:'var(--text-3)', marginBottom:9 }}>Environments encontrados</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {app.envs.map((e,i) => (
                        <span key={e} className="mono" style={{ display:'inline-flex', padding:'4px 10px', borderRadius:7, fontSize:11.5, background: app.found[i] ? 'rgba(52,199,89,.12)' : 'transparent', color: app.found[i] ? '#5dd57b' : 'var(--text-3)', border: app.found[i] ? '1px solid rgba(52,199,89,.24)' : '1px dashed var(--border)' }}>{e}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* DONE */}
        {step === 'done' && (
          <>
            <div style={{ textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(52,199,89,.14)', border:'1.5px solid rgba(52,199,89,.4)', display:'flex', alignItems:'center', justifyContent:'center', margin:'14px auto 20px' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 7" stroke="#5dd57b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h1 style={{ fontSize:27, fontWeight:600, letterSpacing:'-.02em', margin:0 }}>Tudo pronto</h1>
              <p style={{ fontSize:13.5, color:'var(--text-2)', margin:'10px auto 0', maxWidth:440 }}>O teu projeto está configurado e as applications foram importadas.</p>
            </div>
            <div style={{ border:'1px solid var(--border)', borderRadius:16, background:'var(--surface)', marginTop:28, overflow:'hidden' }}>
              {[['Team',teamName||'engineering-team'],['Project',projName||'my-project'],['Cluster','prod-cluster'],['Applications','backend · DEV / STAGING\nfrontend · DEV']].map(([k,v]) => (
                <div key={k} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'16px 20px', borderBottom:'1px solid var(--border-soft)' }}>
                  <span style={{ fontSize:12, color:'var(--text-3)', width:120, flex:'none' }}>{k}</span>
                  <span className="mono" style={{ fontSize:13, whiteSpace:'pre-line' }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={() => nav('/app/home')} className="btn-primary hover-bright" style={{ width:'100%', fontSize:14.5, padding:14, borderRadius:11, marginTop:24 }}>Ir para a homepage →</button>
          </>
        )}

        {/* Navigation */}
        {showNav && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, marginTop:30 }}>
            <button onClick={back} className="btn-secondary" style={{ fontSize:13.5, padding:'12px 22px', borderRadius:10 }}>← Voltar</button>
            <button onClick={step === 'review' ? () => setStep('done') : next} className="btn-primary hover-bright" style={{ fontSize:13.5, padding:'12px 24px', borderRadius:10 }}>{nextLabel}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepLabel({ n, label, sub }: { n:number; label:string; sub:string }) {
  return (
    <>
      <div className="mono" style={{ fontSize:11, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--teal)' }}>Passo {n} de 6</div>
      <h1 style={{ fontSize:23, fontWeight:600, margin:'8px 0 6px' }}>{label}</h1>
      {sub && <p style={{ fontSize:13.5, color:'var(--text-2)', margin:'0 0 26px' }}>{sub}</p>}
    </>
  );
}

function FormCard({ children }: { children: React.ReactNode }) {
  return <div style={{ border:'1px solid var(--border)', borderRadius:16, background:'var(--surface)', padding:24 }}>{children}</div>;
}

function FormField({ label, children }: { label:string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:17 }}>
      <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:8 }}>{label}</div>
      {children}
    </div>
  );
}

function CodeBlock({ title, desc, filename, code, copyKey, copied, onCopy, whyOpen, onWhy, whyTitle, whyBody }: {
  title:string; desc:string; filename:string; code:string; copyKey:string; copied:string|null; onCopy:(k:string)=>void;
  whyOpen:boolean; onWhy:()=>void; whyTitle:string; whyBody:string;
}) {
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 22px' }}>
      <div style={{ fontSize:13.5, fontWeight:600, marginBottom:8 }}>{title}</div>
      <p style={{ fontSize:12.5, color:'var(--text-2)', margin:'0 0 13px', lineHeight:1.55 }}>{desc}</p>
      <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', background:'var(--bg-2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 13px', borderBottom:'1px solid var(--border)' }}>
          <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{filename}</span>
          <button onClick={() => onCopy(copyKey)} className="btn-secondary" style={{ fontSize:11, padding:'5px 11px', borderRadius:7 }}>{copied===copyKey ? 'Copiado ✓' : 'Copiar'}</button>
        </div>
        <pre className="mono" style={{ margin:0, padding:'14px 16px', fontSize:11.5, lineHeight:1.6, color:'#c4cad6', overflowX:'auto' }}>{code}</pre>
      </div>
      <button onClick={onWhy} style={{ display:'flex', alignItems:'center', gap:6, background:'transparent', border:'none', cursor:'pointer', padding:'10px 0 0', color:'var(--teal)', fontSize:12 }}>
        {whyOpen ? '▼' : '▶'} Porque é que preciso de criar isto?
      </button>
      {whyOpen && (
        <div style={{ marginTop:10, border:'1px solid rgba(43,199,180,.2)', background:'rgba(43,199,180,.05)', borderRadius:10, padding:'14px 16px' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--teal)', marginBottom:8 }}>{whyTitle}</div>
          <div style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.65 }}>{whyBody}</div>
        </div>
      )}
    </div>
  );
}

function ImportApp({ name, path, open, onToggle, replicas }: { name:string; path:string; open:boolean; onToggle:()=>void; replicas:number }) {
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden' }}>
      <button onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:13, width:'100%', background:'transparent', border:'none', cursor:'pointer', padding:'17px 20px', textAlign:'left', color:'var(--text)' }}>
        <span style={{ color:'var(--text-3)', fontSize:12, width:12 }}>{open ? '▼' : '▶'}</span>
        <span style={{ fontSize:14.5, fontWeight:600 }}>{name}</span>
        <span className="mono" style={{ fontSize:11.5, color:'var(--text-3)' }}>{path}</span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'#5dd57b' }}>✓ encontrado</span>
      </button>
      {open && (
        <div style={{ borderTop:'1px solid var(--border-soft)', padding:'16px 20px' }}>
          <pre className="mono" style={{ margin:'0 0 14px', fontSize:11.5, lineHeight:1.55, color:'#c4cad6', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:9, padding:'13px 15px', overflowX:'auto' }}>{`apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
spec:
  replicas: ${replicas}
  strategy:
    type: RollingUpdate`}</pre>
          <div style={{ display:'flex', gap:9 }}>
            <button className="btn-secondary" style={{ fontSize:12, padding:'7px 14px', borderRadius:8 }}>Ver manifesto</button>
            <button className="btn-ghost" style={{ fontSize:12, padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)' }}>Editar</button>
          </div>
        </div>
      )}
    </div>
  );
}
