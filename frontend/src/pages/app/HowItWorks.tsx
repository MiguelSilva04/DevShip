import { useUser } from '../../context/UserContext';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../context/LanguageContext';

function translationRows(t: (key: TranslationKey) => string): [string, string, string][] {
  return [
    [t('howItWorks.row1Title1'), t('howItWorks.row1Title2'), t('howItWorks.row1Body')],
    [t('howItWorks.row2Title1'), t('howItWorks.row2Title2'), t('howItWorks.row2Body')],
    [t('howItWorks.row3Title1'), t('howItWorks.row3Title2'), t('howItWorks.row3Body')],
  ];
}

function roles(t: (key: TranslationKey) => string) {
  return [
    { name:t('howItWorks.roleCloudEngineer'), color:'var(--teal)', bg:'rgba(43,199,180,.08)', border:'rgba(43,199,180,.25)', perms:[t('howItWorks.cePerm1'),t('howItWorks.cePerm2'),t('howItWorks.cePerm3'),t('howItWorks.cePerm4'),t('howItWorks.cePerm5'),t('howItWorks.cePerm6')] },
    { name:t('howItWorks.roleTechLead'),      color:'var(--blue)',     bg:'rgba(77,156,246,.08)', border:'rgba(77,156,246,.25)', perms:[t('howItWorks.tlPerm1'),t('howItWorks.tlPerm2'),t('howItWorks.tlPerm3')] },
    { name:t('howItWorks.roleDeveloper'),     color:'var(--text)', bg:'var(--surface)',       border:'var(--border)',       perms:[t('howItWorks.devPerm1'),t('howItWorks.devPerm2'),t('howItWorks.devPerm3'),t('howItWorks.devPerm4')] },
  ];
}

function pipelineSteps(t: (key: TranslationKey) => string) {
  return [
    { step:1, title:t('howItWorks.pStep1Title'), desc:t('howItWorks.pStep1Desc'), icon:'💻' },
    { step:2, title:t('howItWorks.pStep2Title'), desc:t('howItWorks.pStep2Desc'), icon:'🎯' },
    { step:3, title:t('howItWorks.pStep3Title'), desc:t('howItWorks.pStep3Desc'), icon:'🔐' },
    { step:4, title:t('howItWorks.pStep4Title'), desc:t('howItWorks.pStep4Desc'), icon:'✋' },
    { step:5, title:t('howItWorks.pStep5Title'), desc:t('howItWorks.pStep5Desc'), icon:'🚀' },
    { step:6, title:t('howItWorks.pStep6Title'), desc:t('howItWorks.pStep6Desc'), icon:'🩺' },
    { step:7, title:t('howItWorks.pStep7Title'), desc:t('howItWorks.pStep7Desc'), icon:'✅' },
  ];
}

function HowItWorksDev() {
  const { t } = useLanguage();
  const TRANSLATION_ROWS = translationRows(t);
  const ROLES = roles(t);
  const DEV_BENEFITS = [t('howItWorks.devBenefit1'), t('howItWorks.devBenefit2'), t('howItWorks.devBenefit3'), t('howItWorks.devBenefit4')];
  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 6px' }}>{t('howItWorks.title')}</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 30px', lineHeight:1.6 }}>
        {t('howItWorks.devSubtitle')}
      </p>

      {/* O Problema */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>{t('howItWorks.problemHeader')}</h2>
      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'22px 24px', marginBottom:28 }}>
        <p style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.7, margin:'0 0 18px', maxWidth:640 }}>
          {t('howItWorks.problemBody')}
        </p>
        <figure style={{ margin:0, border:'1px solid var(--border-soft)', borderRadius:10, overflow:'hidden', background:'var(--bg-2)' }}>
          <figcaption className="mono" style={{ display:'flex', alignItems:'center', gap:10, fontSize:10.5, color:'var(--text-3)', padding:'9px 14px', borderBottom:'1px solid var(--border-soft)' }}>
            <span style={{ color:'var(--teal)' }}>FIG.01</span><span>antes_vs_depois.png</span><span style={{ marginLeft:'auto' }}>{t('howItWorks.problemFigCaption')}</span>
          </figcaption>
          <img src="/landing-dev.png" alt="A jornada de deploy: sem DevShip vs com DevShip" style={{ width:'100%', display:'block' }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
        </figure>
      </div>

      {/* O que ganhas */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>{t('howItWorks.devBenefitsHeader')}</h2>
      <div style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', padding:'20px 24px', marginBottom:28 }}>
        {DEV_BENEFITS.map(b => (
          <div key={b} style={{ display:'flex', gap:10, fontSize:13, color:'var(--text-2)', marginBottom:11 }}>
            <span className="mono" style={{ color:'var(--teal)' }}>+</span> {b}
          </div>
        ))}
      </div>

      {/* Tradução */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>{t('howItWorks.translationHeader')}</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:1, border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:28 }}>
        {TRANSLATION_ROWS.map(([t1, t2, body], i) => (
          <div key={i} className="responsive-grid" style={{ display:'grid', gridTemplateColumns:'260px 1fr', background:'var(--surface)', borderBottom: i < TRANSLATION_ROWS.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            <div style={{ padding:'17px 20px', borderRight:'1px solid var(--border-soft)' }}>
              <span style={{ fontSize:14, fontWeight:600 }}>{t1}</span><br />
              <span style={{ fontSize:14, fontWeight:600, color:'var(--teal)' }}>{t2}</span>
            </div>
            <div style={{ padding:'17px 20px', fontSize:12.5, color:'var(--text-2)', lineHeight:1.6, display:'flex', alignItems:'center' }}>{body}</div>
          </div>
        ))}
      </div>

      {/* Permissões — reaproveita a mesma tabela de roles */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>{t('howItWorks.permissionsHeader')}</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:13 }}>
        {ROLES.map(r => (
          <div key={r.name} style={{ border:`1px solid ${r.border}`, borderRadius:13, background:r.bg, padding:'18px 18px' }}>
            <div style={{ fontSize:14, fontWeight:600, color:r.color, marginBottom:13 }}>{r.name}</div>
            <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
              {r.perms.map(p => (
                <li key={p} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>
                  <span style={{ color:r.color, flex:'none', fontSize:11 }}>✓</span>{p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const { user } = useUser();
  const { t } = useLanguage();
  if (user?.role !== 'cloud') return <HowItWorksDev />;

  const PIPELINE = pipelineSteps(t);
  const ROLES = roles(t);

  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:600, margin:'0 0 6px' }}>{t('howItWorks.title')}</h1>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 30px', lineHeight:1.6 }}>
        {t('howItWorks.ceSubtitle')}
      </p>

      {/* Pipeline */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>{t('howItWorks.pipelineHeader')}</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:0, border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden', marginBottom:28 }}>
        {PIPELINE.map((p, i) => (
          <div key={p.step} style={{ display:'flex', alignItems:'flex-start', gap:16, padding:'16px 20px', borderBottom: i < PIPELINE.length-1 ? '1px solid var(--border-soft)' : 'none' }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flex:'none' }}>{p.icon}</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:10, flex:1 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', minWidth:20 }}>{p.step}.</span>
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, marginBottom:3 }}>{p.title}</div>
                <div style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.55 }}>{p.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Prerequisites */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>{t('howItWorks.prereqsHeader')}</h2>
      <p style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 20px', lineHeight:1.6 }}>
        {t('howItWorks.prereqsIntro')}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
        <div style={{ border:'1px solid var(--border)', borderRadius:13, background:'var(--surface)', padding:'18px 20px' }}>
          <div style={{ fontSize:13.5, fontWeight:600, marginBottom:4 }}>{t('howItWorks.codeBuildTitle')}</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>{t('howItWorks.codeBuildSub')}</div>
          <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
            {[t('howItWorks.codeBuild1'), t('howItWorks.codeBuild2'), t('howItWorks.codeBuild3')].map(b => (
              <li key={b} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>
                <span style={{ color:'var(--text-3)', flex:'none', fontSize:11 }}>·</span>{b}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ border:'1px solid var(--border)', borderRadius:13, background:'var(--surface)', padding:'18px 20px' }}>
          <div style={{ fontSize:13.5, fontWeight:600, marginBottom:4 }}>{t('howItWorks.clusterAccessTitle')}</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>{t('howItWorks.clusterAccessSub')}</div>
          <ul style={{ margin:'0 0 12px', padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
            {[t('howItWorks.clusterAccess1'), t('howItWorks.clusterAccess2')].map(b => (
              <li key={b} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>
                <span style={{ color:'var(--text-3)', flex:'none', fontSize:11 }}>·</span>{b}
              </li>
            ))}
          </ul>
          <p style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.55, margin:0 }}>
            {t('howItWorks.clusterAccessNote')}
          </p>
        </div>

        <div style={{ border:'1px solid var(--border)', borderRadius:13, background:'var(--surface)', padding:'18px 20px' }}>
          <div style={{ fontSize:13.5, fontWeight:600, marginBottom:4 }}>{t('howItWorks.argocdMetricsTitle')}</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>{t('howItWorks.argocdMetricsSub')}</div>
          <p style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.55, margin:'0 0 12px' }}>
            {t('howItWorks.argocdMetricsBody')}
          </p>
          <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
            {[t('howItWorks.argocdMetrics1'), t('howItWorks.argocdMetrics2'), t('howItWorks.argocdMetrics3'), t('howItWorks.argocdMetrics4')].map(b => (
              <li key={b} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>
                <span style={{ color:'var(--text-3)', flex:'none', fontSize:11 }}>·</span>{b}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display:'flex', gap:12, alignItems:'flex-start', border:'1px solid rgba(224,169,59,.35)', background:'rgba(224,169,59,.07)', borderRadius:13, padding:'16px 18px' }}>
          <span style={{ color:'var(--amber)', fontSize:15, flex:'none' }}>⚠</span>
          <p style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.6, margin:0 }}>
            <span style={{ color:'var(--amber)', fontWeight:600 }}>ClusterRoleBinding</span> {t('howItWorks.clusterRoleBindingWarning')} <code className="mono">kubectl</code>.
          </p>
        </div>

        <p style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.6, margin:0 }}>
          {t('howItWorks.noEquivalentNote')}
        </p>
      </div>

      {/* Roles */}
      <h2 style={{ fontSize:14, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)', fontWeight:600, margin:'0 0 16px' }}>{t('howItWorks.permissionsHeader')}</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:13, marginBottom:28 }}>
        {ROLES.map(r => (
          <div key={r.name} style={{ border:`1px solid ${r.border}`, borderRadius:13, background:r.bg, padding:'18px 18px' }}>
            <div style={{ fontSize:14, fontWeight:600, color:r.color, marginBottom:13 }}>{r.name}</div>
            <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
              {r.perms.map(p => (
                <li key={p} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>
                  <span style={{ color:r.color, flex:'none', fontSize:11 }}>✓</span>{p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Architecture note */}
      <div style={{ border:'1px solid var(--border-soft)', borderRadius:13, background:'var(--bg-2)', padding:'18px 20px' }}>
        <div style={{ fontSize:12, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:10 }}>{t('howItWorks.architectureHeader')}</div>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.65, margin:0 }}>
          {t('howItWorks.architectureBody')}
        </p>
        {/* Architecture image */}
        <img src="/landing-arch.png" alt="Arquitectura DevShip" style={{ width:'100%', marginTop:16, borderRadius:9, opacity:.85 }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
      </div>
    </div>
  );
}
