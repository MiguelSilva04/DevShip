import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

/**
 * Resolves the human-readable "appName / envName" breadcrumb for a given
 * (appId, aeId) pair, falling back to the raw ids while loading or on failure —
 * every detail screen under an ApplicationEnvironment needs this same lookup.
 */
export function useAppEnvBreadcrumb(appId: string | undefined, aeId: string | undefined) {
  const [appName, setAppName] = useState('');
  const [envName, setEnvName] = useState('');

  useEffect(() => {
    if (!aeId) return;
    apiFetch(`/application-environments/${aeId}`)
      .then((ae: { application_id: string; environment_id: string; deployment_name: string }) => {
        const projectId = localStorage.getItem('ob_project_id');
        Promise.all([
          apiFetch(`/applications/${ae.application_id}`).catch(() => null),
          projectId ? apiFetch(`/projects/${projectId}/environments`).catch(() => null) : Promise.resolve(null),
        ]).then(([app, envs]) => {
          if (app) setAppName(app.name);
          if (envs && Array.isArray(envs)) {
            const env = envs.find((e: { id: string }) => e.id === ae.environment_id);
            setEnvName(env?.name ?? ae.deployment_name);
          } else {
            setEnvName(ae.deployment_name);
          }
        });
      })
      .catch(() => {});
  }, [aeId]);

  return {
    appLabel: appName || appId || '',
    envLabel: envName || aeId || '',
  };
}
