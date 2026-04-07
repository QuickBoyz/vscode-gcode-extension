import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
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

// ── Context value type ─────────────────────────────────────────────

interface PlaybackContextValue {
  readonly snapshot: PlaybackSnapshot;
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

// ── Context ────────────────────────────────────────────────────────

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

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

  // ── Context value ────────────────────────────────────────────────

  const value = useMemo<PlaybackContextValue>(
    () => ({
      snapshot,
      actions,
      engineRefs,
    }),
    [snapshot, actions, engineRefs]
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

// ── Consumer hooks ─────────────────────────────────────────────────

function usePlaybackContext(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error('usePlaybackContext must be used within PlaybackProvider');
  }
  return ctx;
}

/** Read-only playback state snapshot (throttled at ~100ms). */
export function usePlaybackSnapshot(): PlaybackSnapshot {
  return usePlaybackContext().snapshot;
}

/** Playback control actions (play, pause, stop, step, seek, setSpeed). */
export function usePlaybackActions(): PlaybackActions {
  return usePlaybackContext().actions;
}

/** Direct access to engine refs for hot-path rendering (canvas draw loop). */
export function usePlaybackEngineRefs(): PlaybackEngineRefs {
  return usePlaybackContext().engineRefs;
}
