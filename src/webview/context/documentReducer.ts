import {
  PathBounds,
  PathSegment,
  ReferencedVariable,
  VisualizerConfig,
} from '../../visualizer/types';

// ── Source token type (reused across the webview) ───────────────────

export type SourceTokens = readonly { readonly text: string; readonly type: string }[][];

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
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'loading' };

// ── Document state & actions ────────────────────────────────────────

export interface DocumentState {
  readonly segments: PathSegment[];
  readonly bounds: PathBounds | null;
  readonly sourceTokens: SourceTokens | undefined;
  readonly referencedVariables: readonly ReferencedVariable[];
  readonly settingsVariables: readonly ReferencedVariable[];
  readonly error: string | null;
  readonly loading: boolean;
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
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'loading' };

export const INITIAL_DOCUMENT_STATE: DocumentState = {
  segments: [],
  bounds: null,
  sourceTokens: undefined,
  referencedVariables: [],
  settingsVariables: [],
  error: null,
  loading: false,
};

export function documentReducer(state: DocumentState, action: DocumentAction): DocumentState {
  switch (action.type) {
    case 'update':
      return {
        segments: action.segments,
        bounds: action.bounds,
        sourceTokens: action.sourceTokens,
        referencedVariables: action.referencedVariables,
        settingsVariables: action.settingsVariables,
        error: null,
        loading: false,
      };
    case 'error':
      return { ...state, error: action.message, loading: false };
    case 'loading':
      return { ...state, loading: true };
  }
}
