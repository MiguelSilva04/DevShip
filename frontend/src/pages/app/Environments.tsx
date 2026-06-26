export default function Environments() {
  const envs = [
    { name:'DEV',     note:'sem aprovação · deployment order 1', apps:['backend','frontend'], ns:'app-dev',     gitops:'apps/dev',     branch:'main', role:null,       count:2, active:true },
    { name:'STAGING', note:'sem aprovação · deployment order 2', apps:['backend'],            ns:'app-staging', gitops:'apps/staging', branch:'main', role:null,       count:1, active:true },
    { name:'PROD',    note:'aprovação por Tech Lead · deployment order 3', apps:['backend'], ns:'app-prod',    gitops:'apps/prod',    branch:'main', role:'Tech Lead', count:1, active:true },
    { name:'QA',      note:'Sem applications associadas',          apps:[],                    ns:null,          gitops:null,           branch:null,   role:null,       count:0, active:false },
  ];

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:6 }}>
        <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:'-.01em', margin:0 }}>Environments</h1>
      </div>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 18px', maxWidth:620, lineHeight:1.6 }}>
        Ambientes configurados no projeto durante o onboarding. <span style={{ color:'var(--text-3)' }}>Só o Cloud Engineer vê esta lista completa</span> — Developers e Tech Leads acedem aos environments apenas através das applications que neles fazem deploy.
      </p>

      <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
        {envs.map(env => (
          env.active ? (
            <div key={env.name} style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 22px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:15 }}>
                <span className="mono" style={{ fontSize:13, fontWeight:600, padding:'4px 11px', borderRadius:7, background:'rgba(43,199,180,.1)', color:'var(--teal)', border:'1px solid rgba(43,199,180,.28)' }}>{env.name}</span>
                <span style={{ fontSize:12, color: env.role ? '#ecc26b' : 'var(--text-3)' }}>{env.note}</span>
                <span style={{ marginLeft:'auto', display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:'#5dd57b' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#34C759' }}></span>{env.count} application{env.count!==1?'s':''}
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'13px 22px', fontSize:12.5 }}>
                <InfoRow label="Namespace" value={env.ns!} mono />
                <InfoRow label="GitOps Path" value={env.gitops!} mono />
                <InfoRow label="Branch" value={env.branch!} mono />
                <div>
                  <span style={{ color:'var(--text-3)' }}>Required Role</span>
                  <div style={{ marginTop:3 }}>
                    {env.role
                      ? <span style={{ display:'inline-flex', padding:'2px 8px', borderRadius:6, fontSize:10.5, fontWeight:600, background:'rgba(77,156,246,.12)', color:'#7fb6f9', border:'1px solid rgba(77,156,246,.3)' }}>{env.role}</span>
                      : <span style={{ color:'var(--text-2)' }}>—</span>}
                  </div>
                </div>
              </div>
              <div style={{ borderTop:'1px solid var(--border-soft)', marginTop:15, paddingTop:13, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, color:'var(--text-3)' }}>ApplicationEnvironments:</span>
                {env.apps.map(a => (
                  <span key={a} className="mono" style={{ fontSize:11, padding:'3px 9px', borderRadius:6, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text-2)' }}>{a}</span>
                ))}
              </div>
            </div>
          ) : (
            <div key={env.name} style={{ border:'1px dashed var(--border)', borderRadius:14, background:'transparent', padding:'18px 22px', display:'flex', alignItems:'center', gap:12 }}>
              <span className="mono" style={{ fontSize:13, fontWeight:600, padding:'4px 11px', borderRadius:7, background:'transparent', color:'var(--text-3)', border:'1px dashed var(--border)' }}>{env.name}</span>
              <span style={{ fontSize:12.5, color:'var(--text-3)', flex:1 }}>Sem applications associadas — <span style={{ color:'var(--text-2)' }}>invisível para Developers e Tech Leads</span>.</span>
              <span style={{ fontSize:11, color:'var(--text-3)' }}>0 applications</span>
            </div>
          )
        ))}
      </div>

      <div style={{ display:'flex', gap:12, border:'1px solid var(--border-soft)', background:'var(--bg-2)', borderRadius:11, padding:'13px 16px', marginTop:16 }}>
        <span style={{ color:'var(--text-3)' }}>ⓘ</span>
        <span style={{ fontSize:11.5, color:'var(--text-3)', lineHeight:1.55 }}>
          Um <span style={{ color:'var(--text-2)' }}>Environment</span> só se torna visível para outras roles quando lhe é associada uma application, formando um <span className="mono" style={{ color:'var(--text-2)' }}>ApplicationEnvironment</span> com capacidade de deploy.
        </span>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label:string; value:string; mono?:boolean }) {
  return (
    <div>
      <span style={{ color:'var(--text-3)', fontSize:12.5 }}>{label}</span>
      <div className={mono ? 'mono' : ''} style={{ marginTop:3, fontSize:12.5 }}>{value}</div>
    </div>
  );
}
