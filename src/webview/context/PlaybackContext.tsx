import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PathSegment } from '../../visualizer/types';
import {
  DEFAULT_SPEED_MULTIPLIER,
  PlaybackActions,
  PlaybackSnapshot,
  PlaybackStatus,
  SOURCE_LINE_THROTTLE_MS,
  UI_THROTTLE_MS,
} from '../playback/types';
import {
  PlaybackEngineRefs,
  usePlaybackEngine,
} from '../hooks/usePlaybackEngine';
import vscode from '../vscodeApi';

// ── Context value types ────────────────────────────────────────────

/** Changes on every snapshot update (~10Hz during playback). */
interface PlaybackStateValue {
  readonly snapshot: PlaybackSnapshot;
}

/** Stable across snapshot updates — actions and refs don't change. */
interface PlaybackStableValue {
  readonly actions: PlaybackActions;
  readonly engineRefs: PlaybackEngineRefs;
}

// ── Provider props ─────────────────────────────────────────────────

interface PlaybackProviderProps {
  readonly children: React.ReactNode;
  readonly segmentsRef: React.RefObject<PathSegment[]>;
  /** Synchronous render — called directly from the playback rAF tick. */
  readonly renderNow: () => void;
  readonly rapidSpeed: number;
  readonly defaultFeedRate: number;
  readonly followSourceLine: boolean;
}

// ── Contexts (split to avoid snapshot churn re-rendering stable consumers) ──

const PlaybackStateCtx = createContext<PlaybackStateValue | null>(null);
const PlaybackStableCtx = createContext<PlaybackStableValue | null>(null);

// ── Initial snapshot ───────────────────────────────────────────────

const INITIAL_SNAPSHOT: PlaybackSnapshot = {
  status: PlaybackStatus.IDLE,
  currentIndex: 0,
  segmentProgress: 0,
  speedMultiplier: DEFAULT_SPEED_MULTIPLIER,
  totalSegments: 0,
  toolPosition: { x: 0, y: 0, z: 0 },
};

// ── Provider ───────────────────────────────────────────────────────

export function PlaybackProvider({
  children,
  segmentsRef,
  renderNow,
  rapidSpeed,
  defaultFeedRate,
  followSourceLine,
}: PlaybackProviderProps) {
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(INITIAL_SNAPSHOT);

  // Refs for latest prop values used in callbacks
  const followSourceLineRef = useRef(followSourceLine);
  followSourceLineRef.current = followSourceLine;
  const renderNowRef = useRef(renderNow);
  renderNowRef.current = renderNow;

  // Speed multiplier state (drives both engine ref and snapshot)
  const speedMultiplierRef = useRef(DEFAULT_SPEED_MULTIPLIER);

  // ── Throttled UI snapshot update ─────────────────────────────────

  const uiThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const snapshotPendingRef = useRef(false);

  const flushSnapshot = useCallback(() => {
    uiThrottleTimerRef.current = undefined;
    snapshotPendingRef.current = false;
    setSnapshot({
      status: engineRefsRef.current.statusRef.current,
      currentIndex: engineRefsRef.current.currentIndexRef.current,
      segmentProgress: engineRefsRef.current.segmentProgressRef.current,
      speedMultiplier: speedMultiplierRef.current,
      totalSegments: segmentsRef.current.length,
      toolPosition: { ...engineRefsRef.current.toolPositionRef.current },
    });
  }, [segmentsRef]);

  const throttledSnapshotUpdate = useCallback(() => {
    snapshotPendingRef.current = true;
    if (uiThrottleTimerRef.current === undefined) {
      uiThrottleTimerRef.current = setTimeout(flushSnapshot, UI_THROTTLE_MS);
    }
  }, [flushSnapshot]);

  const immediateSnapshotUpdate = useCallback(() => {
    // Cancel any pending throttled update
    if (uiThrottleTimerRef.current !== undefined) {
      clearTimeout(uiThrottleTimerRef.current);
      uiThrottleTimerRef.current = undefined;
    }
    snapshotPendingRef.current = false;
    setSnapshot({
      status: engineRefsRef.current.statusRef.current,
      currentIndex: engineRefsRef.current.currentIndexRef.current,
      segmentProgress: engineRefsRef.current.segmentProgressRef.current,
      speedMultiplier: speedMultiplierRef.current,
      totalSegments: segmentsRef.current.length,
      toolPosition: { ...engineRefsRef.current.toolPositionRef.current },
    });
  }, [segmentsRef]);

  // ── Source line following (throttled) ────────────────────────────

  const sourceLineThrottleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onSegmentChange = useCallback(
    (index: number) => {
      if (!followSourceLineRef.current) return;

      const segments = segmentsRef.current;
      if (index >= segments.length) return;

      const segment = segments[index];
      const sourceLine = segment.context?.sourceLine;
      if (sourceLine === undefined) return;

      if (sourceLineThrottleRef.current !== undefined) return;

      vscode.postMessage({ type: 'navigateToLine', line: sourceLine });
      sourceLineThrottleRef.current = setTimeout(() => {
        sourceLineThrottleRef.current = undefined;
      }, SOURCE_LINE_THROTTLE_MS);
    },
    [segmentsRef]
  );

  // ── Engine callbacks ─────────────────────────────────────────────

  const onTick = useCallback(() => {
    renderNowRef.current();
    throttledSnapshotUpdate();
  }, [throttledSnapshotUpdate]);

  const onStatusChange = useCallback(() => {
    immediateSnapshotUpdate();
  }, [immediateSnapshotUpdate]);

  // ── Engine ───────────────────────────────────────────────────────

  const { refs: engineRefs, actions: engineActions } = usePlaybackEngine({
    segmentsRef,
    rapidSpeed,
    defaultFeedRate,
    speedMultiplier: speedMultiplierRef.current,
    onTick,
    onStatusChange,
    onSegmentChange,
  });

  // Store engineRefs in a ref so snapshot callbacks can access them
  // without being re-created when engineRefs changes
  const engineRefsRef = useRef(engineRefs);
  engineRefsRef.current = engineRefs;

  // Guard: clamp playback index when segments change (document re-parsed)
  const prevSegmentCountRef = useRef(segmentsRef.current.length);
  useEffect(() => {
    const newCount = segmentsRef.current.length;
    if (newCount === prevSegmentCountRef.current) return;
    prevSegmentCountRef.current = newCount;

    if (engineRefs.statusRef.current === PlaybackStatus.IDLE) return;

    if (newCount === 0) {
      engineActions.exit();
    } else if (engineRefs.currentIndexRef.current >= newCount) {
      engineActions.seekToSegment(newCount - 1);
    }
  });

  // ── Wrapped actions (setSpeed also updates snapshot) ─────────────

  const setSpeed = useCallback(
    (multiplier: number) => {
      speedMultiplierRef.current = multiplier;
      engineActions.setSpeed(multiplier);
      immediateSnapshotUpdate();
    },
    [engineActions, immediateSnapshotUpdate]
  );

  const actions = useMemo<PlaybackActions>(
    () => ({
      play: engineActions.play,
      pause: engineActions.pause,
      stop: engineActions.stop,
      exit: engineActions.exit,
      stepForward: engineActions.stepForward,
      stepBack: engineActions.stepBack,
      seekToSegment: engineActions.seekToSegment,
      setSpeed,
    }),
    [engineActions, setSpeed]
  );

  // ── Context values ───────────────────────────────────────────────

  const stateValue = useMemo<PlaybackStateValue>(() => ({ snapshot }), [snapshot]);

  const stableValue = useMemo<PlaybackStableValue>(
    () => ({ actions, engineRefs }),
    [actions, engineRefs]
  );

  return (
    <PlaybackStableCtx.Provider value={stableValue}>
      <PlaybackStateCtx.Provider value={stateValue}>{children}</PlaybackStateCtx.Provider>
    </PlaybackStableCtx.Provider>
  );
}

// ── Consumer hooks ─────────────────────────────────────────────────

/** Read-only playback state snapshot (throttled at ~100ms). Subscribes to state context. */
export function usePlaybackSnapshot(): PlaybackSnapshot {
  const ctx = useContext(PlaybackStateCtx);
  if (!ctx) throw new Error('usePlaybackSnapshot must be used within PlaybackProvider');
  return ctx.snapshot;
}

/** Playback control actions. Subscribes to stable context (does NOT re-render on snapshot). */
export function usePlaybackActions(): PlaybackActions {
  const ctx = useContext(PlaybackStableCtx);
  if (!ctx) throw new Error('usePlaybackActions must be used within PlaybackProvider');
  return ctx.actions;
}

/** Direct access to engine refs. Subscribes to stable context (does NOT re-render on snapshot). */
export function usePlaybackEngineRefs(): PlaybackEngineRefs {
  const ctx = useContext(PlaybackStableCtx);
  if (!ctx) throw new Error('usePlaybackEngineRefs must be used within PlaybackProvider');
  return ctx.engineRefs;
}
