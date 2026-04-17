import {
  PathBounds,
  PathSegment,
  Range,
  ReferencedVariable,
  VisualizerConfig,
  VisualizerErrorKind,
} from '../../visualizer/types';

export type { Range };

/**
 * Re-export of {@link VisualizerErrorKind} under the webview-facing name
 * `ErrorKind`. Consumers get the enum values at runtime and the type at
 * compile time.
 */
export { VisualizerErrorKind as ErrorKind } from '../../visualizer/types';

// ── Source token type (reused across the webview) ───────────────────

export type SourceTokens = readonly { readonly text: string; readonly type: string }[][];

// ── Loading phases (mirrored on the extension side) ────────────────

export enum LoadingPhase {
  /** Tokenising and parsing the source text. */
  PARSING = 'parsing',
  /** Walking the AST and building geometry. */
  EXTRACTING = 'extracting',
  /** Handing data to the renderer for the first paint. */
  RENDERING = 'rendering',
}

// ── Document status (discriminated union) ───────────────────────────
//
// status is the single source of truth for *what to show*. A value can
// only be in one kind at a time, so the old "loading + empty at once"
// bug is unrepresentable.

export enum DocumentStatusKind {
  /** Panel just mounted, no source assigned yet. */
  IDLE = 'idle',
  /** Parse/extract/render pipeline in progress. */
  LOADING = 'loading',
  /** Parse succeeded and produced at least one path segment. */
  READY = 'ready',
  /** Parse succeeded but the program contained no motion commands. */
  EMPTY = 'empty',
  /** Parse or extraction failed. */
  ERROR = 'error',
}

export type DocumentStatus =
  | { readonly kind: DocumentStatusKind.IDLE }
  | {
      readonly kind: DocumentStatusKind.LOADING;
      readonly phase: LoadingPhase;
      readonly filename: string | null;
      readonly message?: string;
    }
  | { readonly kind: DocumentStatusKind.READY }
  | { readonly kind: DocumentStatusKind.EMPTY; readonly filename: string | null }
  | {
      readonly kind: DocumentStatusKind.ERROR;
      readonly errorKind: VisualizerErrorKind;
      readonly message: string;
      readonly filename: string | null;
      /** Populated for PARSE_FAILURE; null for WORKER_CRASH / UNKNOWN. */
      readonly range: Range | null;
    };

// ── Webview message protocol ────────────────────────────────────────

export type WebviewMessage =
  | {
      readonly type: 'update';
      readonly segments: PathSegment[];
      readonly bounds: PathBounds | null;
      readonly sourceTokens: SourceTokens | undefined;
      readonly referencedVariables: readonly ReferencedVariable[];
      readonly settingsVariables: readonly ReferencedVariable[];
    }
  | { readonly type: 'updateSettings'; readonly settings: Partial<VisualizerConfig> }
  | {
      readonly type: 'error';
      readonly errorKind: VisualizerErrorKind;
      readonly message: string;
      readonly range: Range | null;
    }
  | {
      readonly type: 'loading';
      readonly phase: LoadingPhase;
      readonly filename: string | null;
      readonly message?: string;
    };

// ── Document state & actions ────────────────────────────────────────

export interface DocumentState {
  readonly status: DocumentStatus;
  readonly segments: PathSegment[];
  readonly bounds: PathBounds | null;
  readonly sourceTokens: SourceTokens | undefined;
  readonly referencedVariables: readonly ReferencedVariable[];
  readonly settingsVariables: readonly ReferencedVariable[];
}

export type DocumentAction =
  | {
      readonly type: 'update';
      readonly segments: PathSegment[];
      readonly bounds: PathBounds | null;
      readonly sourceTokens: SourceTokens | undefined;
      readonly referencedVariables: readonly ReferencedVariable[];
      readonly settingsVariables: readonly ReferencedVariable[];
    }
  | {
      readonly type: 'loading';
      readonly phase: LoadingPhase;
      readonly filename: string | null;
      readonly message?: string;
    }
  | {
      readonly type: 'error';
      readonly errorKind: VisualizerErrorKind;
      readonly message: string;
      readonly range: Range | null;
    };

export const INITIAL_DOCUMENT_STATE: DocumentState = {
  status: { kind: DocumentStatusKind.IDLE },
  segments: [],
  bounds: null,
  sourceTokens: undefined,
  referencedVariables: [],
  settingsVariables: [],
};

const FALLBACK_ERROR_MESSAGE = 'An unknown visualizer error occurred.';

function currentFilename(state: DocumentState): string | null {
  const s = state.status;
  if (s.kind === DocumentStatusKind.LOADING) return s.filename;
  if (s.kind === DocumentStatusKind.EMPTY) return s.filename;
  if (s.kind === DocumentStatusKind.ERROR) return s.filename;
  return null;
}

export function documentReducer(state: DocumentState, action: DocumentAction): DocumentState {
  switch (action.type) {
    case 'update': {
      const empty = action.segments.length === 0;
      return {
        ...state,
        status: empty
          ? { kind: DocumentStatusKind.EMPTY, filename: currentFilename(state) }
          : { kind: DocumentStatusKind.READY },
        segments: action.segments,
        bounds: action.bounds,
        sourceTokens: action.sourceTokens,
        referencedVariables: action.referencedVariables,
        settingsVariables: action.settingsVariables,
      };
    }
    case 'loading': {
      return {
        ...state,
        status: {
          kind: DocumentStatusKind.LOADING,
          phase: action.phase,
          filename: action.filename,
          message: action.message,
        },
      };
    }
    case 'error': {
      // Invariant: range is non-null only for PARSE_FAILURE.
      const range = action.errorKind === VisualizerErrorKind.PARSE_FAILURE ? action.range : null;
      return {
        ...state,
        status: {
          kind: DocumentStatusKind.ERROR,
          errorKind: action.errorKind,
          message: action.message.length > 0 ? action.message : FALLBACK_ERROR_MESSAGE,
          filename: currentFilename(state),
          range,
        },
      };
    }
  }
}
