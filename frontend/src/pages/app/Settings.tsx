import { useState } from 'react';
import { OB_PROJ_NAME } from '../Onboarding';

export default function Settings() {
  const projName = localStorage.getItem(OB_PROJ_NAME) ?? 'my-project';
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDanger, setShowDanger] = useState(false);

  const canDelete = deleteConfirm === projName;

  function handleDelete() {
    if (!canDelete) return;
    // ponytail: archive/delete endpoint is DEV-9 scope but not yet wired — noop for now
    alert('Funcionalidade de apagar projeto ainda não disponível neste MVP.');
    setShowDanger(false);
    setDeleteConfirm('');
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>Settings</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 28px' }}>Configurações do projecto. Só o Cloud Engineer pode editar estas definições.</p>

      <Section title="Projecto">
        <Field label="Nome do projecto">
          <input defaultValue={projName} style={inputStyle} readOnly />
        </Field>
      </Section>

      {/* Danger zone */}
      <div style={{ border: '1px solid rgba(241,85,108,.3)', borderRadius: 13, background: 'rgba(241,85,108,.04)', padding: '20px 22px', marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ff8497', margin: '0 0 12px' }}>Zona de perigo</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13.5 }}>Apagar projecto</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Apaga permanentemente o projecto e todos os seus dados. Esta ação é irreversível.</div>
          </div>
          <button
            onClick={() => setShowDanger(true)}
            style={{ fontSize: 12.5, padding: '8px 16px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(241,85,108,.5)', color: '#ff8497', cursor: 'pointer', flex: 'none' }}
          >
            Apagar
          </button>
        </div>
      </div>

      {/* Digit-to-match confirmation modal */}
      {showDanger && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(241,85,108,.4)', borderRadius: 16, padding: '28px 30px', maxWidth: 420, width: '100%', margin: '0 16px' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: '#ff8497', margin: '0 0 10px' }}>Confirmar eliminação</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 18px', lineHeight: 1.6 }}>
              Esta ação é <strong>irreversível</strong>. Para confirmar, escreve o nome do projeto abaixo:
            </p>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: 'var(--text)' }}>
              {projName}
            </div>
            <input
              className="input-base input-mono"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={projName}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={handleDelete}
                disabled={!canDelete}
                style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, background: canDelete ? 'rgba(241,85,108,.9)' : 'rgba(241,85,108,.2)', border: 'none', color: canDelete ? '#fff' : '#ff8497', cursor: canDelete ? 'pointer' : 'default', fontWeight: 600, opacity: canDelete ? 1 : .7 }}
              >
                Apagar projeto
              </button>
              <button onClick={() => { setShowDanger(false); setDeleteConfirm(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '10px 13px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
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
