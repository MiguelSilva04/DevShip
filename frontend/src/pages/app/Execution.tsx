import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useAppEnvBreadcrumb } from '../../hooks/useAppEnvBreadcrumb';
import Breadcrumb from '../../components/Breadcrumb';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../context/LanguageContext';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
type Severity = 'INFO' | 'WARNING' | 'ERROR';

interface DeploymentEvent {
  id: string;
  event_type: string;
  source: string;
  severity: Severity;
  message: string | null;
  event_timestamp: string;
}

interface DeploymentRequest {
  id: string;
  status: RequestStatus;
  source_commit_sha: string | null;
  failure_reason: string | null;
  requested_at: string;
  completed_at: string | null;
}

interface RequestWithEvents {
  request: DeploymentRequest;
  events: DeploymentEvent[];
}

const TERMINAL: RequestStatus[] = ['SUCCESS', 'FAILED', 'CANCELLED'];

function severityColor(s: Severity) {
  if (s === 'ERROR') return 'var(--red)';
  if (s === 'WARNING') return 'var(--amber)';
  return 'var(--text-3)';
}

function statusStyle(s: RequestStatus) {
  if (s === 'SUCCESS') return { bg: 'rgba(52,199,89,.12)', col: 'var(--green)', bord: 'rgba(52,199,89,.28)', dot: 'var(--green)', anim: false };
  if (s === 'FAILED' || s === 'CANCELLED') return { bg: 'rgba(241,85,108,.12)', col: 'var(--red)', bord: 'rgba(241,85,108,.28)', dot: 'var(--red)', anim: false };
  return { bg: 'rgba(224,169,59,.12)', col: 'var(--amber)', bord: 'rgba(224,169,59,.28)', dot: 'var(--amber)', anim: true };
}

function statusLabel(s: RequestStatus, t: (key: TranslationKey) => string) {
  const map: Record<RequestStatus, string> = {
    PENDING: t('execution.statusPending'), APPROVED: t('execution.statusApproved'), REJECTED: t('execution.statusRejected'),
    RUNNING: t('execution.statusRunning'), SUCCESS: t('execution.statusSuccess'), FAILED: t('execution.statusFailed'), CANCELLED: t('execution.statusCancelled'),
  };
  return map[s] ?? s;
}

function eventTypeLabelMap(t: (key: TranslationKey) => string): Record<string, string> {
  return {
    WORKFLOW_STARTED: t('execution.evtWorkflowStarted'),
    BUILD_COMPLETED: t('execution.evtBuildCompleted'),
    IMAGE_BUILD_FAILED: t('execution.evtImageBuildFailed'),
    IMAGE_PUSHED: t('execution.evtImagePushed'),
    GITOPS_UPDATED: t('execution.evtGitopsUpdated'),
    SYNC_STARTED: t('execution.evtSyncStarted'),
    SYNC_COMPLETED: t('execution.evtSyncCompleted'),
    SYNC_FAILED: t('execution.evtSyncFailed'),
    ROLLOUT_STARTED: t('execution.evtRolloutStarted'),
    ROLLOUT_COMPLETED: t('execution.evtRolloutCompleted'),
    POD_CREATED: t('execution.evtPodCreated'),
    READINESS_PASSED: t('execution.evtReadinessPassed'),
    READINESS_FAILED: t('execution.evtReadinessFailed'),
    CRASH_LOOP_BACKOFF: t('execution.evtCrashLoopBackoff'),
  };
}

// ─── Pipeline stages ─────────────────────────────────────────────────────────
// Every DeploymentEventType maps onto one of these 5 conceptual stages, in a
// fixed, known order — this lets the whole pipeline be shown as a stepper with
// live progress instead of a flat scrolling log.
type StageState = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

interface Stage {
  key: string;
  label: string;
  icon: string;
  startTypes: string[];
  doneTypes: string[];
  failTypes: string[];
}

function stages(t: (key: TranslationKey) => string): Stage[] {
  return [
    { key: 'build',   label: t('execution.stageBuild'), icon: '⚙',  startTypes: ['WORKFLOW_STARTED'], doneTypes: ['BUILD_COMPLETED', 'IMAGE_PUSHED'], failTypes: ['IMAGE_BUILD_FAILED'] },
    { key: 'sync',     label: t('execution.stageSync'), icon: '🔄', startTypes: ['GITOPS_UPDATED', 'SYNC_STARTED'], doneTypes: ['SYNC_COMPLETED'], failTypes: ['SYNC_FAILED'] },
    { key: 'rollout',  label: t('execution.stageRollout'),   icon: '🚀', startTypes: ['ROLLOUT_STARTED'], doneTypes: ['ROLLOUT_COMPLETED'], failTypes: [] },
    { key: 'pods',     label: t('execution.stagePods'),           icon: '✓',  startTypes: ['POD_CREATED'], doneTypes: ['READINESS_PASSED'], failTypes: ['READINESS_FAILED', 'CRASH_LOOP_BACKOFF'] },
  ];
}

function computeStageStates(events: DeploymentEvent[], requestStatus: RequestStatus, stageList: Stage[]): Record<string, { state: StageState; events: DeploymentEvent[] }> {
  const result: Record<string, { state: StageState; events: DeploymentEvent[] }> = {};
  const seenTypes = new Set(events.map(e => e.event_type));
  const anyFailed = requestStatus === 'FAILED' || requestStatus === 'CANCELLED';
  const isTerminal = TERMINAL.includes(requestStatus);

  let priorStageDone = true;
  for (const stage of stageList) {
    const stageEvents = events.filter(e =>
      stage.startTypes.includes(e.event_type) || stage.doneTypes.includes(e.event_type) || stage.failTypes.includes(e.event_type)
    );
    const failed = stage.failTypes.some(t => seenTypes.has(t));
    const done = stage.doneTypes.some(t => seenTypes.has(t));
    const started = stage.startTypes.some(t => seenTypes.has(t)) || done || failed;

    let state: StageState;
    if (!priorStageDone) state = 'skipped';
    else if (failed) state = 'failed';
    else if (done) state = 'done';
    else if (started) state = anyFailed ? 'skipped' : 'active';
    // O stage anterior já terminou mas este ainda não emitiu o seu próprio evento de
    // início — o backend só emite ROLLOUT_STARTED/POD_CREATED quando encontra a condição
    // certa no K8s, o que pode demorar um ou mais polls depois do stage anterior acabar.
    // Sem isto, esse intervalo aparecia como "pending" (cinzento, parado) mesmo com o
    // pipeline já em curso — o "espaço morto" reportado entre Sync e Rollout.
    else if (!isTerminal) state = 'active';
    else state = 'pending';

    result[stage.key] = { state, events: stageEvents };
    priorStageDone = done && !failed;
  }
  return result;
}

function StageIcon({ state, icon }: { state: StageState; icon: string }) {
  const size = 30;
  if (state === 'done') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(52,199,89,.15)', border: '1.5px solid rgba(52,199,89,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 7" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    );
  }
  if (state === 'failed') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(241,85,108,.15)', border: '1.5px solid rgba(241,85,108,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="var(--red)" strokeWidth="3" strokeLinecap="round" /></svg>
      </div>
    );
  }
  if (state === 'active') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(224,169,59,.15)', border: '1.5px solid rgba(224,169,59,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', position: 'relative' }}>
        <span style={{ position: 'absolute', inset: -1.5, borderRadius: '50%', border: '1.5px solid transparent', borderTopColor: 'var(--amber)', animation: 'ds-spin 1s linear infinite' }} />
        <span style={{ fontSize: 13 }}>{icon}</span>
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', opacity: state === 'skipped' ? .4 : .7 }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{icon}</span>
    </div>
  );
}

function StageRow({ stage, state, events, isLast }: { stage: Stage; state: StageState; events: DeploymentEvent[]; isLast: boolean }) {
  const { t } = useLanguage();
  const eventTypeLabel = eventTypeLabelMap(t);
  const [open, setOpen] = useState(false);
  const labelColor = state === 'done' ? 'var(--text)' : state === 'failed' ? 'var(--red)' : state === 'active' ? 'var(--amber)' : 'var(--text-3)';
  const lineColor = state === 'done' ? 'rgba(52,199,89,.35)' : state === 'failed' ? 'rgba(241,85,108,.35)' : 'var(--border)';
  // A seta (e a possibilidade de expandir) tem de estar disponível assim que o stage está
  // "active" — a decorrer, mesmo sem nenhum evento ainda — e não só depois de já ter
  // terminado com eventos guardados. Sem isto, um stage em curso ficava sem qualquer forma
  // de o utilizador confirmar que está mesmo a decorrer até ele terminar.
  const expandable = events.length > 0 || state === 'active';

  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
        <StageIcon state={state} icon={stage.icon} />
        {!isLast && <span style={{ width: 1.5, flex: 1, minHeight: 22, background: lineColor, margin: '4px 0' }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
        <button
          onClick={() => expandable && setOpen(v => !v)}
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: expandable ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left' }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 600, color: labelColor }}>{stage.label}</span>
          {state === 'active' && <span style={{ fontSize: 11, color: 'var(--amber)', animation: 'ds-pulse 1.4s infinite' }}>{t('execution.inProgress')}</span>}
          {expandable && (
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
          )}
        </button>
        {open && events.length === 0 && (
          <div className="mono" style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-2)', fontSize: 11, color: 'var(--text-3)' }}>
            {t('execution.waitingFirstEvent')}
          </div>
        )}
        {open && events.length > 0 && (
          <div className="mono" style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-2)', fontSize: 11, lineHeight: 1.8 }}>
            {events.map(ev => (
              <div key={ev.id}>
                <span style={{ color: 'var(--text-3)', marginRight: 10 }}>{new Date(ev.event_timestamp).toLocaleTimeString()}</span>
                <span style={{ color: ev.severity !== 'INFO' ? severityColor(ev.severity) : 'var(--text-2)' }}>
                  {eventTypeLabel[ev.event_type] ?? ev.event_type}{ev.message ? ` — ${ev.message}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Execution() {
  const { appId, aeId, reqId } = useParams<{ appId: string; aeId: string; reqId: string }>();
  const { appLabel, envLabel, appId: resolvedAppId } = useAppEnvBreadcrumb(appId, aeId);
  const nav = useNavigate();
  const { t } = useLanguage();
  const STAGES = stages(t);
  const [data, setData] = useState<RequestWithEvents | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reqId) return;

    // initial load
    apiFetch(`/deployment-requests/${reqId}/events`)
      .then(setData)
      .catch(e => setError(e.message));

    const id = setInterval(async () => {
      try {
        const d: RequestWithEvents = await apiFetch(`/deployment-requests/${reqId}/events`);
        setData(d);
        if (TERMINAL.includes(d.request.status)) clearInterval(id);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        clearInterval(id);
      }
    }, 2000);

    return () => clearInterval(id);
  }, [reqId]);

  if (error) return <div style={{ color: 'var(--red)', fontSize: 13, padding: '40px 0' }}>{error}</div>;
  if (!data) return <Spinner />;

  const { request, events } = data;
  const st = statusStyle(request.status);
  const isTerminal = TERMINAL.includes(request.status);
  const stageStates = computeStageStates(events, request.status, STAGES);

  return (
    <div>
      <Breadcrumb segments={[
        { label: appLabel, to: resolvedAppId ? `/app/${resolvedAppId}` : undefined },
        { label: envLabel, to: (resolvedAppId && aeId) ? `/app/${resolvedAppId}/${aeId}` : undefined },
        { label: t('execution.breadcrumbExecution') },
      ]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{t('execution.pageTitle')}</h1>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999, fontSize: 12, background: st.bg, color: st.col, border: `1px solid ${st.bord}` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, animation: st.anim ? 'ds-pulse 1.4s infinite' : 'none' }} />
          {statusLabel(request.status, t)}
        </span>
      </div>

      {request.status === 'FAILED' && request.failure_reason && (
        <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 10, background: 'rgba(241,85,108,.08)', border: '1px solid rgba(241,85,108,.3)', fontSize: 13, color: 'var(--red)' }}>
          <strong>{t('execution.failure')}</strong> {request.failure_reason}
        </div>
      )}

      {request.source_commit_sha && (
        <div style={{ marginBottom: 18 }} className="mono">
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t('execution.commit')} </span>
          <span style={{ fontSize: 12, color: 'var(--teal)' }}>{request.source_commit_sha.slice(0, 7)}</span>
        </div>
      )}

      {/* Pipeline stepper */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '22px 22px 6px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{t('execution.pipeline')}</span>
          {!isTerminal && <span style={{ fontSize: 11, color: 'var(--teal)', animation: 'ds-pulse 1.4s infinite' }}>{t('execution.live')}</span>}
        </div>
        {STAGES.map((stage, i) => (
          <StageRow
            key={stage.key}
            stage={stage}
            state={stageStates[stage.key].state}
            events={stageStates[stage.key].events}
            isLast={i === STAGES.length - 1}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          onClick={() => nav(`/app/${appId}/${aeId}`)}
          className={isTerminal && request.status === 'SUCCESS' ? 'btn-primary' : undefined}
          style={
            isTerminal && request.status === 'SUCCESS'
              ? { fontSize: 12.5, padding: '9px 16px', borderRadius: 9 }
              : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 12.5, padding: '9px 16px', borderRadius: 9, cursor: 'pointer' }
          }
        >
          {t('execution.back')}
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  const { t } = useLanguage();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'ds-spin .9s linear infinite', display: 'inline-block' }} />{t('execution.loading')}</div>;
}
