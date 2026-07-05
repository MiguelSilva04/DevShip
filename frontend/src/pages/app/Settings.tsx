import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { OB_PROJ_NAME, OB_PROJECT_ID, OB_TEAM_NAME } from '../Onboarding';

interface Cluster {
  cluster_arn: string;
  cluster_name: string;
  region: string;
  eks_endpoint: string;
  created_at: string;
}

interface ProjectInfo {
  name: string;
  description: string | null;
  team_name: string;
}

interface EnvItem {
  id: string;
  name: string;
  display_name: string | null;
  requires_approval: boolean;
  approval_required_role: string | null;
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
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsErr, setCredsErr] = useState('');

  const [isArchived, setIsArchived] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveConfirmText, setArchiveConfirmText] = useState('');
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    apiFetch(`/projects/${projectId}`).then(setProject).catch(() => setProject(null));
    apiFetch(`/projects/${projectId}/cluster`)
      .then((c: Cluster) => { setCluster(c); setClusterArn(c.cluster_arn); })
      .catch((e: unknown) => setClusterErr(e instanceof Error ? e.message : 'Erro ao carregar cluster.'));
    apiFetch(`/projects/${projectId}/environments`).then(setEnvs).catch(() => setEnvs([]));
  }, [projectId]);

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
        body: JSON.stringify({ cluster_arn: clusterArn, iam_role_arn: iamRoleArn }),
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, fontSize: 12.5 }}>
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
              <span style={{ fontSize: 12, color: env.requires_approval ? '#ecc26b' : 'var(--text-3)' }}>
                {env.requires_approval
                  ? `aprovação por ${env.approval_required_role ? ROLE_LABEL[env.approval_required_role] ?? env.approval_required_role : '—'}`
                  : 'sem aprovação'}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>A aprovação é configurada por environment durante o onboarding.</div>
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
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={saveCredentials} disabled={savingCreds} className="btn-primary hover-bright" style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, fontWeight: 600, opacity: savingCreds ? .6 : 1 }}>
              {savingCreds ? 'A validar…' : 'Guardar e revalidar'}
            </button>
            <button onClick={() => setShowEditCreds(false)} style={btnGhost}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Danger zone */}
      {!isArchived && (
        <div style={{ border: '1px solid rgba(241,85,108,.3)', borderRadius: 13, background: 'rgba(241,85,108,.04)', padding: '20px 22px', marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ff8497', margin: '0 0 12px' }}>Zona de perigo</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13.5 }}>Arquivar projecto</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>O projecto deixa de estar ativo, mas o histórico operacional (deploys, eventos e versões) é preservado. Podes reativá-lo mais tarde.</div>
            </div>
            <button
              onClick={() => setShowArchiveConfirm(true)}
              style={{ fontSize: 12.5, padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(241,85,108,.5)', color: '#ff8497', cursor: 'pointer', flex: 'none' }}
            >
              Arquivar
            </button>
          </div>
        </div>
      )}

      {/* Archive confirmation modal */}
      {showArchiveConfirm && (
        <Modal onClose={() => { setShowArchiveConfirm(false); setArchiveConfirmText(''); }} danger>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#ff8497', margin: '0 0 10px' }}>Confirmar arquivamento</h2>
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
              style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, background: canArchive ? 'rgba(241,85,108,.9)' : 'rgba(241,85,108,.2)', border: 'none', color: canArchive ? '#fff' : '#ff8497', cursor: canArchive ? 'pointer' : 'default', fontWeight: 600, opacity: canArchive ? 1 : .7 }}
            >
              {archiving ? 'A arquivar…' : 'Arquivar projecto'}
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

function Modal({ children, onClose, danger }: { children: React.ReactNode; onClose: () => void; danger?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div
        style={{ background: 'var(--surface)', border: `1px solid ${danger ? 'rgba(241,85,108,.4)' : 'var(--border)'}`, borderRadius: 16, padding: '28px 30px', maxWidth: 440, width: '100%', margin: '0 16px' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
