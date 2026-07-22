import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';
import Breadcrumb from '../../components/Breadcrumb';

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
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!aeId) return;
    setLoading(true);
    setError('');
    apiFetch(`/application-environments/${aeId}/events`)
      .then(setEvents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [aeId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <Breadcrumb segments={[
        { label: appLabel, to: resolvedAppId ? `/app/${resolvedAppId}` : undefined },
        { label: envLabel, to: (resolvedAppId && aeId) ? `/app/${resolvedAppId}/${aeId}` : undefined },
        { label: 'events' },
      ]} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:600, margin:0 }}>Kubernetes Events</h1>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {loading && events.length > 0 && (
            <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--teal)', animation:'ds-spin .7s linear infinite' }} />
          )}
          <button onClick={load} disabled={loading} className="btn-ghost" style={{ fontSize:12, padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer' }}>
            Atualizar ↻
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:9, background:'rgba(241,85,108,.08)', border:'1px solid rgba(241,85,108,.3)', fontSize:12.5, color:'#ff8497' }}>{error}</div>
      )}

      {loading && events.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'60px 0', color:'var(--text-3)', fontSize:13 }}>
          <div style={{ width:22, height:22, borderRadius:'50%', border:'2.5px solid var(--border)', borderTopColor:'var(--teal)', animation:'ds-spin .7s linear infinite' }} />
          A carregar eventos…
        </div>
      ) : (
        <div className="responsive-table-grid" style={{ border:'1px solid var(--border)', borderRadius:14, background:'var(--surface)', overflow:'hidden' }}>
          <div style={{ minWidth:680 }}>
          <div style={{ display:'grid', gridTemplateColumns:'70px 110px 220px 1fr 50px', gap:12, padding:'11px 18px', borderBottom:'1px solid var(--border)', fontSize:10.5, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-3)' }}>
            <span>Tipo</span><span>Motivo</span><span>Objeto</span><span>Mensagem</span><span style={{ textAlign:'right' }}>Idade</span>
          </div>
          {events.map((e, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'70px 110px 220px 1fr 50px', gap:12, padding:'11px 18px', borderBottom: i < events.length-1 ? '1px solid var(--border-soft)' : 'none', alignItems:'start', fontSize:12 }}>
              <span style={{ color: e.type==='Warning' ? '#ecc26b' : '#5dd57b', fontSize:11, fontWeight:600 }}>{e.type}</span>
              <span className="mono" style={{ fontSize:11.5 }}>{e.reason}</span>
              <span className="mono" style={{ fontSize:11, color:'var(--text-2)', wordBreak:'break-all' }}>{e.object_ref}</span>
              <span style={{ fontSize:12, color: e.type==='Warning' ? '#ecc26b' : 'var(--text-2)', lineHeight:1.5 }}>{e.message}</span>
              <span className="mono" style={{ fontSize:11, color:'var(--text-3)', textAlign:'right' }}>{age(e.last_timestamp)}</span>
            </div>
          ))}
          {events.length === 0 && !loading && (
            <div style={{ padding:'28px 18px', textAlign:'center', color:'var(--text-3)', fontSize:12.5 }}>Sem eventos recentes.</div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
