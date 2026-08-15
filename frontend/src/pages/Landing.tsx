import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKey } from '../context/LanguageContext';

function pipelineSteps(t: (key: TranslationKey) => string) {
  return [
    { idx:'01', kind:'TRIGGER',   title:t('landing.pStep1Title'), note:t('landing.pStep1Note'), border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'DeployRequest', hasEdge:true },
    { idx:'02', kind:'VALIDATE',  title:t('landing.pStep2Title'), note:t('landing.pStep2Note'), border:'rgba(43,199,180,.4)', bg:'rgba(43,199,180,.07)', titleCol:'var(--teal)', edge:'WorkflowPayload', hasEdge:true },
    { idx:'03', kind:'BUILD',     title:t('landing.pStep3Title'), note:t('landing.pStep3Note'), border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'ImageTag', hasEdge:true },
    { idx:'04', kind:'GITOPS',    title:t('landing.pStep4Title'), note:t('landing.pStep4Note'), border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'GitCommit', hasEdge:true },
    { idx:'05', kind:'SYNC',      title:t('landing.pStep5Title'), note:t('landing.pStep5Note'), border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'ApplyManifest', hasEdge:true },
    { idx:'06', kind:'RUNTIME',   title:t('landing.pStep6Title'), note:t('landing.pStep6Note'), border:'var(--border)', bg:'var(--surface)', titleCol:'var(--text)', edge:'HealthStatus', hasEdge:true },
    { idx:'07', kind:'OBSERVE',   title:t('landing.pStep7Title'), note:t('landing.pStep7Note'), border:'rgba(43,199,180,.4)', bg:'rgba(43,199,180,.07)', titleCol:'var(--teal)', edge:'', hasEdge:false },
  ];
}

export default function Landing() {
  const nav = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const pipeline = pipelineSteps(t);
  return (
    <div className="landing-bg" style={{ minHeight:'100vh', color:'var(--text)', fontFamily:"'Geist','Inter',system-ui,sans-serif" }}>
      {/* NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', gap:18, padding:'0 26px', height:58, background:'var(--topbar-bg)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--line-2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:26, height:26 }} />
          <span style={{ fontSize:15.5, fontWeight:600, letterSpacing:'-.01em' }}>DevShip</span>
          <span className="mono" style={{ fontSize:10, fontWeight:600, letterSpacing:'.22em', color:'var(--teal)', background:'rgba(43,199,180,.1)', border:'1px solid rgba(43,199,180,.3)', borderRadius:5, padding:'3px 8px 3px 9px', marginLeft:4 }}>IDP</span>
        </div>
        <div className="landing-nav-links" style={{ display:'flex', gap:24, marginLeft:26, fontSize:13, color:'var(--text-2)' }}>
          <a href="#problema" className="hover-teal">{t('landing.navProblem')}</a>
          <a href="#pipeline" className="hover-teal">{t('landing.navPipeline')}</a>
          <a href="#prerequisitos" className="hover-teal">{t('landing.navPrereqs')}</a>
          <a href="#traducao" className="hover-teal">{t('landing.navTranslation')}</a>
          <a href="#estados"  className="hover-teal">{t('landing.navStates')}</a>
          <a href="#roles"    className="hover-teal">{t('landing.navRoles')}</a>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ display:'inline-flex', border:'1px solid var(--line-2)', borderRadius:8, padding:2 }}>
            <button
              onClick={() => setLanguage('pt')}
              style={{ padding:'4px 9px', borderRadius:6, border:'none', cursor:'pointer', fontSize:11.5, fontWeight:600, background: language === 'pt' ? 'var(--surface-3)' : 'transparent', color: language === 'pt' ? 'var(--text)' : 'var(--text-3)' }}
            >
              PT
            </button>
            <button
              onClick={() => setLanguage('en')}
              style={{ padding:'4px 9px', borderRadius:6, border:'none', cursor:'pointer', fontSize:11.5, fontWeight:600, background: language === 'en' ? 'var(--surface-3)' : 'transparent', color: language === 'en' ? 'var(--text)' : 'var(--text-3)' }}
            >
              EN
            </button>
          </div>
          <button
            onClick={toggleTheme}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:8, border:'1px solid var(--line-2)', background:'transparent', cursor:'pointer', fontSize:11.5, fontWeight:500, color:'var(--text)' }}
          >
            {theme === 'dark' ? '🌙' : '☀️'} {theme === 'dark' ? t('common.dark') : t('common.light')}
          </button>
          <span onClick={() => nav('/login')}    style={{ fontSize:13, color:'var(--text-2)', cursor:'pointer' }} className="hover-teal">{t('landing.login')}</span>
          <span onClick={() => nav('/register')} className="btn-primary hover-bright" style={{ fontSize:13, fontWeight:600, padding:'8px 16px', borderRadius:7, cursor:'pointer' }}>{t('landing.createAccount')}</span>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div className="responsive-grid" style={{ display:'grid', gridTemplateColumns:'1.15fr .85fr', borderLeft:'1px solid var(--line-2)', borderRight:'1px solid var(--line-2)' }}>
          <div className="responsive-border-bottom landing-section" style={{ padding:'64px 44px 56px', borderRight:'1px solid var(--line-2)' }}>
            <div className="mono" style={{ fontSize:11.5, letterSpacing:'.14em', color:'var(--teal)', marginBottom:22 }}>{t('landing.heroEyebrow')}</div>
            <h1 style={{ fontSize:'clamp(32px, 8vw, 48px)', lineHeight:1.06, fontWeight:700, letterSpacing:'-.03em', margin:0 }}>
              {t('landing.heroTitle1')}<br />
              <span style={{ color:'var(--text-3)' }}>{t('landing.heroTitle2')}</span>
            </h1>
            <p style={{ fontSize:16, lineHeight:1.65, color:'var(--text-2)', maxWidth:460, margin:'22px 0 0' }}>
              {t('landing.heroBody')}
            </p>
            <div style={{ display:'flex', gap:11, marginTop:30, flexWrap:'wrap' }}>
              <span onClick={() => nav('/register')} className="btn-primary hover-bright" style={{ fontSize:14, fontWeight:600, padding:'12px 22px', borderRadius:8, cursor:'pointer' }}>{t('landing.createAccount')}</span>
              <span onClick={() => nav('/login')}    className="btn-secondary"            style={{ fontSize:14, fontWeight:500, padding:'12px 20px', borderRadius:8, cursor:'pointer' }}>{t('landing.login')}</span>
              <a href="#pipeline"                                                          style={{ fontSize:14, fontWeight:500, color:'var(--text)', border:'1px solid var(--line-2)', padding:'12px 20px', borderRadius:8 }} className="hover-teal">{t('landing.heroViewArchitecture')}</a>
            </div>
          </div>
          <div style={{ padding:30, display:'flex', flexDirection:'column', justifyContent:'center', background:'var(--panel-2)' }}>
            <div className="mono" style={{ fontSize:10.5, color:'var(--text-3)', letterSpacing:'.1em', marginBottom:14 }}>{t('landing.heroLiveComment')}</div>
            <div style={{ border:'1px solid var(--line-2)', borderRadius:10, background:'var(--panel)', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 13px', borderBottom:'1px solid var(--line)' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)' }}></span>
                <span className="mono" style={{ fontSize:11, color:'var(--text-2)' }}>backend</span>
              </div>
              <div className="mono" style={{ fontSize:11, color:'var(--text-2)', padding:'6px 0' }}>
                {[['DEV','var(--green)',t('landing.heroHealthy')],['STAGING','var(--amber)',t('landing.heroDeployInProgress')],['PROD','var(--green)',t('landing.heroHealthy')]].map(([env,c,s]) => (
                  <div key={env} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 13px' }}>
                    <span style={{ width:54, color:'var(--text-3)' }}>{env}</span>
                    <span style={{ flex:1, color:c as string }}>{s}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop:'1px solid var(--line)', padding:'9px 13px', display:'flex', alignItems:'center', gap:8 }}>
                <span className="mono" style={{ fontSize:10, color:'var(--text-3)' }}>probe</span>
                <span className="mono" style={{ fontSize:10, color:'var(--green)' }}>startup✓</span>
                <span className="mono" style={{ fontSize:10, color:'var(--green)' }}>ready✓</span>
                <span className="mono" style={{ fontSize:10, color:'var(--green)' }}>live✓</span>
              </div>
            </div>
            <div className="mono" style={{ fontSize:10, color:'var(--text-3)', marginTop:12, lineHeight:1.6 }}>{t('landing.heroSourceNote')}</div>
          </div>
        </div>
        <div className="mono" style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-3)', border:'1px solid var(--line-2)', borderTop:'none', padding:'8px 16px' }}>
          <span>{t('landing.heroFasterDeploy')}</span><span style={{ color:'var(--text-2)' }}>·</span><span style={{ color:'var(--teal)' }}>{t('landing.heroKeepsControl')}</span>
        </div>
      </header>

      {/* PROBLEMA */}
      <section id="problema" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div className="landing-section" style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px' }}>
          <SectionLabel n="01" label={t('landing.problemLabel')} />
          <h2 style={{ fontSize:'clamp(22px, 5vw, 30px)', fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>{t('landing.problemTitle')}</h2>
          <p style={{ fontSize:14.5, color:'var(--text-2)', lineHeight:1.7, maxWidth:600, margin:'16px 0 0' }}>{t('landing.problemBody')}</p>
          <figure style={{ margin:'30px 0 0', border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden', background:'var(--panel)' }}>
            <figcaption className="mono" style={{ display:'flex', alignItems:'center', gap:10, fontSize:10.5, color:'var(--text-3)', padding:'9px 14px', borderBottom:'1px solid var(--line)' }}>
              <span style={{ color:'var(--teal)' }}>FIG.01</span><span>{t('landing.problemFigFile')}</span><span style={{ marginLeft:'auto', color:'var(--text-2)' }}>{t('landing.problemFigCaption')}</span>
            </figcaption>
            <img src={language === 'pt' ? '/landing-dev_pt.png' : '/landing-dev_eng.png'} alt={t('landing.problemFigCaption')} style={{ width:'100%', display:'block' }} />
          </figure>
        </div>
      </section>

      {/* PIPELINE */}
      <section id="pipeline" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div className="landing-section" style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px', background:'var(--panel-2)' }}>
          <SectionLabel n="02" label={t('landing.pipelineLabel')} />
          <h2 style={{ fontSize:'clamp(22px, 5vw, 30px)', fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>{t('landing.pipelineTitle')}</h2>
          <p style={{ fontSize:14.5, color:'var(--text-2)', lineHeight:1.7, maxWidth:600, margin:'16px 0 30px' }}>{t('landing.pipelineBody')}</p>
          <div>
            {pipeline.map(n => (
              <div key={n.idx} style={{ display:'flex', gap:16 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:'none', width:34 }}>
                  <div className="mono" style={{ width:34, height:34, borderRadius:9, border:`1px solid ${n.border}`, background:n.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:n.titleCol }}>{n.idx}</span>
                  </div>
                  {n.hasEdge && <span style={{ width:1, flex:1, minHeight:26, background:'var(--line-2)', margin:'4px 0' }}></span>}
                </div>
                <div style={{ flex:1, paddingBottom: n.hasEdge ? 4 : 0 }}>
                  <div style={{ border:`1px solid ${n.border}`, borderRadius:10, background:n.bg, padding:'13px 16px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                    <span className="mono" style={{ fontSize:9.5, letterSpacing:'.1em', color:'var(--text-3)', width:72, flex:'none' }}>{n.kind}</span>
                    <span style={{ fontSize:14, fontWeight:600, color:n.titleCol, width:140, flex:'none' }}>{n.title}</span>
                    <span style={{ fontSize:12.5, color:'var(--text-2)' }}>{n.note}</span>
                  </div>
                  {n.hasEdge && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0 0 3px' }}>
                      <span style={{ color:'var(--text-3)', fontSize:11 }}>↓</span>
                      <span className="mono" style={{ fontSize:10, color:'var(--text-3)' }}>{t('landing.pipelineDeliver')}</span>
                      <span className="mono" style={{ fontSize:10, color:'var(--teal)' }}>{n.edge}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRÉ-REQUISITOS */}
      <section id="prerequisitos" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div className="landing-section" style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px', background:'var(--panel-2)' }}>
          <SectionLabel n="03" label={t('landing.prereqsLabel')} />
          <h2 style={{ fontSize:'clamp(22px, 5vw, 30px)', fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>{t('landing.prereqsTitle')}</h2>
          <p style={{ fontSize:15, color:'var(--text-2)', lineHeight:1.6, maxWidth:600, margin:'10px 0 0', fontWeight:500 }}>{t('landing.prereqsLead')}</p>
          <p style={{ fontSize:14.5, color:'var(--text-2)', lineHeight:1.7, maxWidth:600, margin:'16px 0 0' }}>
            {t('landing.prereqsBody')}
          </p>
          <figure style={{ margin:'30px 0 0', border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden', background:'var(--panel)' }}>
            <figcaption className="mono" style={{ display:'flex', alignItems:'center', gap:10, fontSize:10.5, color:'var(--text-3)', padding:'9px 14px', borderBottom:'1px solid var(--line)' }}>
              <span style={{ color:'var(--teal)' }}>FIG.03</span><span>{t('landing.prereqsFigFile')}</span><span style={{ marginLeft:'auto', color:'var(--text-2)' }}>{t('landing.prereqsFigCaption')}</span>
            </figcaption>
            <img src={language === 'pt' ? '/landing_req_pt.png' : '/landing_req_eng.png'} alt={t('landing.prereqsFigCaption')} style={{ width:'100%', display:'block' }} />
          </figure>
          <p style={{ fontSize:12.5, color:'var(--text-3)', fontStyle:'italic', lineHeight:1.6, maxWidth:640, margin:'18px 0 0' }}>
            {t('landing.prereqsFootnote')}
          </p>
        </div>
      </section>

      {/* TRADUÇÃO */}
      <section id="traducao" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div className="landing-section" style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px' }}>
          <SectionLabel n="04" label={t('landing.translationLabel')} />
          <h2 style={{ fontSize:'clamp(22px, 5vw, 30px)', fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>{t('landing.translationTitle')}</h2>
          <div className="responsive-grid" style={{ display:'grid', gridTemplateColumns:'1fr 64px 1fr', alignItems:'center', gap:0, marginTop:30 }}>
            <div style={{ border:'1px solid var(--line-2)', borderRadius:10, background:'var(--panel-2)', overflow:'hidden' }}>
              <div className="mono" style={{ fontSize:10.5, color:'var(--text-3)', padding:'9px 14px', borderBottom:'1px solid var(--line)' }}>{t('landing.translationYamlCaption')}</div>
              <pre className="mono" style={{ margin:0, padding:'15px 16px', fontSize:11, lineHeight:1.65, color:'#aeb6c6', overflowX:'auto' }}>{`apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: app-prod
spec:
  replicas: 3
  strategy: { type: RollingUpdate }
  template:
    spec:
      containers:
        - name: app
          image: company/backend:v1.2.3
          readinessProbe:
            httpGet: { path: /health/ready }`}</pre>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <img src="/devship-logo.png" alt="" style={{ width:24, height:24, opacity:.9 }} />
                <span style={{ color:'var(--teal)', fontSize:14 }}>▶</span>
              </div>
            </div>
            <div style={{ border:'1px solid var(--teal)', borderRadius:10, background:'rgba(43,199,180,.05)', overflow:'hidden' }}>
              <div className="mono" style={{ fontSize:10.5, color:'var(--teal)', padding:'9px 14px', borderBottom:'1px solid rgba(43,199,180,.25)' }}>{t('landing.translationDevshipCaption')}</div>
              <div style={{ padding:'15px 16px', display:'flex', flexDirection:'column', gap:11, fontSize:12.5 }}>
                {[[t('landing.translationCommitVersion'),'a1b2c3d','var(--teal)'],[t('landing.translationHead'),'a1b2c3d',''],[t('landing.translationDeployedAt'),'09/07/2026 14:32',''],[t('landing.translationAuthor'),'dev@empresa.com','']].map(([k,v,c]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ color:'var(--text-3)' }}>{k}</span>
                    <span className="mono" style={{ color: c || 'inherit' }}>{v}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'var(--text-3)' }}>{t('landing.translationState')}</span>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, color:'var(--green)' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)' }}></span>{t('landing.translationHealthy')}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop:38, display:'flex', flexDirection:'column', gap:1, border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden' }}>
            {[
              [t('landing.row1Title1'),t('landing.row1Title2'),t('landing.row1Body')],
              [t('landing.row2Title1'),t('landing.row2Title2'),t('landing.row2Body')],
              [t('landing.row3Title1'),t('landing.row3Title2'),t('landing.row3Body')],
            ].map(([t1,t2,body],i) => (
              <div key={i} className="responsive-grid" style={{ display:'grid', gridTemplateColumns:'300px 1fr', background:'var(--panel)', borderBottom: i<2 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ padding:'20px 22px', borderRight:'1px solid var(--line)' }}>
                  <span style={{ fontSize:16, fontWeight:600 }}>{t1}</span><br />
                  <span style={{ fontSize:16, fontWeight:600, color:'var(--teal)' }}>{t2}</span>
                </div>
                <div style={{ padding:'20px 22px', fontSize:13, color:'var(--text-2)', lineHeight:1.65, display:'flex', alignItems:'center' }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ESTADOS */}
      <section id="estados" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div className="landing-section" style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px', background:'var(--panel-2)' }}>
          <SectionLabel n="05" label={t('landing.statesLabel')} />
          <h2 style={{ fontSize:'clamp(22px, 5vw, 30px)', fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>{t('landing.statesTitle')}</h2>
          <p style={{ fontSize:14.5, color:'var(--text-2)', lineHeight:1.7, maxWidth:600, margin:'16px 0 32px' }}>
            {t('landing.statesBodyPrefix')} <span className="mono" style={{ color:'var(--amber)' }}>{t('landing.stateDeploying')}</span> {t('landing.statesBodyMid')} <span className="mono" style={{ color:'var(--green)' }}>{t('landing.stateHealthy')}</span> {t('landing.statesBodySuffix')}
          </p>
          <div style={{ overflowX:'auto' }}>
            <div style={{ minWidth:820, display:'flex', alignItems:'center' }}>
              <StateBox label={t('landing.statePending')} sub={t('landing.statePendingSub')} color="var(--text-3)" border="var(--border)" bg="var(--panel)" />
              <Arrow label={t('landing.arrowApply')} color="var(--text-3)" />
              <StateBox label={t('landing.stateDeploying')} sub={t('landing.stateDeployingSub')}  color="var(--amber)" border="rgba(217,154,48,.4)" bg="rgba(217,154,48,.06)" />
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:84 }}>
                <span className="mono" style={{ fontSize:9, color:'var(--green)', marginBottom:4 }}>{t('landing.probesOk')}</span>
                <div style={{ display:'flex', alignItems:'center', width:'100%' }}><span style={{ flex:1, height:1, background:'var(--green)', opacity:.5 }}></span><span style={{ color:'var(--green)', fontSize:10 }}>▶</span></div>
                <span className="mono" style={{ fontSize:9, color:'var(--red)', marginTop:6 }}>{t('landing.probesFail')}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <StateBox label={t('landing.stateHealthy')}    sub={t('landing.stateHealthySub')}     color="var(--green)" border="rgba(63,191,99,.45)"  bg="rgba(63,191,99,.06)" />
                <StateBox label={t('landing.stateDegraded')}   sub={t('landing.stateDegradedSub')}    color="var(--red)"   border="rgba(229,85,107,.45)" bg="rgba(229,85,107,.06)" />
              </div>
              <Arrow label={t('landing.arrowRollback')} color="var(--blue)" />
              <StateBox label={t('landing.stateReverted')} sub={t('landing.stateRevertedSub')} color="var(--blue)" border="rgba(91,157,240,.4)" bg="rgba(91,157,240,.06)" />
            </div>
          </div>
          <div className="responsive-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:0, marginTop:30, border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden' }}>
            {[
              [t('landing.startupProbe'),t('landing.startupProbeDesc')],
              [t('landing.readinessProbe'),t('landing.readinessProbeDesc')],
              [t('landing.livenessProbe'),t('landing.livenessProbeDesc')],
            ].map(([label,d],i) => (
              <div key={label} className="responsive-border-bottom" style={{ padding:'18px 20px', borderRight: i<2 ? '1px solid var(--line)' : 'none' }}>
                <div className="mono" style={{ fontSize:10.5, color:'var(--text-3)', marginBottom:8 }}>{label}</div>
                <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.55 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div className="landing-section" style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px' }}>
          <SectionLabel n="06" label={t('landing.rolesLabel')} />
          <h2 style={{ fontSize:'clamp(22px, 5vw, 30px)', fontWeight:700, letterSpacing:'-.02em', margin:'0 0 30px', maxWidth:640, lineHeight:1.18 }}>{t('landing.rolesTitle')}</h2>
          <div className="responsive-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden' }}>
            <div className="responsive-border-bottom" style={{ padding:'26px 26px', borderRight:'1px solid var(--line-2)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:18 }}>
                <span className="mono" style={{ fontSize:10, color:'var(--blue)', border:'1px solid rgba(91,157,240,.35)', borderRadius:5, padding:'2px 8px' }}>{t('landing.devTag')}</span>
                <span className="mono" style={{ fontSize:10, color:'var(--text-3)' }}>{t('landing.devTagSub')}</span>
              </div>
              <h3 style={{ fontSize:18, fontWeight:600, margin:'0 0 14px' }}>{t('landing.devTitle')}</h3>
              {[t('landing.devFeature1'),t('landing.devFeature2'),t('landing.devFeature3'),t('landing.devFeature4')].map(f => (
                <div key={f} style={{ display:'flex', gap:10, fontSize:13, color:'var(--text-2)', marginBottom:11 }}>
                  <span className="mono" style={{ color:'var(--teal)' }}>+</span> {f}
                </div>
              ))}
            </div>
            <div style={{ padding:'26px 26px', background:'var(--panel-2)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:18 }}>
                <span className="mono" style={{ fontSize:10, color:'var(--teal)', border:'1px solid rgba(43,199,180,.35)', borderRadius:5, padding:'2px 8px' }}>{t('landing.ceTag')}</span>
              </div>
              <h3 style={{ fontSize:18, fontWeight:600, margin:'0 0 14px' }}>{t('landing.ceTitle')}</h3>
              {[t('landing.ceFeature1'),t('landing.ceFeature2'),t('landing.ceFeature3'),t('landing.ceFeature4')].map(f => (
                <div key={f} style={{ display:'flex', gap:10, fontSize:13, color:'var(--text-2)', marginBottom:11 }}>
                  <span className="mono" style={{ color:'var(--teal)' }}>+</span> {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ARQUITETURA */}
      <section style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px' }}>
        <div className="landing-section" style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px', background:'var(--panel-2)' }}>
          <SectionLabel n="07" label={t('landing.archLabel')} />
          <h2 style={{ fontSize:'clamp(22px, 5vw, 30px)', fontWeight:700, letterSpacing:'-.02em', margin:0, maxWidth:640, lineHeight:1.18 }}>{t('landing.archTitle')}</h2>
          <figure style={{ margin:'30px 0 0', border:'1px solid var(--line-2)', borderRadius:10, overflow:'hidden', background:'var(--panel)' }}>
            <figcaption className="mono" style={{ display:'flex', alignItems:'center', gap:10, fontSize:10.5, color:'var(--text-3)', padding:'9px 14px', borderBottom:'1px solid var(--line)' }}>
              <span style={{ color:'var(--teal)' }}>FIG.02</span><span>{t('landing.archFigFile')}</span><span style={{ marginLeft:'auto', color:'var(--text-2)' }}>{t('landing.archFigCaption')}</span>
            </figcaption>
            <img src={language === 'pt' ? '/landing-arch_pt.png' : '/landing-arch_eng.png'} alt={t('landing.archFigCaption')} style={{ width:'100%', display:'block' }} />
          </figure>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth:1180, margin:'0 auto', padding:'0 26px 70px' }}>
        <div className="landing-section" style={{ border:'1px solid var(--line-2)', borderTop:'none', padding:'54px 44px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:30, flexWrap:'wrap' }}>
          <div>
            <h2 style={{ fontSize:26, fontWeight:700, letterSpacing:'-.02em', margin:0, lineHeight:1.2 }}>{t('landing.ctaTitle')}</h2>
            <p className="mono" style={{ fontSize:12, color:'var(--text-3)', margin:'12px 0 0' }}>{t('landing.ctaSubtitle')}</p>
          </div>
          <div style={{ display:'flex', gap:11, flexWrap:'wrap' }}>
            <span onClick={() => nav('/register')} className="btn-primary hover-bright" style={{ fontSize:14, fontWeight:600, padding:'13px 24px', borderRadius:8, cursor:'pointer' }}>{t('landing.createAccount')}</span>
            <span onClick={() => nav('/login')}    className="btn-secondary"            style={{ fontSize:14, fontWeight:500, padding:'13px 22px', borderRadius:8, cursor:'pointer' }}>{t('landing.login')}</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:'1px solid var(--line-2)', background:'var(--panel-2)' }}>
        <div style={{ maxWidth:1180, margin:'0 auto', padding:'30px 26px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <img src="/devship-logo.png" alt="DevShip" style={{ width:22, height:22 }} />
          <span style={{ fontSize:14, fontWeight:600 }}>DevShip</span>
          <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{t('landing.footerTagline')}</span>
          <span className="mono" style={{ marginLeft:'auto', fontSize:11, color:'var(--text-3)' }}>{t('landing.footerCopyright')}</span>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:16, marginBottom:8 }}>
      <span className="mono" style={{ fontSize:12, color:'var(--teal)', letterSpacing:'.1em' }}>{n}</span>
      <span className="mono" style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'.18em', textTransform:'uppercase' }}>{label}</span>
      <span style={{ flex:1, height:1, background:'var(--line)' }}></span>
    </div>
  );
}

function StateBox({ label, sub, color, border, bg }: { label:string; sub:string; color:string; border:string; bg:string }) {
  return (
    <div style={{ border:`1px solid ${border}`, borderRadius:9, padding:'12px 16px', background:bg }}>
      <span className="mono" style={{ fontSize:9.5, color:'var(--text-3)' }}>{sub}</span>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:5 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:color }}></span>
        <span style={{ fontSize:13, fontWeight:600, color }}>{label}</span>
      </div>
    </div>
  );
}

function Arrow({ label, color }: { label:string; color:string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:60 }}>
      <span className="mono" style={{ fontSize:9, color, marginBottom:4 }}>{label}</span>
      <div style={{ display:'flex', alignItems:'center', width:'100%' }}>
        <span style={{ flex:1, height:1, background:color, opacity:.5 }}></span>
        <span style={{ color, fontSize:10 }}>▶</span>
      </div>
    </div>
  );
}
