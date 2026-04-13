import {
  DocumentStatusKind,
  INITIAL_DOCUMENT_STATE,
  LoadingPhase,
  WebviewMessage,
  documentReducer,
} from '../webview/context/documentReducer';
import { MotionType, PathBounds, PathSegment } from '../visualizer/types';

const segment: PathSegment = {
  type: MotionType.FEED,
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ],
};

const bounds: PathBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 10, y: 0, z: 0 },
};

const updateMessage: WebviewMessage = {
  type: 'update',
  segments: [segment],
  bounds,
  sourceTokens: [],
  referencedVariables: [],
  settingsVariables: [],
};

describe('documentReducer', () => {
  it('starts in the idle state', () => {
    expect(INITIAL_DOCUMENT_STATE.status.kind).toBe(DocumentStatusKind.IDLE);
    expect(INITIAL_DOCUMENT_STATE.segments).toHaveLength(0);
  });

  describe('loading action', () => {
    it('transitions idle → loading with the given phase and filename', () => {
      const next = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'loading',
        phase: LoadingPhase.PARSING,
        filename: 'surface-finish.ngc',
      });

      expect(next.status.kind).toBe(DocumentStatusKind.LOADING);
      if (next.status.kind === DocumentStatusKind.LOADING) {
        expect(next.status.phase).toBe(LoadingPhase.PARSING);
        expect(next.status.filename).toBe('surface-finish.ngc');
      }
    });

    it('advances the phase while preserving the filename', () => {
      const loading = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'loading',
        phase: LoadingPhase.PARSING,
        filename: 'surface-finish.ngc',
      });
      const extracting = documentReducer(loading, {
        type: 'loading',
        phase: LoadingPhase.EXTRACTING,
        filename: 'surface-finish.ngc',
      });

      if (extracting.status.kind === DocumentStatusKind.LOADING) {
        expect(extracting.status.phase).toBe(LoadingPhase.EXTRACTING);
        expect(extracting.status.filename).toBe('surface-finish.ngc');
      } else {
        throw new Error('expected LOADING state');
      }
    });

    it('clears any previous error when loading starts', () => {
      const errored = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'error',
        message: 'parse failed',
      });
      const loading = documentReducer(errored, {
        type: 'loading',
        phase: LoadingPhase.PARSING,
        filename: null,
      });

      expect(loading.status.kind).toBe(DocumentStatusKind.LOADING);
    });
  });

  describe('update action', () => {
    it('transitions to ready with segments and bounds', () => {
      const loading = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'loading',
        phase: LoadingPhase.PARSING,
        filename: null,
      });
      const next = documentReducer(loading, updateMessage);

      expect(next.status.kind).toBe(DocumentStatusKind.READY);
      expect(next.segments).toHaveLength(1);
      expect(next.bounds).toEqual(bounds);
    });

    it('transitions to empty when the update contains no segments', () => {
      const next = documentReducer(INITIAL_DOCUMENT_STATE, {
        ...updateMessage,
        segments: [],
        bounds: null,
      });

      expect(next.status.kind).toBe(DocumentStatusKind.EMPTY);
      expect(next.segments).toHaveLength(0);
    });
  });

  describe('error action', () => {
    it('transitions to error with the given message', () => {
      const loading = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'loading',
        phase: LoadingPhase.PARSING,
        filename: 'bad.ngc',
      });
      const next = documentReducer(loading, {
        type: 'error',
        message: 'Unexpected token at line 42',
      });

      expect(next.status.kind).toBe(DocumentStatusKind.ERROR);
      if (next.status.kind === DocumentStatusKind.ERROR) {
        expect(next.status.message).toBe('Unexpected token at line 42');
        expect(next.status.filename).toBe('bad.ngc');
      }
    });

    it('uses a generic message when none is supplied', () => {
      const next = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'error',
        message: '',
      });

      if (next.status.kind === DocumentStatusKind.ERROR) {
        expect(next.status.message.length).toBeGreaterThan(0);
      } else {
        throw new Error('expected ERROR state');
      }
    });
  });

  describe('invariants', () => {
    it('never shows empty and loading simultaneously', () => {
      // This is the core bug: status is a single discriminated value,
      // so "loading" and "empty" can never coexist.
      const states = [
        documentReducer(INITIAL_DOCUMENT_STATE, {
          type: 'loading',
          phase: LoadingPhase.PARSING,
          filename: null,
        }),
        documentReducer(INITIAL_DOCUMENT_STATE, {
          ...updateMessage,
          segments: [],
          bounds: null,
        }),
      ];

      for (const s of states) {
        // Exactly one kind at a time
        const kinds: DocumentStatusKind[] = [
          DocumentStatusKind.IDLE,
          DocumentStatusKind.LOADING,
          DocumentStatusKind.READY,
          DocumentStatusKind.EMPTY,
          DocumentStatusKind.ERROR,
        ];
        const matches = kinds.filter((k) => s.status.kind === k);
        expect(matches).toHaveLength(1);
      }
    });
  });
});
