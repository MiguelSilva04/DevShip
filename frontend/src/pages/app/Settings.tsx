import { useState } from 'react';

export default function Settings() {
  const [projectName, setProjectName] = useState('my-project');
  const [clusterEndpoint, setClusterEndpoint] = useState('https://k8s.horizonlabs.internal');
  const [gitopsRepo, setGitopsRepo] = useState('github.com/company/gitops-config');
  const [gitopsBranch, setGitopsBranch] = useState('main');
  const [notifySlack, setNotifySlack] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T00…');

  return (
    <div style={{ maxWidth:640 }}>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 6px' }}>Settings</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 28px' }}>Configurações do projecto. Só o Cloud Engineer pode editar estas definições.</p>

      <Section title="Projecto">
        <Field label="Nome do projecto">
          <input value={projectName} onChange={e => setProjectName(e.target.value)} style={inputStyle} />
        </Field>
      </Section>

      <Section title="Cluster Kubernetes">
        <Field label="Endpoint">
          <input value={clusterEndpoint} onChange={e => setClusterEndpoint(e.target.value)} style={inputStyle} className="mono" />
        </Field>
        <Field label="Provider">
          <div style={{ display:'flex', gap:8 }}>
            {['AWS EKS','GCP GKE','Azure AKS','Self-managed'].map(p => (
              <label key={p} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, cursor:'pointer' }}>
                <input type="radio" name="provider" defaultChecked={p==='AWS EKS'} style={{ accentColor:'var(--teal)' }} />
                {p}
              </label>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="GitOps">
        <Field label="Repositório">
          <input value={gitopsRepo} onChange={e => setGitopsRepo(e.target.value)} style={inputStyle} className="mono" />
        </Field>
        <Field label="Branch">
          <input value={gitopsBranch} onChange={e => setGitopsBranch(e.target.value)} style={inputStyle} className="mono" />
        </Field>
      </Section>

      <Section title="Notificações">
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <ToggleRow label="Notificações Slack" value={notifySlack} onChange={setNotifySlack} />
          {notifySlack && (
            <Field label="Webhook URL">
              <input value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} style={inputStyle} className="mono" />
            </Field>
          )}
          <ToggleRow label="Notificações por email" value={notifyEmail} onChange={setNotifyEmail} />
        </div>
      </Section>

      <div style={{ display:'flex', gap:10, marginTop:6 }}>
        <button className="btn-primary hover-bright" style={{ fontSize:13, padding:'10px 20px', borderRadius:9, fontWeight:600 }}>Guardar alterações</button>
      </div>

      {/* Danger zone */}
      <div style={{ border:'1px solid rgba(241,85,108,.3)', borderRadius:13, background:'rgba(241,85,108,.04)', padding:'20px 22px', marginTop:36 }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:'#ff8497', margin:'0 0 12px' }}>Zona de perigo</h3>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13.5 }}>Apagar projecto</div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>Apaga permanentemente o projecto e todos os seus dados. Esta ação é irreversível.</div>
          </div>
          <button style={{ fontSize:12.5, padding:'8px 16px', borderRadius:9, background:'transparent', border:'1px solid rgba(241,85,108,.5)', color:'#ff8497', cursor:'pointer' }}>Apagar</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width:'100%', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10,
  padding:'10px 13px', color:'var(--text)', fontSize:13, fontFamily:'inherit', boxSizing:'border-box',
};

function Section({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:24 }}>
      <h2 style={{ fontSize:12, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 14px', paddingBottom:10, borderBottom:'1px solid var(--border-soft)' }}>{title}</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize:12.5, color:'var(--text-2)', display:'block', marginBottom:7 }}>{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label:string; value:boolean; onChange:(v:boolean)=>void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <span style={{ fontSize:13 }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{ width:42, height:24, borderRadius:12, background: value ? 'var(--teal)' : 'var(--surface-3)', border:'none', cursor:'pointer', position:'relative', transition:'background .2s', flex:'none' }}
      >
        <span style={{ position:'absolute', top:3, left: value ? 21 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .2s' }} />
      </button>
    </div>
  );
}
