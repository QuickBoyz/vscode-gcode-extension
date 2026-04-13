import { LoadingPhase } from '../context/documentReducer';

interface LoadingOverlayProps {
  readonly phase: LoadingPhase;
  readonly filename: string | null;
}

const DEFAULT_LABEL = 'Loading…';

const PHASE_LABELS: Readonly<Record<LoadingPhase, string>> = {
  [LoadingPhase.PARSING]: 'Parsing G-code…',
  [LoadingPhase.EXTRACTING]: 'Building geometry…',
  [LoadingPhase.RENDERING]: 'Rendering…',
};

export function LoadingOverlay({ phase, filename }: LoadingOverlayProps) {
  return (
    <div id="loading-overlay" role="status" aria-live="polite">
      <div className="spinner" />
      <span className="loading-text">{PHASE_LABELS[phase] ?? DEFAULT_LABEL}</span>
      {filename && <span className="loading-filename">{filename}</span>}
    </div>
  );
}
