import { useLanguage } from '../context/LanguageContext';

export default function AccessDenied() {
  const { t } = useLanguage();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(241,85,108,.12)', border: '1.5px solid rgba(241,85,108,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--red)' }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('common.accessDenied')}</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 360, lineHeight: 1.6 }}>{t('common.accessDeniedBody')}</div>
    </div>
  );
}
