// Shared LifecycleStatus type + color map — was duplicated across AppDetail, EnvDetail,
// Home and History.
export type LifecycleStatus = 'Deploying' | 'Healthy' | 'Degraded' | 'Failed' | 'RolledBack' | 'Superseded';

export const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  Deploying: 'A implementar',
  Healthy: 'Saudável',
  Degraded: 'Degradado',
  Failed: 'Falhou',
  RolledBack: 'Revertido',
  Superseded: 'Substituído',
};

export interface LifecycleColor {
  bg: string;
  col: string;
  bord: string;
  dot: string;
}

export const LIFECYCLE_COLOR: Record<LifecycleStatus, LifecycleColor> = {
  Healthy:    { bg: 'rgba(52,199,89,.13)',  col: 'var(--green)', bord: 'rgba(52,199,89,.24)',   dot: 'var(--green)' },
  Deploying:  { bg: 'rgba(224,169,59,.13)', col: 'var(--amber)', bord: 'rgba(224,169,59,.26)',  dot: 'var(--amber)' },
  Degraded:   { bg: 'rgba(241,85,108,.13)', col: 'var(--red)', bord: 'rgba(241,85,108,.26)',  dot: 'var(--red)' },
  Failed:     { bg: 'rgba(241,85,108,.13)', col: 'var(--red)', bord: 'rgba(241,85,108,.26)',  dot: 'var(--red)' },
  RolledBack: { bg: 'rgba(120,120,180,.13)',col: 'var(--blue)', bord: 'rgba(120,120,180,.26)', dot: 'var(--blue)' },
  Superseded: { bg: 'rgba(150,150,150,.13)',col: 'var(--text-3)', bord: 'rgba(150,150,150,.26)', dot: 'var(--gray)' },
};

export function lifecycleColor(s: LifecycleStatus | null | undefined, fallback: LifecycleColor): LifecycleColor {
  return (s && LIFECYCLE_COLOR[s]) ?? fallback;
}

export type UpToDateStatus = 'UpToDate' | 'Outdated' | 'Unknown';

export const UP_TO_DATE_LABEL: Record<UpToDateStatus, string> = {
  UpToDate: 'Atualizado',
  Outdated: 'Desatualizado',
  Unknown: 'Desconhecido',
};
