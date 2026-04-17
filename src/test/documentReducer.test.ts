import {
  DocumentStatusKind,
  ErrorKind,
  INITIAL_DOCUMENT_STATE,
  LoadingPhase,
  WebviewMessage,
  documentReducer,
} from '../webview/context/documentReducer';
import { MotionType, PathBounds, PathSegment } from '../visualizer/types';
import { Range } from '../parser/nodes/Range';

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
        errorKind: ErrorKind.PARSE_FAILURE,
        message: 'parse failed',
        range: null,
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
    it('transitions to error with the given message and errorKind', () => {
      const loading = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'loading',
        phase: LoadingPhase.PARSING,
        filename: 'bad.ngc',
      });
      const next = documentReducer(loading, {
        type: 'error',
        errorKind: ErrorKind.PARSE_FAILURE,
        message: 'Unexpected token at line 42',
        range: null,
      });

      expect(next.status.kind).toBe(DocumentStatusKind.ERROR);
      if (next.status.kind === DocumentStatusKind.ERROR) {
        expect(next.status.errorKind).toBe(ErrorKind.PARSE_FAILURE);
        expect(next.status.message).toBe('Unexpected token at line 42');
        expect(next.status.filename).toBe('bad.ngc');
      }
    });

    it('distinguishes worker crash from parse failure', () => {
      const crash = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'error',
        errorKind: ErrorKind.WORKER_CRASH,
        message: 'Visualizer worker exited with code 1',
        range: null,
      });

      if (crash.status.kind === DocumentStatusKind.ERROR) {
        expect(crash.status.errorKind).toBe(ErrorKind.WORKER_CRASH);
      } else {
        throw new Error('expected ERROR state');
      }
    });

    it('uses a generic message when none is supplied', () => {
      const next = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'error',
        errorKind: ErrorKind.UNKNOWN,
        message: '',
        range: null,
      });

      if (next.status.kind === DocumentStatusKind.ERROR) {
        expect(next.status.message.length).toBeGreaterThan(0);
        expect(next.status.errorKind).toBe(ErrorKind.UNKNOWN);
      } else {
        throw new Error('expected ERROR state');
      }
    });

    it('carries range through to ERROR status for PARSE_FAILURE', () => {
      const range = Range.create(3, 11, 3, 15);
      const next = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'error',
        errorKind: ErrorKind.PARSE_FAILURE,
        message: 'Unexpected character',
        range,
      });

      if (next.status.kind === DocumentStatusKind.ERROR) {
        expect(next.status.range).toEqual(range);
      } else {
        throw new Error('expected ERROR state');
      }
    });

    it('preserves range: null in ERROR status for PARSE_FAILURE when not provided', () => {
      const next = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'error',
        errorKind: ErrorKind.PARSE_FAILURE,
        message: 'Parse error',
        range: null,
      });

      if (next.status.kind === DocumentStatusKind.ERROR) {
        expect(next.status.range).toBeNull();
      } else {
        throw new Error('expected ERROR state');
      }
    });

    it('invariant: range is null for WORKER_CRASH even when action provides one', () => {
      const range = Range.create(0, 0, 0, 1);
      const next = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'error',
        errorKind: ErrorKind.WORKER_CRASH,
        message: 'crash',
        range,
      });

      if (next.status.kind === DocumentStatusKind.ERROR) {
        expect(next.status.range).toBeNull();
      } else {
        throw new Error('expected ERROR state');
      }
    });

    it('invariant: range is null for UNKNOWN even when action provides one', () => {
      const range = Range.create(1, 4, 1, 5);
      const next = documentReducer(INITIAL_DOCUMENT_STATE, {
        type: 'error',
        errorKind: ErrorKind.UNKNOWN,
        message: 'unknown',
        range,
      });

      if (next.status.kind === DocumentStatusKind.ERROR) {
        expect(next.status.range).toBeNull();
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
