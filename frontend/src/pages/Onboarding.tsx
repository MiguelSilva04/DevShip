import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../api/client';

// ─── Shared storage keys ────────────────────────────────────────────────────
export const OB_TEAM_ID    = 'ob_team_id';
export const OB_PROJECT_ID = 'ob_project_id';
export const OB_TEAM_NAME  = 'ob_team_name';
export const OB_PROJ_NAME  = 'ob_proj_name';

// ─── Progress bar ───────────────────────────────────────────────────────────
const STEP_PATHS = [
  '/onboarding/team',
  '/onboarding/project',
  '/onboarding/aws-setup',
  '/onboarding/cluster',
  '/onboarding/environments',
  '/onboarding/applications',
];

function stepIndex(pathname: string) {
  return STEP_PATHS.findIndex(p => pathname.startsWith(p));
}

export default function OnboardingLayout() {
  const loc = useLocation();
  const idx = stepIndex(loc.pathname);
  const showBar = idx >= 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(15,17,23,.85)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 26px' }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>DevShip</span>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Onboarding</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'rgba(43,199,180,.12)', color: 'var(--teal)', border: '1px solid rgba(43,199,180,.3)' }}>Apenas Cloud Engineer</span>
          {showBar && <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>Passo {idx + 1} de 6</span>}
        </div>
        {showBar && (
          <div style={{ display: 'flex', gap: 5, padding: '0 26px 12px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: i <= idx ? 'var(--teal)' : 'var(--border)' }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 26px 140px' }}>
        <Outlet />
      </div>
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

export function StepLabel({ n, label, sub }: { n: number; label: string; sub?: string }) {
  return (
    <>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--teal)' }}>Passo {n} de 6</div>
      <h1 style={{ fontSize: 23, fontWeight: 600, margin: '8px 0 6px' }}>{label}</h1>
      {sub && <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '0 0 26px' }}>{sub}</p>}
    </>
  );
}

export function FormCard({ children }: { children: React.ReactNode }) {
  return <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 24 }}>{children}</div>;
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 17 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

export function NavRow({ onBack, onNext, nextLabel = 'Continuar →', nextDisabled = false, loading = false }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; loading?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 30 }}>
      {onBack
        ? <button onClick={onBack} className="btn-secondary" style={{ fontSize: 13.5, padding: '12px 22px', borderRadius: 10 }}>← Voltar</button>
        : <span />}
      <button onClick={onNext} disabled={nextDisabled || loading} className="btn-primary hover-bright" style={{ fontSize: 13.5, padding: '12px 24px', borderRadius: 10, opacity: (nextDisabled || loading) ? .6 : 1 }}>
        {loading ? 'A processar…' : nextLabel}
      </button>
    </div>
  );
}

export function ErrBanner({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{ display: 'flex', gap: 9, border: '1px solid rgba(241,85,108,.3)', background: 'rgba(241,85,108,.08)', borderRadius: 9, padding: '10px 13px', marginTop: 14 }}>
      <span style={{ color: '#ff8497' }}>✕</span>
      <span style={{ fontSize: 12, color: '#ff9aaa' }}>{msg}</span>
    </div>
  );
}

// ─── Validation result badge ────────────────────────────────────────────────
function ValBadge({ status, error }: { status: string; error?: string | null }) {
  const ok = status === 'VALID';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: ok ? '#5dd57b' : '#ff9aaa' }}>
      {ok ? '✓ válido' : `✕ ${error ?? 'inválido'}`}
    </span>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────────────
function CopyBtn({ text, copyKey, copied, onCopy }: { text: string; copyKey: string; copied: string | null; onCopy: (k: string, t: string) => void }) {
  return (
    <button onClick={() => onCopy(copyKey, text)} className="btn-secondary" style={{ fontSize: 11.5, padding: '6px 12px', borderRadius: 7, flex: 'none' }}>
      {copied === copyKey ? 'Copiado ✓' : 'Copiar'}
    </button>
  );
}

// ─── CodeBlock ───────────────────────────────────────────────────────────────
function CodeBlock({ title, desc, filename, code, copyKey, copied, onCopy, why }: {
  title: string; desc?: string; filename: string; code: string;
  copyKey: string; copied: string | null; onCopy: (k: string, t: string) => void;
  why?: { title: string; body: string };
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px' }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {desc && <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 13px', lineHeight: 1.55 }}>{desc}</p>}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 13px', borderBottom: '1px solid var(--border)' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{filename}</span>
          <CopyBtn text={code} copyKey={copyKey} copied={copied} onCopy={onCopy} />
        </div>
        <pre className="mono" style={{ margin: 0, padding: '14px 16px', fontSize: 11.5, lineHeight: 1.6, color: '#c4cad6', overflowX: 'auto' }}>{code}</pre>
      </div>
      {why && (
        <>
          <button onClick={() => setWhyOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 0', color: 'var(--teal)', fontSize: 12 }}>
            {whyOpen ? '▼' : '▶'} Porque é que preciso de criar isto?
          </button>
          {whyOpen && (
            <div style={{ marginTop: 10, border: '1px solid rgba(43,199,180,.2)', background: 'rgba(43,199,180,.05)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', marginBottom: 8 }}>{why.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65 }}>{why.body}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTRO
// ═══════════════════════════════════════════════════════════════════════════════
const STEP_LABELS = ['Criar Team', 'Criar Project', 'Preparar AWS / EKS', 'Configurar Cluster', 'Configurar Environments', 'Importar Applications'];

export function OnboardingIntro() {
  const nav = useNavigate();
  return (
    <>
      <div style={{ textAlign: 'center' }}>
        <img src="/devship-logo.png" alt="DevShip" style={{ width: 50, height: 50, display: 'block', margin: '0 auto 18px' }} />
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', margin: 0 }}>Vamos configurar o teu projeto</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 520, margin: '12px auto 0' }}>
          A DevShip liga-se ao teu cluster AWS EKS e importa as applications a partir do GitOps. Este onboarding é executado pelo <span style={{ color: 'var(--text)' }}>Cloud Engineer</span>.
        </p>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 8, marginTop: 28 }}>
        {STEP_LABELS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i < STEP_LABELS.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Geist Mono,monospace', fontSize: 12, color: 'var(--text-2)', flex: 'none' }}>{i + 1}</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
      <button onClick={() => nav('/onboarding/team')} className="btn-primary hover-bright" style={{ width: '100%', fontSize: 14.5, padding: 14, borderRadius: 11, marginTop: 24 }}>
        Começar onboarding →
      </button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 1 — Team
// ═══════════════════════════════════════════════════════════════════════════════
export function OnboardingTeam() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill if team was already created (idempotency on back-navigation)
  useEffect(() => {
    const teamId = localStorage.getItem(OB_TEAM_ID);
    const teamName = localStorage.getItem(OB_TEAM_NAME);
    if (teamId && teamName) setName(teamName);
  }, []);

  async function submit() {
    if (!name.trim()) { setErr('O nome da equipa é obrigatório.'); return; }
    // If team already exists in localStorage, skip creation and advance
    const existingId = localStorage.getItem(OB_TEAM_ID);
    if (existingId) { nav('/onboarding/project'); return; }
    setLoading(true); setErr('');
    try {
      const team = await apiFetch('/teams', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: desc || undefined }) });
      localStorage.setItem(OB_TEAM_ID, team.id);
      localStorage.setItem(OB_TEAM_NAME, team.name);
      nav('/onboarding/project');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar equipa.');
    } finally { setLoading(false); }
  }

  return (
    <>
      <StepLabel n={1} label="Criar Team" sub="Uma Team agrupa pessoas e projetos do mesmo domínio de email. Serás o Cloud Engineer desta equipa." />
      <FormCard>
        <FormField label="Nome da equipa *">
          <input className="input-base input-mono" value={name} onChange={e => setName(e.target.value)} placeholder="engineering-team" />
        </FormField>
        <FormField label="Descrição (opcional)">
          <textarea className="input-base" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Equipa de engenharia da plataforma" rows={3} />
        </FormField>
        <ErrBanner msg={err} />
      </FormCard>
      <NavRow onNext={submit} loading={loading} nextDisabled={!name.trim()} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 2 — Project
// ═══════════════════════════════════════════════════════════════════════════════
export function OnboardingProject() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [gitops, setGitops] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const teamId = localStorage.getItem(OB_TEAM_ID);

  // Pre-fill if project was already created (idempotency on back-navigation)
  useEffect(() => {
    const projectId = localStorage.getItem(OB_PROJECT_ID);
    if (!projectId) return;
    apiFetch(`/projects/${projectId}`)
      .then((p: { name: string; git_ops_repository_url?: string }) => {
        setName(p.name);
        if (p.git_ops_repository_url) setGitops(p.git_ops_repository_url);
      })
      .catch(() => { /* project not found, ignore */ });
  }, []);

  async function submit() {
    if (!name.trim()) { setErr('O nome do projeto é obrigatório.'); return; }
    if (!teamId) { setErr('Team não encontrada — volta ao passo 1.'); return; }
    setLoading(true); setErr('');
    try {
      const project = await apiFetch(`/teams/${teamId}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: desc || undefined, git_ops_repository_url: gitops || undefined }),
      });
      localStorage.setItem(OB_PROJECT_ID, project.id);
      localStorage.setItem(OB_PROJ_NAME, project.name);
      nav('/onboarding/aws-setup');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('já tem um projeto')) {
        // Project already exists — just advance
        nav('/onboarding/aws-setup');
        return;
      }
      setErr(msg || 'Erro ao criar projeto.');
    } finally { setLoading(false); }
  }

  return (
    <>
      <StepLabel n={2} label="Criar Project" sub="Um Project liga-se a um cluster e contém as applications." />
      <FormCard>
        <FormField label="Nome *">
          <input className="input-base input-mono" value={name} onChange={e => setName(e.target.value)} placeholder="my-project" />
        </FormField>
        <FormField label="Descrição (opcional)">
          <textarea className="input-base" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Aplicação principal" rows={3} />
        </FormField>
        <FormField label="GitOps Repository URL">
          <input className="input-base input-mono" value={gitops} onChange={e => setGitops(e.target.value)} placeholder="https://github.com/company/gitops-config" />
        </FormField>
        <ErrBanner msg={err} />
      </FormCard>
      <NavRow onBack={() => nav('/onboarding/team')} onNext={submit} loading={loading} nextDisabled={!name.trim()} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 3 — AWS Setup
// ═══════════════════════════════════════════════════════════════════════════════
interface ClusterSetupInfo {
  devship_account_id: string;
  external_id: string;
  trust_policy: Record<string, unknown>;
  permission_policy: Record<string, unknown>;
  access_entry_commands: string[];
}

export function OnboardingAwsSetup() {
  const nav = useNavigate();
  const [info, setInfo] = useState<ClusterSetupInfo | null>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const projectId = localStorage.getItem(OB_PROJECT_ID);

  useEffect(() => {
    if (!projectId) { setErr('Projeto não encontrado — volta ao passo 2.'); return; }
    apiFetch(`/projects/${projectId}/cluster-setup-info`)
      .then(setInfo)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Erro ao carregar dados.'));
  }, [projectId]);

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const trustJson        = info ? JSON.stringify(info.trust_policy, null, 2) : '';
  const permissionJson   = info ? JSON.stringify(info.permission_policy, null, 2) : '';
  const cliCode          = info ? info.access_entry_commands.join('\n\n') : '';

  return (
    <>
      <StepLabel n={3} label="Preparar AWS / EKS" sub="Cria uma IAM Role para a DevShip aceder ao cluster e configura as permissões necessárias." />
      <ErrBanner msg={err} />
      {!info && !err && <div style={{ color: 'var(--text-3)', fontSize: 13 }}>A carregar…</div>}
      {info && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Passo 1 — Criar a IAM Role */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>1 · Criar a IAM Role</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Na consola AWS, vai a <strong>IAM → Roles → Create role</strong>. Escolhe <em>Custom trust policy</em> como tipo de entidade confiável — não seleciones nenhum serviço AWS.
            </p>
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '10px 14px', borderRadius: 9, background: 'var(--bg-2)', border: '1px solid var(--border-soft)', lineHeight: 1.6 }}>
              Dá um nome reconhecível à role, por exemplo <code className="mono">DevShipAccess</code>. Vai precisar do ARN desta role no passo 4.
            </div>
          </div>

          {/* Passo 2 — ExternalId */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 13 }}>2 · ExternalId</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Este ID é único para o teu projeto. Vai ser necessário na Trust Policy abaixo.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 9px 9px 14px' }}>
              <code className="mono" style={{ fontSize: 13, color: 'var(--teal)', flex: 1 }}>{info.external_id}</code>
              <CopyBtn text={info.external_id} copyKey="ext" copied={copied} onCopy={copy} />
            </div>
          </div>

          {/* Passo 3 — Trust Policy */}
          <CodeBlock
            title="3 · Trust Policy"
            desc={`Cola este JSON na Trust Policy da role. A conta AWS da DevShip é ${info.devship_account_id}.`}
            filename="trust-policy.json"
            code={trustJson}
            copyKey="trust" copied={copied} onCopy={copy}
            why={{ title: 'Trust Policy — o quê e porquê', body: 'Define quem pode assumir esta IAM Role. O ExternalId protege contra o ataque confused deputy — só a DevShip, com o ID correto, consegue assumir a role.' }}
          />

          {/* Passo 4 — Permission Policy */}
          <CodeBlock
            title="4 · Permission Policy"
            desc="Na aba Permissions da role, cria uma política inline com este JSON. Dá apenas as permissões mínimas que a DevShip precisa."
            filename="devship-permission-policy.json"
            code={permissionJson}
            copyKey="perm" copied={copied} onCopy={copy}
            why={{ title: 'Permission Policy — o quê e porquê', body: 'A Trust Policy define quem pode assumir a role. A Permission Policy define o que essa role pode fazer. A DevShip só precisa de descrever clusters EKS — nada mais.' }}
          />

          {/* Passo 5 — EKS Access Entry */}
          <CodeBlock
            title="5 · EKS Access Entry"
            desc="Corre estes comandos AWS CLI para registar a role no cluster. Substitui CLUSTER_NAME, ROLE_ARN e REGION pelos valores reais."
            filename="eks-access.sh"
            code={cliCode}
            copyKey="cli" copied={copied} onCopy={copy}
            why={{ title: 'EKS Access Entry — o quê e porquê', body: 'A Trust Policy dá acesso à AWS API — mas o cluster Kubernetes tem autorização própria. O EKS Access Entry regista a IAM Role diretamente no cluster com permissões de leitura (AmazonEKSViewPolicy).' }}
          />
        </div>
      )}
      <NavRow onBack={() => nav('/onboarding/project')} onNext={() => nav('/onboarding/cluster')} nextDisabled={!info} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 4 — Cluster
// ═══════════════════════════════════════════════════════════════════════════════
export function OnboardingCluster() {
  const nav = useNavigate();
  const [arn, setArn] = useState('');
  const [iam, setIam] = useState('');
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [extId, setExtId] = useState('');

  const projectId = localStorage.getItem(OB_PROJECT_ID);

  useEffect(() => {
    if (!projectId) return;
    // Load ExternalId for display
    apiFetch(`/projects/${projectId}/cluster-setup-info`)
      .then((d: ClusterSetupInfo) => setExtId(d.external_id))
      .catch(() => {});
    // Check if cluster already configured (idempotency — e.g. after refresh)
    apiFetch(`/projects/${projectId}/cluster`)
      .then((d: { cluster_name: string; region: string }) => {
        // Cluster exists — mark success so user can proceed; ARNs not returned by GET but not needed again
        setSuccess(true);
        setErr('');
        // Show a hint about which cluster is configured
        setExtId(prev => prev); // keep extId
        setArn(`(cluster configurado: ${d.cluster_name} · ${d.region})`);
      })
      .catch(() => {}); // 404 = not configured yet, normal state
  }, [projectId]);

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function validate() {
    if (!arn.trim() || !iam.trim()) { setErr('Preenche o Cluster ARN e o IAM Role ARN.'); return; }
    if (!projectId) { setErr('Projeto não encontrado — volta ao passo 2.'); return; }
    setLoading(true); setErr(''); setSuccess(false);
    try {
      await apiFetch(`/projects/${projectId}/cluster`, {
        method: 'POST',
        body: JSON.stringify({ cluster_arn: arn.trim(), iam_role_arn: iam.trim() }),
      });
      setSuccess(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      // 409 means already configured — treat as success so user can proceed
      if (msg.includes('já está configurado') || msg.includes('409')) {
        setSuccess(true);
        setErr('');
      } else {
        setErr(msg || 'Erro ao validar cluster.');
      }
    } finally { setLoading(false); }
  }

  return (
    <>
      <StepLabel n={4} label="Configurar Cluster" sub="Indica os ARNs e valida a ligação ao cluster." />
      <FormCard>
        <FormField label="Cluster ARN *">
          <input className="input-base input-mono" value={arn} onChange={e => setArn(e.target.value)} placeholder="arn:aws:eks:us-east-1:123456789012:cluster/prod-cluster" />
        </FormField>
        <FormField label="IAM Role ARN *">
          <input className="input-base input-mono" value={iam} onChange={e => setIam(e.target.value)} placeholder="arn:aws:iam::123456789012:role/DevShipAccess" />
        </FormField>
        {extId && (
          <div style={{ marginBottom: 17 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 8 }}>ExternalId <span style={{ color: 'var(--text-3)' }}>(gerado automaticamente)</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 9px 9px 14px' }}>
              <code className="mono" style={{ fontSize: 13, color: 'var(--teal)', flex: 1 }}>{extId}</code>
              <CopyBtn text={extId} copyKey="ext4" copied={copied} onCopy={copy} />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginTop: 6 }}>
          <button onClick={validate} disabled={loading || success} className="btn-secondary" style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, opacity: success ? .5 : 1 }}>
            {loading ? 'A validar…' : success ? 'Ligação validada ✓' : 'Validar ligação'}
          </button>
        </div>
        <ErrBanner msg={err} />
        {success && (
          <div style={{ display: 'flex', gap: 12, border: '1px solid rgba(52,199,89,.3)', background: 'rgba(52,199,89,.08)', borderRadius: 12, padding: '15px 17px', marginTop: 16 }}>
            <span style={{ color: '#5dd57b', fontSize: 15 }}>✓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7ee094' }}>Cluster ligado com sucesso</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>A DevShip conseguiu aceder ao cluster e verificar a configuração.</div>
            </div>
          </div>
        )}
      </FormCard>
      <NavRow onBack={() => nav('/onboarding/aws-setup')} onNext={() => nav('/onboarding/environments')} nextDisabled={!success} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 5 — Environments
// ═══════════════════════════════════════════════════════════════════════════════
interface EnvFormState {
  key: string;
  name: string;
  display_name: string;
  namespace: string;
  git_ops_base_path: string;
  source_branch: string;
  deployment_order: number;
  requires_approval: boolean;
  approval_required_role: string;
}

interface EnvValidation {
  namespace_status: string; namespace_error?: string | null;
  branch_status: string;    branch_error?: string | null;
  git_ops_path_status: string; git_ops_path_error?: string | null;
  overall_status: string;
}

interface EnvResult { id: string; name: string; deployment_order: number; validation: EnvValidation; }

const PILLS = [
  { label: 'DEV',     name: 'DEV',     display_name: 'Development', namespace: 'app-dev',     path: 'apps/dev',     order: 1 },
  { label: 'STAGING', name: 'STAGING', display_name: 'Staging',     namespace: 'app-staging', path: 'apps/staging', order: 2 },
  { label: 'PROD',    name: 'PROD',    display_name: 'Production',  namespace: 'app-prod',    path: 'apps/prod',    order: 3 },
];

function mkEnv(pill: typeof PILLS[0]): EnvFormState {
  return {
    key: pill.name,
    name: pill.name,
    display_name: pill.display_name,
    namespace: pill.namespace,
    git_ops_base_path: pill.path,
    source_branch: 'main',
    deployment_order: pill.order,
    requires_approval: pill.name === 'PROD',
    approval_required_role: 'TECH_LEAD',
  };
}

export function OnboardingEnvironments() {
  const nav = useNavigate();
  const [envs, setEnvs] = useState<EnvFormState[]>([]);
  const [results, setResults] = useState<EnvResult[] | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const projectId = localStorage.getItem(OB_PROJECT_ID);

  // Pre-fill from existing environments (idempotency on back-navigation)
  useEffect(() => {
    if (!projectId) return;
    apiFetch(`/projects/${projectId}/environments`)
      .then((existing: Array<{
        name: string; display_name?: string; namespace?: string;
        git_ops_base_path?: string; source_branch?: string;
        deployment_order: number; requires_approval: boolean;
        approval_required_role?: string;
      }>) => {
        if (existing.length === 0) return;
        setEnvs(existing.map(e => ({
          key: e.name,
          name: e.name,
          display_name: e.display_name ?? '',
          namespace: e.namespace ?? '',
          git_ops_base_path: e.git_ops_base_path ?? '',
          source_branch: e.source_branch ?? 'main',
          deployment_order: e.deployment_order,
          requires_approval: e.requires_approval,
          approval_required_role: e.approval_required_role ?? 'TECH_LEAD',
        })));
      })
      .catch(() => {});
  }, [projectId]);

  function addPill(pill: typeof PILLS[0]) {
    if (!envs.find(e => e.key === pill.name)) setEnvs(prev => [...prev, mkEnv(pill)]);
  }

  function update(key: string, field: keyof EnvFormState, value: string | boolean | number) {
    setEnvs(prev => prev.map(e => e.key === key ? { ...e, [field]: value } : e));
  }

  function remove(key: string) { setEnvs(prev => prev.filter(e => e.key !== key)); }

  async function submit() {
    if (envs.length === 0) { setErr('Adiciona pelo menos um environment.'); return; }
    if (!projectId) { setErr('Projeto não encontrado — volta ao passo 2.'); return; }
    setLoading(true); setErr('');
    try {
      const body = envs.map(e => ({
        name: e.name,
        display_name: e.display_name || undefined,
        namespace: e.namespace || undefined,
        git_ops_base_path: e.git_ops_base_path || undefined,
        source_branch: e.source_branch || undefined,
        requires_approval: e.requires_approval,
        approval_required_role: e.requires_approval ? e.approval_required_role : undefined,
        deployment_order: Number(e.deployment_order),
      }));
      const res: EnvResult[] = await apiFetch(`/projects/${projectId}/environments`, { method: 'POST', body: JSON.stringify(body) });
      setResults(res);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar environments.');
    } finally { setLoading(false); }
  }

  const hasInvalid = results?.some(r => r.validation.overall_status !== 'VALID');

  return (
    <>
      <StepLabel n={5} label="Configurar Environments" sub="Adiciona os ambientes do projeto: DEV, STAGING, PROD." />

      {/* Result view after POST */}
      {results && (
        <>
          <div style={{ marginBottom: 20 }}>
            {hasInvalid
              ? <div style={{ display: 'flex', gap: 9, border: '1px solid rgba(224,169,59,.35)', background: 'rgba(224,169,59,.07)', borderRadius: 9, padding: '10px 13px' }}>
                  <span style={{ color: '#ecc26b' }}>⚠</span>
                  <span style={{ fontSize: 12, color: '#f0cf86' }}>Alguns environments têm avisos de validação. Podes avançar mesmo assim — corrige os namespaces/branches mais tarde.</span>
                </div>
              : <div style={{ display: 'flex', gap: 9, border: '1px solid rgba(52,199,89,.3)', background: 'rgba(52,199,89,.08)', borderRadius: 9, padding: '10px 13px' }}>
                  <span style={{ color: '#5dd57b' }}>✓</span>
                  <span style={{ fontSize: 12, color: '#7ee094' }}>Todos os environments criados e validados.</span>
                </div>
            }
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {results.map(r => (
              <div key={r.id} style={{ border: `1px solid ${r.validation.overall_status === 'VALID' ? 'rgba(52,199,89,.3)' : 'rgba(224,169,59,.3)'}`, borderRadius: 13, background: 'var(--surface)', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 6, background: 'rgba(43,199,180,.1)', color: 'var(--teal)', border: '1px solid rgba(43,199,180,.28)' }}>{r.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: r.validation.overall_status === 'VALID' ? '#5dd57b' : '#ecc26b' }}>
                    {r.validation.overall_status === 'VALID' ? '✓ válido' : '⚠ avisos'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, fontSize: 12 }}>
                  <div><span style={{ color: 'var(--text-3)' }}>Namespace</span><div style={{ marginTop: 4 }}><ValBadge status={r.validation.namespace_status} error={r.validation.namespace_error} /></div></div>
                  <div><span style={{ color: 'var(--text-3)' }}>Branch</span><div style={{ marginTop: 4 }}><ValBadge status={r.validation.branch_status} error={r.validation.branch_error} /></div></div>
                  <div><span style={{ color: 'var(--text-3)' }}>GitOps Path</span><div style={{ marginTop: 4 }}><ValBadge status={r.validation.git_ops_path_status} error={r.validation.git_ops_path_error} /></div></div>
                </div>
              </div>
            ))}
          </div>
          <NavRow onBack={() => setResults(null)} onNext={() => nav('/onboarding/applications')} nextLabel="Continuar →" />
        </>
      )}

      {/* Form view */}
      {!results && (
        <>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 20 }}>
            {PILLS.map(p => (
              <button key={p.name} onClick={() => addPill(p)} disabled={!!envs.find(e => e.key === p.name)}
                style={{ border: '1px dashed var(--border)', background: 'transparent', color: envs.find(e => e.key === p.name) ? 'var(--text-3)' : 'var(--text-2)', fontFamily: 'Geist Mono,monospace', fontSize: 12, padding: '7px 14px', borderRadius: 8, cursor: envs.find(e => e.key === p.name) ? 'default' : 'pointer' }}
                className="hover-teal">+ {p.label}</button>
            ))}
          </div>
          {envs.length === 0 && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 34, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Ainda sem environments. Adiciona um a partir das sugestões acima.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {envs.map(env => (
              <div key={env.key} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 500, padding: '4px 11px', borderRadius: 7, background: 'rgba(43,199,180,.1)', color: 'var(--teal)', border: '1px solid rgba(43,199,180,.28)' }}>{env.key}</span>
                  <input value={env.display_name} onChange={e => update(env.key, 'display_name', e.target.value)} className="input-base" style={{ flex: 1, fontSize: 13 }} placeholder="Nome de apresentação" />
                  <button onClick={() => remove(env.key)} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }} className="hover-teal">Remover</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                  <FormField label="Namespace">
                    <input className="input-base input-mono" value={env.namespace} onChange={e => update(env.key, 'namespace', e.target.value)} placeholder="app-dev" />
                  </FormField>
                  <FormField label="GitOps Base Path">
                    <input className="input-base input-mono" value={env.git_ops_base_path} onChange={e => update(env.key, 'git_ops_base_path', e.target.value)} placeholder="apps/dev" />
                  </FormField>
                  <FormField label="Source Branch">
                    <input className="input-base input-mono" value={env.source_branch} onChange={e => update(env.key, 'source_branch', e.target.value)} placeholder="main" />
                  </FormField>
                  <FormField label="Deployment Order">
                    <input className="input-base input-mono" type="number" min={1} value={env.deployment_order} onChange={e => update(env.key, 'deployment_order', Number(e.target.value))} style={{ maxWidth: 80 }} />
                  </FormField>
                </div>
                {/* Approval toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                  <button
                    onClick={() => update(env.key, 'requires_approval', !env.requires_approval)}
                    style={{ width: 38, height: 22, borderRadius: 11, background: env.requires_approval ? 'var(--teal)' : 'var(--surface-3)', border: 'none', cursor: 'pointer', position: 'relative', flex: 'none' }}
                  >
                    <span style={{ position: 'absolute', top: 2, left: env.requires_approval ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                  </button>
                  <span style={{ fontSize: 13 }}>Requires Approval</span>
                  {/* Only render role selector when approval is on */}
                  {env.requires_approval && (
                    <select
                      value={env.approval_required_role}
                      onChange={e => update(env.key, 'approval_required_role', e.target.value)}
                      className="select-base"
                      style={{ marginLeft: 8 }}
                    >
                      <option value="TECH_LEAD">Tech Lead</option>
                      <option value="CLOUD_ENGINEER">Cloud Engineer</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
          <ErrBanner msg={err} />
          <NavRow onBack={() => nav('/onboarding/cluster')} onNext={submit} loading={loading} nextDisabled={envs.length === 0} nextLabel="Criar environments →" />
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 6 — Applications
// ═══════════════════════════════════════════════════════════════════════════════
interface ScanResult {
  name: string;
  source_repository: string;
  manifest_path: string;
  environments: string[];
}

interface AppImportItem {
  name: string;
  source_repository: string;
  container_registry_repository: string;
  ci_workflow_file: string;
  environments: { environment_id: string; deployment_name: string; manifest_path?: string }[];
}

interface EnvIdMap { [name: string]: string }

export function OnboardingApplications() {
  const nav = useNavigate();
  const [candidates, setCandidates] = useState<ScanResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [registry, setRegistry] = useState<Record<string, string>>({});
  const [ciWorkflow, setCiWorkflow] = useState<Record<string, string>>({});
  const [envIds, setEnvIds] = useState<EnvIdMap>({});
  const [err, setErr] = useState('');
  const [scanErr, setScanErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);

  const projectId = localStorage.getItem(OB_PROJECT_ID);

  useEffect(() => {
    if (!projectId) { setScanErr('Projeto não encontrado.'); return; }
    // Fetch environment IDs for mapping name→id
    apiFetch(`/projects/${projectId}/environments`).then((res: EnvResult[]) => {
      const map: EnvIdMap = {};
      res.forEach(e => { map[e.name] = e.id; });
      setEnvIds(map);
    }).catch(() => {});
    scan();
  }, [projectId]);

  async function scan() {
    if (!projectId) return;
    setScanning(true); setScanErr('');
    try {
      const res: ScanResult[] = await apiFetch(`/projects/${projectId}/gitops-scan`);
      setCandidates(res);
      setSelected(new Set(res.map(r => r.name)));
    } catch (e: unknown) {
      setScanErr(e instanceof Error ? e.message : 'Erro ao escanear repositório.');
    } finally { setScanning(false); }
  }

  function toggleSelect(name: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function submit() {
    const toImport = candidates.filter(c => selected.has(c.name));
    if (toImport.length === 0) { setErr('Seleciona pelo menos uma application.'); return; }
    if (!projectId) { setErr('Projeto não encontrado.'); return; }
    setLoading(true); setErr('');
    try {
      const applications: AppImportItem[] = toImport.map(c => ({
        name: c.name,
        source_repository: c.source_repository,
        container_registry_repository: registry[c.name] ?? '',
        ci_workflow_file: ciWorkflow[c.name] ?? `${c.name}.yml`,
        environments: c.environments
          .filter(envName => envIds[envName])
          .map(envName => ({ environment_id: envIds[envName], deployment_name: c.name, manifest_path: c.manifest_path })),
      }));
      await apiFetch(`/projects/${projectId}/applications/import`, { method: 'POST', body: JSON.stringify({ applications }) });
      setDone(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao importar applications.');
    } finally { setLoading(false); }
  }

  if (done) {
    const projName = localStorage.getItem(OB_PROJ_NAME) ?? 'my-project';
    const teamName = localStorage.getItem(OB_TEAM_NAME) ?? 'engineering-team';
    return (
      <>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52,199,89,.14)', border: '1.5px solid rgba(52,199,89,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px auto 20px' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 7" stroke="#5dd57b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-.02em', margin: 0 }}>Tudo pronto</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '10px auto 0', maxWidth: 440 }}>O teu projeto está configurado e as applications foram importadas.</p>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', marginTop: 28, overflow: 'hidden' }}>
          {[['Team', teamName], ['Project', projName], ['Applications importadas', String(selected.size)]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-soft)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', width: 160, flex: 'none' }}>{k}</span>
              <span className="mono" style={{ fontSize: 13 }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={() => nav('/app/home')} className="btn-primary hover-bright" style={{ width: '100%', fontSize: 14.5, padding: 14, borderRadius: 11, marginTop: 24 }}>Ir para a homepage →</button>
      </>
    );
  }

  return (
    <>
      <StepLabel n={6} label="Importar Applications" sub="A DevShip percorreu o repositório GitOps em busca de Deployments." />

      {scanning && <div style={{ color: 'var(--text-3)', fontSize: 13 }}>A escanear repositório…</div>}
      <ErrBanner msg={scanErr} />

      {!scanning && scanErr && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>Causas prováveis:</div>
          <ul style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
            <li>URL do repositório GitOps incorreta (passo 2)</li>
            <li>Repositório privado sem acesso configurado</li>
            <li>Nenhum ficheiro com <code className="mono" style={{ color: 'var(--teal)' }}>kind: Deployment</code> encontrado</li>
          </ul>
          <button onClick={scan} className="btn-secondary" style={{ marginTop: 14, fontSize: 13, padding: '9px 18px', borderRadius: 9 }}>Tentar novamente</button>
        </div>
      )}

      {!scanning && candidates.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 11, border: '1px solid rgba(77,156,246,.28)', background: 'rgba(77,156,246,.08)', borderRadius: 12, padding: '13px 15px', marginBottom: 18 }}>
            <span style={{ color: '#7fb6f9' }}>ⓘ</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
              Encontrados <strong>{candidates.length}</strong> Deployment{candidates.length !== 1 ? 's' : ''}. Seleciona os que queres importar.
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {candidates.map(c => {
              const isSel = selected.has(c.name);
              return (
                <div key={c.name} style={{ border: `1px solid ${isSel ? 'rgba(43,199,180,.35)' : 'var(--border)'}`, borderRadius: 14, background: isSel ? 'rgba(43,199,180,.04)' : 'var(--surface)', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isSel ? 16 : 0 }}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(c.name)} style={{ accentColor: 'var(--teal)', width: 16, height: 16, flex: 'none', cursor: 'pointer' }} />
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{c.name}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{c.manifest_path}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {c.environments.map(env => (
                        <span key={env} className="mono" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: envIds[env] ? 'rgba(52,199,89,.12)' : 'var(--surface-2)', color: envIds[env] ? '#5dd57b' : 'var(--text-3)', border: `1px solid ${envIds[env] ? 'rgba(52,199,89,.24)' : 'var(--border)'}` }}>
                          {env}{!envIds[env] && ' · não configurado'}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isSel && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                      <FormField label="Container Registry Repository">
                        <input className="input-base input-mono" value={registry[c.name] ?? ''} onChange={e => setRegistry(p => ({ ...p, [c.name]: e.target.value }))} placeholder="company/backend" />
                      </FormField>
                      <FormField label="CI Workflow File">
                        <input className="input-base input-mono" value={ciWorkflow[c.name] ?? `${c.name}.yml`} onChange={e => setCiWorkflow(p => ({ ...p, [c.name]: e.target.value }))} placeholder="gitops-deploy.yml" />
                      </FormField>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <ErrBanner msg={err} />
          <NavRow onBack={() => nav('/onboarding/environments')} onNext={submit} loading={loading} nextDisabled={selected.size === 0} nextLabel="Importar applications →" />
        </>
      )}

      {!scanning && !scanErr && candidates.length === 0 && !scanning && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 34, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          Nenhum Deployment encontrado no repositório GitOps.
          <button onClick={scan} className="btn-secondary" style={{ display: 'block', margin: '14px auto 0', fontSize: 13, padding: '9px 18px', borderRadius: 9 }}>Rescanear</button>
        </div>
      )}
    </>
  );
}
