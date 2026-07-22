import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { parseCollisionDetail } from '../utils/collisionError';

// ─── Shared storage keys ────────────────────────────────────────────────────
export const OB_TEAM_ID    = 'ob_team_id';
export const OB_PROJECT_ID = 'ob_project_id';
export const OB_TEAM_NAME  = 'ob_team_name';
export const OB_PROJ_NAME  = 'ob_proj_name';
// Set only when OnboardingProject actually creates a project in the current onboarding
// run — used to pre-fill that same form on back-navigation, without confusing it with
// OB_PROJECT_ID (which may still hold a previous, unrelated project as a fallback).
export const OB_NEW_PROJECT_ID = 'ob_new_project_id';
// 'new_team' (default) percorre os 7 passos a partir de criar Team. 'new_project' é
// entrado a partir de Settings → "Criar novo projeto" numa Team já existente — salta
// direto para o passo Project, sem recriar a Team nem passar por ela na numeração/voltar.
export const OB_MODE = 'ob_mode';

function currentMode(): 'new_team' | 'new_project' {
  return localStorage.getItem(OB_MODE) === 'new_project' ? 'new_project' : 'new_team';
}

// ─── Progress bar ───────────────────────────────────────────────────────────
const STEP_PATHS_NEW_TEAM = [
  '/onboarding/team',
  '/onboarding/project',
  '/onboarding/aws-setup',
  '/onboarding/cluster',
  '/onboarding/argocd-metrics',
  '/onboarding/environments',
  '/onboarding/applications',
];
const STEP_PATHS_NEW_PROJECT = STEP_PATHS_NEW_TEAM.slice(1); // sem o passo Team

function stepIndex(pathname: string) {
  const paths = currentMode() === 'new_project' ? STEP_PATHS_NEW_PROJECT : STEP_PATHS_NEW_TEAM;
  return paths.findIndex(p => pathname.startsWith(p));
}

export default function OnboardingLayout() {
  const loc = useLocation();
  const idx = stepIndex(loc.pathname);
  const showBar = idx >= 0;
  const totalSteps = currentMode() === 'new_project' ? STEP_PATHS_NEW_PROJECT.length : STEP_PATHS_NEW_TEAM.length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(15,17,23,.85)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 26px' }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>DevShip</span>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Onboarding</span>
          {showBar && <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>Passo {idx + 1} de {totalSteps}</span>}
        </div>
        {showBar && (
          <div style={{ display: 'flex', gap: 5, padding: '0 26px 12px' }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
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
  // n é sempre o número absoluto no fluxo new_team (1=Team..7=Applications). Em modo
  // new_project o passo Team não existe, então tanto o número mostrado como o total
  // descem 1 — sem obrigar cada StepLabel a saber em que modo está.
  const isNewProject = currentMode() === 'new_project';
  const shownN = isNewProject ? n - 1 : n;
  const shownTotal = isNewProject ? STEP_PATHS_NEW_PROJECT.length : STEP_PATHS_NEW_TEAM.length;
  return (
    <>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--teal)' }}>Passo {shownN} de {shownTotal}</div>
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

// ─── File preview (CI workflow, discovered manifest) ────────────────────────
interface EnvPreviewOption { name: string; path: string; branch?: string; }

function FilePreviewButton({ repoUrl, path, branch, projectId, envOptions }: {
  // 'branch', não 'ref' — 'ref' é uma prop reservada do React (referências DOM/instância);
  // passá-la como prop normal a um componente funcional é descartada/gera warning.
  repoUrl: string; path: string; branch?: string; projectId: string;
  // Quando o mesmo app foi encontrado em vários environments (manifest_paths com >1
  // entrada), mostra um seletor para trocar de environment sem fechar o modal — sem isto
  // o preview ficava preso ao primeiro environment descoberto.
  envOptions?: EnvPreviewOption[];
}) {
  const [open, setOpen] = useState(false);
  const [activeEnv, setActiveEnv] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Identifica o último (repoUrl, path, branch) já carregado — refaz o fetch sempre que
  // qualquer um muda (ex.: o utilizador edita o nome do workflow file), em vez de assumir
  // "já tenho conteúdo, não repito" para sempre.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const effectivePath = envOptions && activeEnv ? envOptions.find(o => o.name === activeEnv)?.path ?? path : path;
  const effectiveBranch = envOptions && activeEnv ? envOptions.find(o => o.name === activeEnv)?.branch ?? branch : branch;
  const key = `${repoUrl}::${effectivePath}::${effectiveBranch ?? ''}`;

  function load() {
    setLoading(true); setError('');
    const refParam = effectiveBranch ? `&ref=${encodeURIComponent(effectiveBranch)}` : '';
    apiFetch(`/projects/${projectId}/file-preview?repo_url=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(effectivePath)}${refParam}`)
      .then((r: { content: string }) => { setContent(r.content); setLoadedKey(key); })
      .catch((e: Error) => { setError(e.message); setLoadedKey(key); })
      .finally(() => setLoading(false));
  }

  function handleOpen() {
    setOpen(true);
    if (envOptions && !activeEnv) setActiveEnv(envOptions[0]?.name ?? null);
    if (loadedKey === key) return; // já carregado exatamente este (repo, path, ref), não repetir
    setContent(null);
    load();
  }

  function selectEnv(name: string) {
    setActiveEnv(name);
    setContent(null);
  }

  // Refaz o fetch quando o environment ativo muda dentro do modal já aberto.
  useEffect(() => {
    if (open && loadedKey !== key) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  return (
    <>
      <button type="button" onClick={handleOpen} className="btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6 }}>
        Preview
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setOpen(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', maxWidth: 640, width: '100%', margin: '0 16px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{effectivePath}</span>
              <button onClick={() => setOpen(false)} className="btn-ghost" style={{ fontSize: 12 }}>Fechar</button>
            </div>
            {envOptions && envOptions.length > 1 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {envOptions.map(o => (
                  <button
                    key={o.name}
                    onClick={() => selectEnv(o.name)}
                    className="mono"
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${activeEnv === o.name ? 'var(--teal)' : 'var(--border)'}`,
                      background: activeEnv === o.name ? 'rgba(43,199,180,.1)' : 'transparent',
                      color: activeEnv === o.name ? 'var(--teal)' : 'var(--text-2)',
                    }}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            )}
            {loading && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>A carregar…</div>}
            {error && <div style={{ fontSize: 13, color: '#ff8497' }}>{error}</div>}
            {!loading && content !== null && (
              <pre className="mono" style={{ fontSize: 12, color: 'var(--text)', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>{content}</pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── GitOps path browser (folder listing → drill into files) ───────────────
interface DirEntry { name: string; type: 'file' | 'dir'; }

export function GitOpsPathPreviewButton({ repoUrl, basePath, projectId }: { repoUrl: string; basePath: string; projectId: string }) {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(basePath);
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function loadDir(path: string) {
    setCurrentPath(path);
    setFileContent(null);
    setLoading(true); setError('');
    apiFetch(`/projects/${projectId}/dir-preview?repo_url=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(path)}`)
      .then((r: DirEntry[]) => setEntries(r))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function handleOpen() {
    setOpen(true);
    setFileContent(null);
    loadDir(basePath); // sempre a partir do valor atual do campo — nunca mostra uma pasta desatualizada
  }

  function openEntry(entry: DirEntry) {
    const path = `${currentPath.replace(/\/$/, '')}/${entry.name}`;
    if (entry.type === 'dir') { setEntries(null); loadDir(path); return; }
    setLoading(true); setError('');
    apiFetch(`/projects/${projectId}/file-preview?repo_url=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(path)}`)
      .then((r: { content: string }) => { setFileContent(r.content); setCurrentPath(path); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className="btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6 }}>
        Preview
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setOpen(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', maxWidth: 640, width: '100%', margin: '0 16px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentPath}</span>
              <button onClick={() => setOpen(false)} className="btn-ghost" style={{ fontSize: 12, flex: 'none' }}>Fechar</button>
            </div>
            {loading && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>A carregar…</div>}
            {error && <div style={{ fontSize: 13, color: '#ff8497' }}>{error}</div>}
            {!loading && !error && fileContent !== null && (
              <>
                <button onClick={() => { setFileContent(null); loadDir(currentPath.split('/').slice(0, -1).join('/')); }} className="btn-ghost" style={{ fontSize: 11.5, alignSelf: 'flex-start', marginBottom: 8 }}>← Voltar à pasta</button>
                <pre className="mono" style={{ fontSize: 12, color: 'var(--text)', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>{fileContent}</pre>
              </>
            )}
            {!loading && !error && fileContent === null && entries !== null && (
              entries.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Pasta vazia ou ainda não existe no repositório.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'auto' }}>
                  {entries.map(e => (
                    <button
                      key={e.name}
                      onClick={() => openEntry(e)}
                      className="btn-ghost"
                      style={{ fontSize: 12.5, textAlign: 'left', padding: '6px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span style={{ color: 'var(--text-3)' }}>{e.type === 'dir' ? '📁' : '📄'}</span>
                      <span className="mono">{e.name}</span>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
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
const STEP_LABELS = ['Criar Team', 'Criar Project', 'Preparar AWS / EKS', 'Configurar Cluster', 'Configurar ArgoCD e Metrics', 'Configurar Environments', 'Importar Applications'];

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

  // Entrar pelo passo Team é sempre um onboarding "new_team" genuíno — garante que uma
  // sessão anterior de "criar novo projeto" abandonada a meio não deixa flags presas.
  useEffect(() => { localStorage.removeItem(OB_MODE); localStorage.removeItem(OB_NEW_PROJECT_ID); }, []);

  // Pre-fill if team was already created (idempotency on back-navigation) — only if the
  // stored team still belongs to the logged-in user. A leftover ob_team_id from a previous
  // session/user would otherwise silently get reused for this one (403s further down the flow).
  useEffect(() => {
    const teamId = localStorage.getItem(OB_TEAM_ID);
    const teamName = localStorage.getItem(OB_TEAM_NAME);
    if (!teamId) return;
    apiFetch(`/teams/${teamId}`)
      .then(() => { if (teamName) setName(teamName); })
      .catch(() => {
        localStorage.removeItem(OB_TEAM_ID);
        localStorage.removeItem(OB_TEAM_NAME);
        localStorage.removeItem(OB_PROJECT_ID);
        localStorage.removeItem(OB_PROJ_NAME);
      });
  }, []);

  async function submit() {
    if (!name.trim()) { setErr('O nome da equipa é obrigatório.'); return; }
    setLoading(true); setErr('');
    // If a team is already stored, confirm it's still the caller's before reusing it —
    // never trust a cached id as authorization.
    const existingId = localStorage.getItem(OB_TEAM_ID);
    if (existingId) {
      try {
        await apiFetch(`/teams/${existingId}`);
        setLoading(false);
        // Um CE pendente de confirmação não avança para /project — o backend bloquearia
        // create_project de qualquer forma, mas isto evita sequer tentar.
        const myTeams: { team_id: string; status: string }[] = await apiFetch('/users/me/teams');
        const mine = myTeams.find(t => t.team_id === existingId);
        if (mine?.status === 'PENDING_CONFIRMATION') { nav('/lobby', { replace: true }); return; }
        nav('/onboarding/project');
        return;
      } catch {
        localStorage.removeItem(OB_TEAM_ID);
        localStorage.removeItem(OB_TEAM_NAME);
        localStorage.removeItem(OB_PROJECT_ID);
        localStorage.removeItem(OB_PROJ_NAME);
      }
    }
    try {
      const team = await apiFetch('/teams', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: desc || undefined }) });
      localStorage.setItem(OB_TEAM_ID, team.id);
      localStorage.setItem(OB_TEAM_NAME, team.name);
      if (team.member_status === 'PENDING_CONFIRMATION') { nav('/lobby', { replace: true }); return; }
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

  // Pre-fill if this exact project was already created earlier in the same onboarding run
  // (idempotency on back-navigation). OB_NEW_PROJECT_ID is set only once submit() below
  // actually creates a project — distinct from OB_PROJECT_ID, which in 'new_project' mode
  // still points at the *previous* active project (kept as a fallback, see Settings.tsx
  // startNewProject) and must never be used to pre-fill this form.
  useEffect(() => {
    const projectId = localStorage.getItem(OB_NEW_PROJECT_ID);
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
      localStorage.setItem(OB_NEW_PROJECT_ID, project.id);
      nav('/onboarding/aws-setup');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
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
      <NavRow onBack={() => nav(currentMode() === 'new_project' ? '/app/settings' : '/onboarding/team')} onNext={submit} loading={loading} nextDisabled={!name.trim()} />
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
      <NavRow onBack={() => nav('/onboarding/aws-setup')} onNext={() => nav('/onboarding/argocd-metrics')} nextDisabled={!success} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 5 — ArgoCD e Metrics RBAC
// ═══════════════════════════════════════════════════════════════════════════════
interface RbacCheckResult {
  rbac_subject: string | null;
  argocd_ok: boolean;
  argocd_error: string | null;
  metrics_ok: boolean;
  metrics_error: string | null;
}

export function OnboardingArgocdMetrics() {
  const nav = useNavigate();
  const [result, setResult] = useState<RbacCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const projectId = localStorage.getItem(OB_PROJECT_ID);

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function test() {
    if (!projectId) return;
    setLoading(true); setErr('');
    try {
      const r = await apiFetch(`/projects/${projectId}/cluster/rbac-check`);
      setResult(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao testar RBAC.');
    } finally { setLoading(false); }
  }

  const subject = result?.rbac_subject ?? '<sujeito calculado ao testar — precisa do IAM Role ARN do passo anterior>';

  const argocdYaml = `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: devship-argocd-reader
rules:
  - apiGroups: ["argoproj.io"]
    resources: ["applications"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: devship-argocd-reader-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: devship-argocd-reader
subjects:
  - kind: User
    name: "${subject}"
    apiGroup: rbac.authorization.k8s.io`;

  const metricsYaml = `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: devship-metrics-reader
rules:
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: devship-metrics-reader-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: devship-metrics-reader
subjects:
  - kind: User
    name: "${subject}"
    apiGroup: rbac.authorization.k8s.io`;

  const applyCmd = `kubectl apply -f - <<'EOF'\n${argocdYaml}\n---\n${metricsYaml}\nEOF`;

  return (
    <>
      <StepLabel n={5} label="Configurar ArgoCD e Metrics" sub="Sem isto o deploy continua a funcionar, mas perde sync do ArgoCD e CPU/memória dos pods." />

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '20px 22px', marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Porque é que o ARN da role não chega</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
          O Access Entry do passo anterior autentica a role, mas o Kubernetes RBAC autoriza por uma identidade diferente —
          a sessão assumida, não o ARN da role. Os manifestos abaixo já vêm com o subject certo, calculado a partir do
          Role ARN que deste no passo 4. Isto não existe no painel da AWS: é sempre um objeto Kubernetes, aplicado via
          <code className="mono" style={{ margin: '0 4px' }}>kubectl</code> — quer o tenhas configurado com Terraform, AWS CLI, ou à mão na consola.
        </p>
      </div>

      <CodeBlock
        title="1 · ClusterRole + ClusterRoleBinding — ArgoCD"
        desc="Permite à DevShip ler o estado de sync das Applications do ArgoCD."
        filename="devship-argocd-rbac.yaml"
        code={argocdYaml}
        copyKey="argocd-yaml" copied={copied} onCopy={copy}
        why={{ title: 'RBAC do ArgoCD — o quê e porquê', body: 'Applications do ArgoCD são uma Custom Resource (argoproj.io), não um recurso nativo do Kubernetes — o AmazonEKSViewPolicy do passo 3 não cobre isto. Sem esta permissão, o pipeline de deploy não mostra o sync do GitOps e degrada silenciosamente para observação direta do K8s ao fim de ~60s.' }}
      />

      <div style={{ height: 14 }} />

      <CodeBlock
        title="2 · ClusterRole + ClusterRoleBinding — Metrics"
        desc="Permite à DevShip ler CPU/memória dos pods (ecrã Pods/Health)."
        filename="devship-metrics-rbac.yaml"
        code={metricsYaml}
        copyKey="metrics-yaml" copied={copied} onCopy={copy}
        why={{ title: 'RBAC do Metrics API — o quê e porquê', body: 'metrics.k8s.io é outra aggregated API, servida pelo metrics-server — precisa do metrics-server instalado no cluster e desta permissão dedicada. Sem isto, o ecrã Pods mostra sempre "Metrics API indisponível", mesmo com o pod saudável.' }}
      />

      <div style={{ height: 14 }} />

      <CodeBlock
        title="3 · Aplicar com kubectl"
        desc="Precisa de kubectl já configurado contra o cluster (aws eks update-kubeconfig, CloudShell, ou o teu terminal habitual)."
        filename="apply.sh"
        code={applyCmd}
        copyKey="apply-cmd" copied={copied} onCopy={copy}
      />

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 13 }}>
        <button onClick={test} disabled={loading} className="btn-secondary" style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9 }}>
          {loading ? 'A testar…' : 'Testar ligação'}
        </button>
      </div>
      <ErrBanner msg={err} />

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <RbacResultRow ok={result.argocd_ok} label="ArgoCD" error={result.argocd_error} />
          <RbacResultRow ok={result.metrics_ok} label="Metrics API" error={result.metrics_error} />
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 14 }}>
        Isto não bloqueia o onboarding — o deploy funciona sem isto, só perde sync do ArgoCD e métricas de CPU/memória.
        Podes avançar e voltar aqui mais tarde.
      </div>

      <NavRow onBack={() => nav('/onboarding/cluster')} onNext={() => nav('/onboarding/environments')} nextLabel="Continuar →" />
    </>
  );
}

function RbacResultRow({ ok, label, error }: { ok: boolean; label: string; error: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: `1px solid ${ok ? 'rgba(52,199,89,.3)' : 'rgba(241,85,108,.3)'}`, background: ok ? 'rgba(52,199,89,.08)' : 'rgba(241,85,108,.08)', borderRadius: 12, padding: '13px 16px' }}>
      <span style={{ color: ok ? '#5dd57b' : '#ff8497', fontSize: 14 }}>{ok ? '✓' : '✕'}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: ok ? '#7ee094' : '#ff8497' }}>{label}{ok ? ' — acesso confirmado' : ' — sem acesso'}</div>
        {!ok && error && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>{error}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 6 — Environments
// ═══════════════════════════════════════════════════════════════════════════════
interface EnvFormState {
  key: string;
  name: string;
  display_name: string;
  namespace: string;
  git_ops_base_path: string;
  source_branch: string;
  gitops_branch: string;
  argocd_application_name: string;
  deployment_order: number;
  requires_approval: boolean;
  approval_required_role: string;
}

interface EnvValidation {
  namespace_status: string; namespace_error?: string | null;
  branch_status: string;    branch_error?: string | null;
  git_ops_path_status: string; git_ops_path_error?: string | null;
  argocd_status: string;    argocd_error?: string | null;
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
    gitops_branch: 'main',
    argocd_application_name: '',
    deployment_order: pill.order,
    requires_approval: pill.name === 'PROD',
    approval_required_role: 'TECH_LEAD',
  };
}

export function OnboardingEnvironments() {
  const nav = useNavigate();
  const [envs, setEnvs] = useState<EnvFormState[]>([]);
  const [results, setResults] = useState<EnvResult[] | null>(null);
  const [gitOpsUrl, setGitOpsUrl] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, Partial<Record<'namespace' | 'argocd_application_name' | 'git_ops_base_path', string>>>>({});

  const projectId = localStorage.getItem(OB_PROJECT_ID);

  useEffect(() => {
    if (!projectId) return;
    apiFetch(`/projects/${projectId}`)
      .then((p: { git_ops_repository_url?: string }) => setGitOpsUrl(p.git_ops_repository_url ?? ''))
      .catch(() => {});
  }, [projectId]);

  // Pre-fill from existing environments (idempotency on back-navigation)
  useEffect(() => {
    if (!projectId) return;
    apiFetch(`/projects/${projectId}/environments`)
      .then((existing: Array<{
        name: string; display_name?: string; namespace?: string;
        git_ops_base_path?: string; source_branch?: string; gitops_branch?: string;
        argocd_application_name?: string;
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
          gitops_branch: e.gitops_branch ?? 'main',
          argocd_application_name: e.argocd_application_name ?? '',
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
    setLoading(true); setErr(''); setRowErrors({});
    try {
      const body = envs.map(e => ({
        name: e.name,
        display_name: e.display_name || undefined,
        namespace: e.namespace || undefined,
        git_ops_base_path: e.git_ops_base_path || undefined,
        source_branch: e.source_branch || undefined,
        gitops_branch: e.gitops_branch || undefined,
        argocd_application_name: e.argocd_application_name || undefined,
        requires_approval: e.requires_approval,
        approval_required_role: e.requires_approval ? e.approval_required_role : undefined,
        deployment_order: Number(e.deployment_order),
      }));
      const res: EnvResult[] = await apiFetch(`/projects/${projectId}/environments`, { method: 'POST', body: JSON.stringify(body) });
      setResults(res);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao criar environments.';
      // 409 de colisão identifica o valor em conflito mas não diz qual dos environments do
      // lote é o dono — descobre-se comparando com o estado local para assinalar a row certa.
      const collision = parseCollisionDetail(message);
      const owner = collision && envs.find(env => env[collision.field] === collision.value);
      if (collision && owner) {
        setRowErrors({ [owner.key]: { [collision.field]: collision.detail } });
        setErr('Conflito de configuração — corrige o campo assinalado abaixo.');
      } else {
        setErr(message);
      }
    } finally { setLoading(false); }
  }

  const hasInvalid = results?.some(r => r.validation.overall_status !== 'VALID');

  return (
    <>
      <StepLabel n={6} label="Configurar Environments" sub="Adiciona os ambientes do projeto: DEV, STAGING, PROD." />

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, fontSize: 12 }}>
                  <div><span style={{ color: 'var(--text-3)' }}>Namespace</span><div style={{ marginTop: 4 }}><ValBadge status={r.validation.namespace_status} error={r.validation.namespace_error} /></div></div>
                  <div>
                    <span className="ds-tooltip" style={{ position: 'relative', color: 'var(--text-3)', cursor: 'default', borderBottom: '1px dotted var(--text-3)' }}>
                      Source Branch
                      <span className="ds-tooltip-bubble">Não é validado neste passo — ainda não existe nenhuma Application associada a este Environment, por isso não há repositório de código para confirmar que a branch existe. A validação passa a ser possível depois de importares Applications.</span>
                    </span>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--text-2)' }}>{envs.find(e => e.name === r.name)?.source_branch || '—'}</div>
                  </div>
                  <div><span style={{ color: 'var(--text-3)' }}>GitOps Branch</span><div style={{ marginTop: 4 }}><ValBadge status={r.validation.branch_status} error={r.validation.branch_error} /></div></div>
                  <div><span style={{ color: 'var(--text-3)' }}>GitOps Path</span><div style={{ marginTop: 4 }}><ValBadge status={r.validation.git_ops_path_status} error={r.validation.git_ops_path_error} /></div></div>
                  <div><span style={{ color: 'var(--text-3)' }}>ArgoCD</span><div style={{ marginTop: 4 }}><ValBadge status={r.validation.argocd_status} error={r.validation.argocd_error} /></div></div>
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
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                  <FormField label="Namespace">
                    <input className="input-base input-mono" value={env.namespace} onChange={e => update(env.key, 'namespace', e.target.value)} placeholder="app-dev" />
                    {rowErrors[env.key]?.namespace && (
                      <div style={{ fontSize: 12, color: '#ff8497', marginTop: 4 }}>{rowErrors[env.key].namespace}</div>
                    )}
                  </FormField>
                  <FormField label="GitOps Base Path">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="input-base input-mono" value={env.git_ops_base_path} onChange={e => update(env.key, 'git_ops_base_path', e.target.value)} placeholder="apps/dev" style={{ flex: 1 }} />
                      {gitOpsUrl && env.git_ops_base_path && (
                        <GitOpsPathPreviewButton repoUrl={gitOpsUrl} basePath={env.git_ops_base_path} projectId={projectId!} />
                      )}
                    </div>
                    {rowErrors[env.key]?.git_ops_base_path && (
                      <div style={{ fontSize: 12, color: '#ff8497', marginTop: 4 }}>{rowErrors[env.key].git_ops_base_path}</div>
                    )}
                  </FormField>
                  <FormField label="Source Branch (repo de código)">
                    <input className="input-base input-mono" value={env.source_branch} onChange={e => update(env.key, 'source_branch', e.target.value)} placeholder="main" />
                  </FormField>
                  <FormField label="GitOps Branch (repo GitOps)">
                    <input className="input-base input-mono" value={env.gitops_branch} onChange={e => update(env.key, 'gitops_branch', e.target.value)} placeholder="main" />
                  </FormField>
                  <FormField label="ArgoCD Application">
                    <input
                      className="input-base input-mono"
                      value={env.argocd_application_name}
                      onChange={e => update(env.key, 'argocd_application_name', e.target.value)}
                      placeholder={`demo-app-${env.name.toLowerCase()}`}
                    />
                    {rowErrors[env.key]?.argocd_application_name && (
                      <div style={{ fontSize: 12, color: '#ff8497', marginTop: 4 }}>{rowErrors[env.key].argocd_application_name}</div>
                    )}
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
          <NavRow onBack={() => nav('/onboarding/argocd-metrics')} onNext={submit} loading={loading} nextDisabled={envs.length === 0} nextLabel="Criar environments →" />
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
  manifest_paths: Record<string, string>;
  source_branches: Record<string, string>;
}

interface AppImportItem {
  name: string;
  source_repository: string;
  ci_workflow_file: string;
  environments: { environment_id: string; deployment_name: string; manifest_path?: string }[];
}

interface EnvIdMap { [name: string]: string }

export function OnboardingApplications() {
  const nav = useNavigate();
  const [candidates, setCandidates] = useState<ScanResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ciWorkflow, setCiWorkflow] = useState<Record<string, string>>({});
  const [workflowFiles, setWorkflowFiles] = useState<Record<string, string[]>>({});
  const [workflowLoading, setWorkflowLoading] = useState<Record<string, boolean>>({});
  const [workflowBranchErr, setWorkflowBranchErr] = useState<Record<string, string>>({});
  const [envIds, setEnvIds] = useState<EnvIdMap>({});
  const [gitOpsUrl, setGitOpsUrl] = useState('');
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
    apiFetch(`/projects/${projectId}`)
      .then((p: { git_ops_repository_url?: string }) => setGitOpsUrl(p.git_ops_repository_url ?? ''))
      .catch(() => {});
    scan();
  }, [projectId]);

  async function scan() {
    if (!projectId) return;
    setScanning(true); setScanErr('');
    try {
      const res: ScanResult[] = await apiFetch(`/projects/${projectId}/gitops-scan`);
      setCandidates(res);
      setSelected(new Set(res.map(r => r.name)));

      res.forEach(c => {
        // A branch a usar para descobrir o workflow file é o source_branch do primeiro
        // environment do candidato — mesmo critério já usado implicitamente para escolher
        // qual manifest_path mostrar por omissão. Uma branch errada (o edge case que motivou
        // isto) já não é ignorada: vem um branch_error explícito do backend.
        const firstEnv = c.environments[0];
        const branch = firstEnv ? c.source_branches[firstEnv] : undefined;
        const branchParam = branch ? `&source_branch=${encodeURIComponent(branch)}` : '';
        setWorkflowLoading(p => ({ ...p, [c.name]: true }));
        apiFetch(`/projects/${projectId}/workflow-files?source_repository=${encodeURIComponent(c.source_repository)}${branchParam}`)
          .then((r: { files: string[]; branch_error: string | null }) => {
            setWorkflowFiles(p => ({ ...p, [c.name]: r.files }));
            if (r.branch_error) setWorkflowBranchErr(p => ({ ...p, [c.name]: r.branch_error! }));
            if (r.files.length === 1) {
              setCiWorkflow(p => (p[c.name] ? p : { ...p, [c.name]: r.files[0] })); // não sobrescrever edição manual já feita
            }
          })
          .catch(() => setWorkflowFiles(p => ({ ...p, [c.name]: [] })))
          .finally(() => setWorkflowLoading(p => ({ ...p, [c.name]: false })));
      });
    } catch (e: unknown) {
      setScanErr(e instanceof Error ? e.message : 'Erro ao fazer scan ao repositório.');
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
    const missingWorkflow = toImport.filter(c => !ciWorkflow[c.name]);
    if (missingWorkflow.length > 0) {
      setErr('Falta indicar o CI Workflow File de: ' + missingWorkflow.map(c => c.name).join(', '));
      return;
    }
    setLoading(true); setErr('');

    // O nome do workflow file pode ter sido escrito à mão (não veio da lista detetada
    // automaticamente) — confirma que o ficheiro existe mesmo antes de importar, em vez de
    // só verificar que o campo não está vazio. Sem isto, um nome errado só seria descoberto
    // muito mais tarde, ao tentar correr o deploy.
    const toVerify = toImport.filter(c => !(workflowFiles[c.name] ?? []).includes(ciWorkflow[c.name]));
    if (toVerify.length > 0) {
      const results = await Promise.all(toVerify.map(c => {
        const branch = c.environments[0] ? c.source_branches[c.environments[0]] : undefined;
        const refParam = branch ? `&ref=${encodeURIComponent(branch)}` : '';
        return apiFetch(`/projects/${projectId}/file-preview?repo_url=${encodeURIComponent(c.source_repository)}&path=${encodeURIComponent(`.github/workflows/${ciWorkflow[c.name]}`)}${refParam}`)
          .then(() => null)
          .catch(() => c.name);
      }));
      const notFound = results.filter((n): n is string => n !== null);
      if (notFound.length > 0) {
        setErr(`O ficheiro de workflow indicado não foi encontrado para: ${notFound.join(', ')}. Confirma o nome e a branch.`);
        setLoading(false);
        return;
      }
    }

    try {
      const applications: AppImportItem[] = toImport.map(c => ({
        name: c.name,
        source_repository: c.source_repository,
        ci_workflow_file: ciWorkflow[c.name] ?? '',
        environments: c.environments
          .filter(envName => envIds[envName])
          // manifest_paths[envName] — não o c.manifest_path singular (o do primeiro
          // environment descoberto) — sem isto, todos os ApplicationEnvironments de um app
          // com >1 environment ficavam a apontar para o mesmo ficheiro do GitOps, fazendo
          // resolve_path_head devolver o mesmo commit para todos e o aviso de drift
          // disparar/persistir incorretamente em environments que não tinham nada de errado.
          .map(envName => ({ environment_id: envIds[envName], deployment_name: c.name, manifest_path: c.manifest_paths[envName] ?? c.manifest_path })),
      }));
      await apiFetch(`/projects/${projectId}/applications/import`, { method: 'POST', body: JSON.stringify({ applications }) });
      localStorage.removeItem(OB_MODE); // fim do fluxo — o próximo onboarding começa limpo
      localStorage.removeItem(OB_NEW_PROJECT_ID);
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
      <StepLabel n={7} label="Importar Applications" sub="A DevShip percorreu o repositório GitOps em busca de Deployments." />

      {scanning && <div style={{ color: 'var(--text-3)', fontSize: 13 }}>A fazer scan ao repositório…</div>}
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
                    {gitOpsUrl && (
                      <FilePreviewButton
                        repoUrl={gitOpsUrl}
                        path={c.manifest_path}
                        projectId={projectId!}
                        envOptions={c.environments.map(env => ({ name: env, path: c.manifest_paths[env] ?? c.manifest_path }))}
                      />
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {c.environments.map(env => (
                        <span key={env} className="mono" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: envIds[env] ? 'rgba(52,199,89,.12)' : 'var(--surface-2)', color: envIds[env] ? '#5dd57b' : 'var(--text-3)', border: `1px solid ${envIds[env] ? 'rgba(52,199,89,.24)' : 'var(--border)'}` }}>
                          {env}{!envIds[env] && ' · não configurado'}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isSel && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 13 }}>
                      <FormField label="CI Workflow File">
                        {workflowLoading[c.name] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-3)', padding: '9px 0' }}>
                            <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .8s linear infinite', display: 'inline-block' }} />
                            A procurar workflows no repositório…
                          </div>
                        ) : (workflowFiles[c.name]?.length ?? 0) > 1 ? (
                          <select
                            className="input-base input-mono"
                            value={ciWorkflow[c.name] ?? ''}
                            onChange={e => setCiWorkflow(p => ({ ...p, [c.name]: e.target.value }))}
                          >
                            <option value="" disabled>Escolhe um workflow…</option>
                            {workflowFiles[c.name]!.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        ) : (
                          <input
                            className="input-base input-mono"
                            value={ciWorkflow[c.name] ?? ''}
                            onChange={e => setCiWorkflow(p => ({ ...p, [c.name]: e.target.value }))}
                            placeholder={workflowFiles[c.name]?.length === 0 ? 'Não detetado — escreve o nome do ficheiro' : 'gitops-deploy.yml'}
                          />
                        )}
                        {workflowBranchErr[c.name] && (
                          <div style={{ fontSize: 11.5, color: '#ff9aaa', marginTop: 6 }}>⚠ {workflowBranchErr[c.name]}</div>
                        )}
                        {ciWorkflow[c.name] && (
                          <div style={{ marginTop: 8 }}>
                            <FilePreviewButton
                              repoUrl={c.source_repository}
                              path={`.github/workflows/${ciWorkflow[c.name]}`}
                              branch={c.environments[0] ? c.source_branches[c.environments[0]] : undefined}
                              projectId={projectId!}
                            />
                          </div>
                        )}
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
          <button onClick={scan} className="btn-secondary" style={{ display: 'block', margin: '14px auto 0', fontSize: 13, padding: '9px 18px', borderRadius: 9 }}>Refazer scan</button>
        </div>
      )}
    </>
  );
}
