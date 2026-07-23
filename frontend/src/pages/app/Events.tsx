import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, type ApiError } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';
import Breadcrumb from '../../components/Breadcrumb';
import { useLanguage } from '../../context/LanguageContext';
import AccessDenied from '../../components/AccessDenied';

interface K8sEvent {
  type: string;
  reason: string;
  object_ref: string;
  message: string;
  last_timestamp: string | null;
}

function age(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function Events() {
  const { appId, aeId } = useParams<{ appId: string; aeId: string }>();
  const { appLabel, envLabel, appId: resolvedAppId } = useAppEnvBreadcrumb(appId, aeId);
  const { t } = useLanguage();
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(() => {
    if (!aeId) return;
    setLoading(true);
    setError('');
    setForbidden(false);
    apiFetch(`/application-environments/${aeId}/events`)
      .then(setEvents)
      .catch((e: ApiError) => { if (e.status === 403) setForbidden(true); else setError(e.message); })
      .finally(() => setLoading(false));
  }, [aeId]);

  useEffect(() => { load(); }, [load]);

  if (forbidden) return <AccessDenied />;

  return (
    <div>
      <Breadcrumb segments={[
        { label: appLabel, to: resolvedAppId ? `/app/${resolvedAppId}` : undefined },
        { label: envLabel, to: (resolvedAppId && aeId) ? `/app/${resolvedAppId}/${aeId}` : undefined },
        { label: t('events.breadcrumbEvents') },
      ]} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:600, margin:0 }}>{t('events.title')}</h1>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {loading && events.length > 0 && (
            <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--teal)', animation:'ds-spin .7s linear infinite' }} />
          )}
          <button onClick={load} disabled={loading} className="btn-ghost" style={{ fontSize:12, padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {t('events.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:9, background:'rgba(241,85,108,.08)', border:'1px solid rgba(241,85,108,.3)', fontSize:12.5, color:'var(--red)' }}>{error}</div>
      )}

      {loading && events.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'60px 0', color:'var(--text-3)', fontSize:13 }}>
          <div style={{ width:22, height:22, borderRadius:'50%', border:'2.5px solid var(--border)', borderTopColor:'var(--teal)', animation:'ds-spin .7s linear infinite' }} />
          {t('events.loadingEvents')}
        </div>
      ) : (
        <>
        <div className="responsive-table-hint" style={{ fontSize:11.5, color:'var(--text-3)', marginBottom:6 }}>↔ desliza para o lado para ver todas as colunas</div>
        <div className="responsive-table-grid" style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)' }}>
          <div style={{ minWidth:680, borderRadius:14, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'70px 110px 220px 1fr 50px', gap:12, padding:'11px 18px', borderBottom:'1px solid var(--border)', fontSize:10.5, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
            <span>{t('events.typeCol')}</span><span>{t('events.reasonCol')}</span><span>{t('events.objectCol')}</span><span>{t('events.messageCol')}</span><span style={{ textAlign:'right' }}>{t('events.ageCol')}</span>
          </div>
          {events.map((e, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'70px 110px 220px 1fr 50px', gap:12, padding:'11px 18px', borderBottom: i < events.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems:'start', fontSize:12 }}>
              <span style={{ color: e.type==='Warning' ? 'var(--amber)' : 'var(--green)', fontSize:11, fontWeight:600 }}>{e.type}</span>
              <span className="mono" style={{ fontSize:11.5 }}>{e.reason}</span>
              <span className="mono" style={{ fontSize:11, color:'var(--text-2)', wordBreak:'break-all' }}>{e.object_ref}</span>
              <span style={{ fontSize:12, color: e.type==='Warning' ? 'var(--amber)' : 'var(--text-2)', lineHeight:1.5 }}>{e.message}</span>
              <span className="mono" style={{ fontSize:11, color:'var(--text-3)', textAlign:'right' }}>{age(e.last_timestamp)}</span>
            </div>
          ))}
          {events.length === 0 && !loading && (
            <div style={{ padding:'28px 18px', textAlign:'center', color:'var(--text-3)', fontSize:12.5 }}>{t('events.noRecentEvents')}</div>
          )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
