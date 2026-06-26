import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

export default function Approval() {
  const { app='backend', env='prod' } = useParams<{ app:string; env:string }>();
  const nav = useNavigate();
  const { user } = useUser();
  const isTechLead = user?.role === 'tech';
  const [rejectNote, setRejectNote] = useState('');
  const [action, setAction] = useState<'approved'|'rejected'|null>(null);

  if (action) {
    return (
      <div style={{ maxWidth:560, textAlign:'center', paddingTop:60 }}>
        <div style={{ width:52, height:52, borderRadius:'50%', margin:'0 auto 18px', background: action==='approved' ? 'rgba(52,199,89,.14)' : 'rgba(241,85,108,.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>
          {action==='approved' ? '✓' : '✕'}
        </div>
        <h2 style={{ fontSize:20, fontWeight:600, margin:'0 0 10px', color: action==='approved' ? '#5dd57b' : '#ff8497' }}>
          Deploy {action==='approved' ? 'aprovado' : 'rejeitado'}
        </h2>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, margin:'0 0 22px' }}>
          {action==='approved'
            ? 'O deploy foi aprovado e está a ser executado. Podes acompanhar o progresso em Execução.'
            : 'O deploy foi rejeitado. O Developer será notificado.'}
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          {action==='approved' && <button className="btn-primary" onClick={() => nav(`/app/${app}/${env}/exec`)} style={{ fontSize:13, padding:'9px 18px', borderRadius:9 }}>Ver execução</button>}
          <button onClick={() => nav('/app/approvals')} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--text-2)', fontSize:13, padding:'9px 18px', borderRadius:9, cursor:'pointer' }}>Voltar aos approvals</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:660 }}>
      <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{app} / {env.toUpperCase()} / approval</div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 20px' }}>Pedido de Aprovação de Deploy</h1>

      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 22px', marginBottom:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'13px 28px', fontSize:13 }}>
          {[
            ['Application', app],
            ['Environment', env.toUpperCase()],
            ['Commit', 'a3f5b8c'],
            ['Versão atual', 'v1.2.1'],
            ['Versão destino', 'v1.2.3'],
            ['Pedido por', 'bob.johnson'],
            ['Data do pedido', '2026-06-12 16:05'],
          ].map(([k,v]) => (
            <div key={k}>
              <span style={{ color:'var(--text-3)', fontSize:12 }}>{k}</span>
              <div className="mono" style={{ marginTop:3 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'18px 22px', marginBottom:14 }}>
        <div style={{ fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:12 }}>Commit</div>
        <div className="mono" style={{ fontSize:12.5 }}>fix: handle null pointer in auth middleware</div>
        <div className="mono" style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>a3f5b8c · john.doe · 2026-06-12 15:47</div>
      </div>

      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'18px 22px', marginBottom:14 }}>
        <div style={{ fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:10 }}>Nota do Developer</div>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, margin:0 }}>Hotfix urgente para o bug que estava a causar 500s na autenticação. Já testado em DEV e STAGING.</p>
      </div>

      {isTechLead ? (
        <>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12.5, color:'var(--text-2)', display:'block', marginBottom:7 }}>Nota de rejeição <span style={{ color:'var(--text-3)' }}>(só se rejeitar)</span></label>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Motivo da rejeição…" rows={3} style={{ width:'100%', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 14px', color:'var(--text)', fontSize:13, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-primary hover-bright" onClick={() => setAction('approved')} style={{ fontSize:13, padding:'10px 20px', borderRadius:9, fontWeight:600 }}>Aprovar deploy</button>
            <button onClick={() => setAction('rejected')} style={{ background:'rgba(241,85,108,.1)', border:'1px solid rgba(241,85,108,.3)', color:'#ff8497', fontSize:13, padding:'10px 20px', borderRadius:9, cursor:'pointer', fontWeight:600 }}>Rejeitar</button>
          </div>
        </>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', border:'1px solid rgba(224,169,59,.3)', borderRadius:12, background:'rgba(224,169,59,.06)', fontSize:13, color:'#ecc26b' }}>
          <span>⏳</span>
          <span>A aguardar aprovação de um <strong>Tech Lead</strong>. Receberás uma notificação quando for decidido.</span>
        </div>
      )}
    </div>
  );
}
