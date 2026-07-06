import { useState } from 'react';
import { apiFetch } from '../api/client';

export const GITHUB_IDENTITY_ERROR = 'Configura a tua identidade GitHub antes de continuar.';

interface Props {
  onConfigured: () => void;
}

export default function GithubIdentityPrompt({ onConfigured }: Props) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      await apiFetch('/users/me/github-identity', {
        method: 'PATCH',
        body: JSON.stringify({ github_username: username, github_email: email }),
      });
      setOpen(false);
      onConfigured();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao guardar identidade GitHub.');
    } finally { setSaving(false); }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(241,85,108,.4)', background: 'transparent', color: '#ff8497', cursor: 'pointer', flex: 'none', marginLeft: 10 }}
      >
        Configurar
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setOpen(false)}>
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 30px', maxWidth: 420, width: '100%', margin: '0 16px' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px' }}>Identidade GitHub</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 18px', lineHeight: 1.6 }}>
              Necessária para fazer deploy ou rollback — usada para confirmar que és colaborador do repositório.
            </p>
            {err && <div style={{ fontSize: 12, color: '#ff9aaa', marginBottom: 10 }}>{err}</div>}
            <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>Username GitHub</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="ex: miguelsilva"
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }}
            />
            <label style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'block', marginBottom: 7 }}>Email associado ao GitHub</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ex: miguel@github-noreply.com"
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={save}
                disabled={saving || !username.trim() || !email.trim()}
                className="btn-primary hover-bright"
                style={{ fontSize: 13, padding: '10px 18px', borderRadius: 9, fontWeight: 600, opacity: (saving || !username.trim() || !email.trim()) ? .6 : 1 }}
              >
                {saving ? 'A guardar…' : 'Guardar'}
              </button>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
