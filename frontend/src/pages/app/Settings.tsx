import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { OB_PROJ_NAME, OB_PROJECT_ID, OB_TEAM_NAME, GitOpsPathPreviewButton } from '../Onboarding';

interface Cluster {
  cluster_arn: string;
  cluster_name: string;
  region: string;
  eks_endpoint: string;
  argocd_namespace: string;
  created_at: string;
}

interface ProjectInfo {
  name: string;
  description: string | null;
  git_ops_repository_url: string | null;
  team_name: string;
}

interface EnvItem {
  id: string;
  name: string;
  display_name: string | null;
  namespace: string | null;
  git_ops_base_path: string | null;
  source_branch: string | null;
  gitops_branch: string | null;
  argocd_application_name: string | null;
  deployment_order: number;
  requires_approval: boolean;
  approval_required_role: string | null;
}

interface AppItem {
  id: string;
  name: string;
  description: string | null;
  source_repository: string;
  ci_workflow_file: string;
}

interface ValidationResult {
  namespace_status: string;
  namespace_error: string | null;
  branch_status: string;
  branch_error: string | null;
  git_ops_path_status: string;
  git_ops_path_error: string | null;
  overall_status: string;
}

const ROLE_LABEL: Record<string, string> = {
  CLOUD_ENGINEER: 'Cloud Engineer',
  TECH_LEAD: 'Tech Lead',
  DEVELOPER: 'Developer',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function Settings() {
  const projectId = localStorage.getItem(OB_PROJECT_ID);
  const projName = localStorage.getItem(OB_PROJ_NAME) ?? 'my-project';
  const teamName = localStorage.getItem(OB_TEAM_NAME) ?? '—';

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [projectErr, setProjectErr] = useState('');

  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [clusterErr, setClusterErr] = useState('');
  const [envs, setEnvs] = useState<EnvItem[]>([]);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateMsg, setRevalidateMsg] = useState('');
  const [showEditCreds, setShowEditCreds] = useState(false);
  const [clusterArn, setClusterArn] = useState('');
  const [iamRoleArn, setIamRoleArn] = useState('');
  const [argocdNamespace, setArgocdNamespace] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsErr, setCredsErr] = useState('');

  const [editEnv, setEditEnv] = useState<EnvItem | null>(null);
  const [envForm, setEnvForm] = useState<Partial<EnvItem>>({});
  const [savingEnv, setSavingEnv] = useState(false);
  const [envErr, setEnvErr] = useState('');
  const [envValidation, setEnvValidation] = useState<ValidationResult | null>(null);

  const [apps, setApps] = useState<AppItem[]>([]);
  const [editApp, setEditApp] = useState<AppItem | null>(null);
  const [appForm, setAppForm] = useState<Partial<AppItem>>({});
  const [savingApp, setSavingApp] = useState(false);
  const [appErr, setAppErr] = useState('');

  const [isArchived, setIsArchived] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveConfirmText, setArchiveConfirmText] = useState('');
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    apiFetch(`/projects/${projectId}`).then(setProject).catch(() => setProject(null));
    apiFetch(`/projects/${projectId}/cluster`)
      .then((c: Cluster) => { setCluster(c); setClusterArn(c.cluster_arn); setArgocdNamespace(c.argocd_namespace); })
      .catch((e: unknown) => setClusterErr(e instanceof Error ? e.message : 'Erro ao carregar cluster.'));
    apiFetch(`/projects/${projectId}/environments`).then(setEnvs).catch(() => setEnvs([]));
    apiFetch(`/projects/${projectId}/applications`).then(setApps).catch(() => setApps([]));
  }, [projectId]);

  function openEditEnv(env: EnvItem) {
    setEditEnv(env);
    setEnvForm(env);
    setEnvErr('');
    setEnvValidation(null);
  }

  async function saveEnv() {
    if (!projectId || !editEnv) return;
    setSavingEnv(true); setEnvErr(''); setEnvValidation(null);
    try {
      const updated: EnvItem = await apiFetch(`/projects/${projectId}/environments/${editEnv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: envForm.display_name ?? null,
          namespace: envForm.namespace ?? null,
          git_ops_base_path: envForm.git_ops_base_path ?? null,
          source_branch: envForm.source_branch ?? null,
          gitops_branch: envForm.gitops_branch ?? null,
          argocd_application_name: envForm.argocd_application_name ?? null,
          requires_approval: envForm.requires_approval ?? false,
          approval_required_role: envForm.approval_required_role ?? null,
          deployment_order: envForm.deployment_order,
        }),
      });
      setEnvs(prev => prev.map(e => e.id === updated.id ? { ...e, ...envForm, id: updated.id } as EnvItem : e));
      setEditEnv(null);
    } catch (e: unknown) {
      if (e instanceof Error) {
        try {
          const parsed = JSON.parse(e.message) as ValidationResult;
          if (parsed.overall_status) { setEnvValidation(parsed); setEnvErr('A configuração não passou na validação — corrige os campos assinalados.'); return; }
        } catch { /* not a validation payload */ }
        setEnvErr(e.message);
      } else {
        setEnvErr('Erro ao guardar environment.');
      }
    } finally { setSavingEnv(false); }
  }

  function openEditApp(app: AppItem) {
    setEditApp(app);
    setAppForm(app);
    setAppErr('');
  }

  async function saveApp() {
    if (!editApp) return;
    setSavingApp(true); setAppErr('');
    try {
      const updated: AppItem = await apiFetch(`/applications/${editApp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: appForm.name,
          description: appForm.description ?? null,
          source_repository: appForm.source_repository,
          ci_workflow_file: appForm.ci_workflow_file,
        }),
      });
      setApps(prev => prev.map(a => a.id === updated.id ? { ...a, ...appForm, id: updated.id } as AppItem : a));
      setEditApp(null);
    } catch (e: unknown) {
      setAppErr(e instanceof Error ? e.message : 'Erro ao guardar application.');
    } finally { setSavingApp(false); }
  }

  function openEditProject() {
    setEditName(project?.name ?? projName);
    setEditDescription(project?.description ?? '');
    setProjectErr('');
    setShowEditProject(true);
  }

  async function saveProject() {
    if (!projectId) return;
    setSavingProject(true); setProjectErr('');
    try {
      await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName, description: editDescription }),
      });
      const updated: ProjectInfo = await apiFetch(`/projects/${projectId}`);
      setProject(updated);
      setShowEditProject(false);
    } catch (e: unknown) {
      setProjectErr(e instanceof Error ? e.message : 'Erro ao guardar projecto.');
    } finally { setSavingProject(false); }
  }

  async function revalidate() {
    if (!projectId) return;
    setRevalidating(true); setRevalidateMsg('');
    try {
      const c: Cluster = await apiFetch(`/projects/${projectId}/cluster/revalidate`, { method: 'POST' });
      setCluster(c);
      setRevalidateMsg('Ligação validada com sucesso.');
    } catch (e: unknown) {
      setRevalidateMsg(e instanceof Error ? e.message : 'Falha ao revalidar ligação.');
    } finally { setRevalidating(false); }
  }

  async function saveCredentials() {
    if (!projectId) return;
    setSavingCreds(true); setCredsErr('');
    try {
      const c: Cluster = await apiFetch(`/projects/${projectId}/cluster`, {
        method: 'PATCH',
        body: JSON.stringify({ cluster_arn: clusterArn, iam_role_arn: iamRoleArn, argocd_namespace: argocdNamespace || undefined }),
      });
      setCluster(c);
      setShowEditCreds(false);
    } catch (e: unknown) {
      setCredsErr(e instanceof Error ? e.message : 'Erro ao guardar credenciais.');
    } finally { setSavingCreds(false); }
  }

  const canArchive = archiveConfirmText === projName;

  async function archive() {
    if (!projectId || !canArchive) return;
    setArchiving(true);
    try {
      await apiFetch(`/projects/${projectId}/archive`, { method: 'POST' });
      setIsArchived(true);
      setShowArchiveConfirm(false);
      setArchiveConfirmText('');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao arquivar projeto.');
    } finally { setArchiving(false); }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>Settings</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 28px' }}>Configurações do projecto. Só o Cloud Engineer pode editar estas definições.</p>

      {isArchived && (
        <div style={{ display: 'flex', gap: 9, border: '1px solid rgba(236,194,107,.35)', background: 'rgba(236,194,107,.08)', borderRadius: 9, padding: '10px 13px', marginBottom: 20 }}>
          <span style={{ color: '#ecc26b' }}>ⓘ</span>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Este projecto está arquivado. O histórico operacional continua disponível.</span>
        </div>
      )}

      {/* Project identity */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Projeto</span>
          <button onClick={openEditProject} style={{ fontSize: 12, padding: '6px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>
            Editar informações
          </button>
        </div>
        <div style={{ display: 'flex', gap: 40, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Team</div>
            <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{teamName}</div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Projeto</div>
            <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{project?.name ?? projName}</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{project?.description || 'Sem descrição.'}</div>
      </div>

      {/* Edit project modal */}
      {showEditProject && (
        <Modal onClose={() => setShowEditProject(false)}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 14px' }}>Editar informações do projecto</h2>
          {projectErr && <div style={{ fontSize: 12, color: '#ff9aaa', marginBottom: 10 }}>{projectErr}</div>}
          <Field label="Nome do projecto">
            <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Descrição">
            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={saveProject} disabled={savingProject || !editName.trim()} className="btn-primary hover-bright" style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, fontWeight: 600, opacity: (savingProject || !editName.trim()) ? .6 : 1 }}>
              {savingProject ? 'A guardar…' : 'Guardar'}
            </button>
            <button onClick={() => setShowEditProject(false)} style={btnGhost}>Cancelar</button>
          </div>
        </Modal>
      )}

      <Section title="Cluster">
        {clusterErr && <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{clusterErr}</div>}
        {cluster && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div className="mono" style={{ flex: 1, fontSize: 12.5, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                {cluster.cluster_arn}
              </div>
              <button onClick={() => navigator.clipboard.writeText(cluster.cluster_arn)} style={btnSecondary}>Copiar</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, fontSize: 12.5 }}>
              <div>
                <div style={{ color: 'var(--text-3)' }}>Região</div>
                <div className="mono" style={{ marginTop: 3 }}>{cluster.region}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)' }}>Estado</div>
                <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34C759' }} />
                  Ligado
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)' }}>ArgoCD namespace</div>
                <div className="mono" style={{ marginTop: 3 }}>{cluster.argocd_namespace}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)' }}>Última validação</div>
                <div className="mono" style={{ marginTop: 3 }}>{formatDate(cluster.created_at)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={revalidate} disabled={revalidating} style={{ ...btnSecondary, opacity: revalidating ? .6 : 1 }}>
                {revalidating ? 'A revalidar…' : 'Revalidar ligação'}
              </button>
              <button onClick={() => setShowEditCreds(true)} style={btnSecondary}>Editar credenciais</button>
            </div>
            {revalidateMsg && <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{revalidateMsg}</div>}
          </>
        )}
      </Section>

      {envs.length > 0 && (
        <Section title="Environments">
          {envs.map(env => (
            <div key={env.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{(env.display_name || env.name).toUpperCase()}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: env.requires_approval ? '#ecc26b' : 'var(--text-3)' }}>
                  {env.requires_approval
                    ? `aprovação por ${env.approval_required_role ? ROLE_LABEL[env.approval_required_role] ?? env.approval_required_role : '—'}`
                    : 'sem aprovação'}
                </span>
                <button onClick={() => openEditEnv(env)} style={{ ...btnSecondary, padding: '5px 11px', fontSize: 11.5 }}>Editar</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {apps.length > 0 && (
        <Section title="Applications">
          {apps.map(app => (
            <div key={app.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{app.name}</span>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{app.source_repository}</div>
              </div>
              <button onClick={() => openEditApp(app)} style={{ ...btnSecondary, padding: '5px 11px', fontSize: 11.5 }}>Editar</button>
            </div>
          ))}
        </Section>
      )}

      {/* Edit credentials modal */}
      {showEditCreds && (
        <Modal onClose={() => setShowEditCreds(false)}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 14px' }}>Editar credenciais do cluster</h2>
          {credsErr && <div style={{ fontSize: 12, color: '#ff9aaa', marginBottom: 10 }}>{credsErr}</div>}
          <Field label="Cluster ARN">
            <input value={clusterArn} onChange={e => setClusterArn(e.target.value)} style={inputStyle} className="mono" />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="IAM Role ARN">
            <input value={iamRoleArn} onChange={e => setIamRoleArn(e.target.value)} style={inputStyle} className="mono" />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="ArgoCD namespace">
            <input value={argocdNamespace} onChange={e => setArgocdNamespace(e.target.value)} style={inputStyle} className="mono" placeholder="argocd" />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={saveCredentials} disabled={savingCreds} className="btn-primary hover-bright" style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, fontWeight: 600, opacity: savingCreds ? .6 : 1 }}>
              {savingCreds ? 'A validar…' : 'Guardar e revalidar'}
            </button>
            <button onClick={() => setShowEditCreds(false)} style={btnGhost}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Edit environment modal */}
      {editEnv && (
        <Modal onClose={() => setEditEnv(null)}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Editar {editEnv.display_name || editEnv.name}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px' }}>Guardar revalida namespace, branch e caminho GitOps antes de aplicar.</p>
          {envErr && <div style={{ fontSize: 12, color: '#ff9aaa', marginBottom: 10 }}>{envErr}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, overflowY: 'auto', paddingRight: 2 }}>
            <Field label="Nome a mostrar">
              <input value={envForm.display_name ?? ''} onChange={e => setEnvForm(f => ({ ...f, display_name: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Namespace">
              <input value={envForm.namespace ?? ''} onChange={e => setEnvForm(f => ({ ...f, namespace: e.target.value }))} style={inputStyle} className="mono" />
              {envValidation && envValidation.namespace_status === 'INVALID' && (
                <div style={{ fontSize: 11.5, color: '#ff9aaa', marginTop: 5 }}>{envValidation.namespace_error}</div>
              )}
            </Field>
            <Field label="GitOps branch">
              <input value={envForm.gitops_branch ?? ''} onChange={e => setEnvForm(f => ({ ...f, gitops_branch: e.target.value }))} style={inputStyle} className="mono" />
              {envValidation && envValidation.branch_status === 'INVALID' && (
                <div style={{ fontSize: 11.5, color: '#ff9aaa', marginTop: 5 }}>{envValidation.branch_error}</div>
              )}
            </Field>
            <Field label="GitOps path">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={envForm.git_ops_base_path ?? ''} onChange={e => setEnvForm(f => ({ ...f, git_ops_base_path: e.target.value }))} style={{ ...inputStyle, flex: 1 }} className="mono" />
                {project?.git_ops_repository_url && envForm.git_ops_base_path && (
                  <GitOpsPathPreviewButton repoUrl={project.git_ops_repository_url} basePath={envForm.git_ops_base_path} projectId={projectId!} />
                )}
              </div>
              {envValidation && envValidation.git_ops_path_status === 'INVALID' && (
                <div style={{ fontSize: 11.5, color: '#ff9aaa', marginTop: 5 }}>{envValidation.git_ops_path_error}</div>
              )}
            </Field>
            <Field label="Source branch">
              <input value={envForm.source_branch ?? ''} onChange={e => setEnvForm(f => ({ ...f, source_branch: e.target.value }))} style={inputStyle} className="mono" />
            </Field>
            <Field label="ArgoCD application">
              <input value={envForm.argocd_application_name ?? ''} onChange={e => setEnvForm(f => ({ ...f, argocd_application_name: e.target.value }))} style={inputStyle} className="mono" placeholder="demo-app-dev" />
            </Field>
            <Field label="Deployment order">
              <input type="number" value={envForm.deployment_order ?? 0} onChange={e => setEnvForm(f => ({ ...f, deployment_order: Number(e.target.value) }))} style={inputStyle} />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'var(--text-2)' }}>
              <input type="checkbox" checked={envForm.requires_approval ?? false} onChange={e => setEnvForm(f => ({ ...f, requires_approval: e.target.checked }))} style={{ accentColor: 'var(--teal)' }} />
              Requer aprovação
            </label>
            {envForm.requires_approval && (
              <Field label="Role que aprova">
                <select
                  value={envForm.approval_required_role ?? ''}
                  onChange={e => setEnvForm(f => ({ ...f, approval_required_role: e.target.value || null }))}
                  className="select-base"
                >
                  <option value="">—</option>
                  <option value="TECH_LEAD">Tech Lead</option>
                  <option value="CLOUD_ENGINEER">Cloud Engineer</option>
                </select>
              </Field>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={saveEnv} disabled={savingEnv} className="btn-primary hover-bright" style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, fontWeight: 600, opacity: savingEnv ? .6 : 1 }}>
              {savingEnv ? 'A validar…' : 'Guardar e validar'}
            </button>
            <button onClick={() => setEditEnv(null)} style={btnGhost}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Edit application modal */}
      {editApp && (
        <Modal onClose={() => setEditApp(null)}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Editar {editApp.name}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px' }}>Se o repositório mudar, é confirmado no GitHub antes de aplicar.</p>
          {appErr && <div style={{ fontSize: 12, color: '#ff9aaa', marginBottom: 10 }}>{appErr}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Nome">
              <input value={appForm.name ?? ''} onChange={e => setAppForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Descrição">
              <textarea value={appForm.description ?? ''} onChange={e => setAppForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
            <Field label="Repositório (source)">
              <input value={appForm.source_repository ?? ''} onChange={e => setAppForm(f => ({ ...f, source_repository: e.target.value }))} style={inputStyle} className="mono" />
            </Field>
            <Field label="CI workflow file">
              <input value={appForm.ci_workflow_file ?? ''} onChange={e => setAppForm(f => ({ ...f, ci_workflow_file: e.target.value }))} style={inputStyle} className="mono" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={saveApp} disabled={savingApp} className="btn-primary hover-bright" style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, fontWeight: 600, opacity: savingApp ? .6 : 1 }}>
              {savingApp ? 'A validar…' : 'Guardar'}
            </button>
            <button onClick={() => setEditApp(null)} style={btnGhost}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Archive zone */}
      {!isArchived && (
        <div style={{ border: '1px solid rgba(236,194,107,.35)', borderRadius: 13, background: 'rgba(236,194,107,.05)', padding: '20px 22px', marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ecc26b', margin: '0 0 12px' }}>Arquivar projeto</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13.5 }}>O projeto deixa de estar ativo, mas o histórico operacional (deploys, eventos e versões) é preservado. Podes reativá-lo mais tarde.</div>
            </div>
            <button
              onClick={() => setShowArchiveConfirm(true)}
              style={{ fontSize: 12.5, padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(236,194,107,.5)', color: '#ecc26b', cursor: 'pointer', flex: 'none' }}
            >
              Arquivar projeto
            </button>
          </div>
        </div>
      )}

      {/* Archive confirmation modal */}
      {showArchiveConfirm && (
        <Modal onClose={() => { setShowArchiveConfirm(false); setArchiveConfirmText(''); }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#ecc26b', margin: '0 0 10px' }}>Confirmar arquivamento</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 18px', lineHeight: 1.6 }}>
            O projecto deixa de estar ativo. Para confirmar, escreve o nome do projeto abaixo:
          </p>
          <div className="mono" style={{ fontSize: 13, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: 'var(--text)' }}>
            {projName}
          </div>
          <input
            className="input-base input-mono"
            value={archiveConfirmText}
            onChange={e => setArchiveConfirmText(e.target.value)}
            placeholder={projName}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              onClick={archive}
              disabled={!canArchive || archiving}
              style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, background: canArchive ? 'rgba(236,194,107,.9)' : 'rgba(236,194,107,.2)', border: 'none', color: canArchive ? '#1a1200' : '#ecc26b', cursor: canArchive ? 'pointer' : 'default', fontWeight: 600, opacity: canArchive ? 1 : .7 }}
            >
              {archiving ? 'A arquivar…' : 'Arquivar projeto'}
            </button>
            <button onClick={() => { setShowArchiveConfirm(false); setArchiveConfirmText(''); }} style={btnGhost}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '10px 13px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};

const btnSecondary: React.CSSProperties = {
  fontSize: 12, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 12, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, margin: '0 0 14px', paddingBottom: 10, borderBottom: '1px solid var(--border-soft)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 30px', maxWidth: 440, width: '100%', margin: '0 16px' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
