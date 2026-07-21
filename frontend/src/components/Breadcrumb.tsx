import { useNavigate } from 'react-router-dom';

export interface BreadcrumbSegment {
  label: string;
  to?: string; // omit for the current (non-clickable) page
}

/** Clickable "Aplicações / app / env / página" trail — every detail screen under an
 * ApplicationEnvironment used to render this as a plain string, which meant the only way
 * back was the sidebar link, not the breadcrumb itself. */
export default function Breadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  const nav = useNavigate();
  return (
    <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
      {segments.map((s, i) => (
        <span key={i}>
          {i > 0 && ' / '}
          {s.to ? (
            <span
              onClick={() => nav(s.to!)}
              style={{ cursor: 'pointer', color: 'var(--text-2)' }}
              className="hover-teal"
            >
              {s.label}
            </span>
          ) : (
            s.label
          )}
        </span>
      ))}
    </div>
  );
}
