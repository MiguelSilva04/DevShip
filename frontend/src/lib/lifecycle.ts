// Shared LifecycleStatus type + color map — was duplicated across AppDetail, EnvDetail,
// Home and History. Labels stay the raw enum values (no existing PT translation for these
// was in use anywhere before this refactor); only the color/dot mapping is deduped here.
export type LifecycleStatus = 'Deploying' | 'Healthy' | 'Degraded' | 'Failed' | 'RolledBack' | 'Superseded';

export interface LifecycleColor {
  bg: string;
  col: string;
  bord: string;
  dot: string;
}

export const LIFECYCLE_COLOR: Record<LifecycleStatus, LifecycleColor> = {
  Healthy:    { bg: 'rgba(52,199,89,.13)',  col: '#5dd57b', bord: 'rgba(52,199,89,.24)',   dot: '#34C759' },
  Deploying:  { bg: 'rgba(224,169,59,.13)', col: '#ecc26b', bord: 'rgba(224,169,59,.26)',  dot: '#E0A93B' },
  Degraded:   { bg: 'rgba(241,85,108,.13)', col: '#ff8497', bord: 'rgba(241,85,108,.26)',  dot: '#F1556C' },
  Failed:     { bg: 'rgba(241,85,108,.13)', col: '#ff8497', bord: 'rgba(241,85,108,.26)',  dot: '#F1556C' },
  RolledBack: { bg: 'rgba(120,120,180,.13)',col: '#aab4ff', bord: 'rgba(120,120,180,.26)', dot: '#7880cc' },
  Superseded: { bg: 'rgba(150,150,150,.13)',col: 'var(--text-3)', bord: 'rgba(150,150,150,.26)', dot: '#888' },
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
