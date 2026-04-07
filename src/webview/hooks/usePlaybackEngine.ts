import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PathPoint, PathSegment } from '../../visualizer/types';
import { PlaybackStatus } from '../playback/types';
import { interpolatePolyline, polylineLength } from '../playback/geometry';
import { segmentDuration } from '../playback/timing';

// ── Exported interfaces ────────────────────────────────────────────

export interface PlaybackEngineRefs {
  readonly currentIndexRef: React.RefObject<number>;
  readonly segmentProgressRef: React.RefObject<number>;
  readonly toolPositionRef: React.RefObject<PathPoint>;
  readonly statusRef: React.RefObject<PlaybackStatus>;
}

export interface PlaybackEngineActions {
  readonly play: () => void;
  readonly pause: () => void;
  readonly stop: () => void;
  readonly exit: () => void;
  readonly stepForward: () => void;
  readonly stepBack: () => void;
  readonly seekToSegment: (index: number) => void;
  readonly setSpeed: (multiplier: number) => void;
}

interface EngineOptions {
  readonly segmentsRef: React.RefObject<PathSegment[]>;
  readonly rapidSpeed: number;
  readonly defaultFeedRate: number;
  readonly speedMultiplier: number;
  readonly onTick: () => void;
  readonly onStatusChange: () => void;
  readonly onSegmentChange: (index: number) => void;
}

// ── Origin constant ────────────────────────────────────────────────

const ORIGIN: PathPoint = { x: 0, y: 0, z: 0 };

// ── Hook ───────────────────────────────────────────────────────────

export function usePlaybackEngine(options: EngineOptions): {
  refs: PlaybackEngineRefs;
  actions: PlaybackEngineActions;
} {
  const { segmentsRef, onTick, onStatusChange, onSegmentChange } = options;

  // Hot-path state (never triggers React re-renders)
  const currentIndexRef = useRef<number>(0);
  const segmentProgressRef = useRef<number>(0);
  const toolPositionRef = useRef<PathPoint>(ORIGIN);
  const statusRef = useRef<PlaybackStatus>(PlaybackStatus.IDLE);

  // Timing state for rAF loop
  const rafIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Keep latest prop values in refs so rAF callback always sees current values
  const speedRef = useRef<number>(options.speedMultiplier);
  const rapidSpeedRef = useRef<number>(options.rapidSpeed);
  const defaultFeedRef = useRef<number>(options.defaultFeedRate);
  const onTickRef = useRef(onTick);
  const onStatusChangeRef = useRef(onStatusChange);
  const onSegmentChangeRef = useRef(onSegmentChange);

  // Sync refs with latest props each render
  speedRef.current = options.speedMultiplier;
  rapidSpeedRef.current = options.rapidSpeed;
  defaultFeedRef.current = options.defaultFeedRate;
  onTickRef.current = onTick;
  onStatusChangeRef.current = onStatusChange;
  onSegmentChangeRef.current = onSegmentChange;

  // ── Helpers ────────────────────────────────────────────────────────

  const updateToolPosition = useCallback(() => {
    const segments = segmentsRef.current;
    const index = currentIndexRef.current;
    if (segments.length === 0 || index >= segments.length) {
      toolPositionRef.current = ORIGIN;
      return;
    }
    toolPositionRef.current = interpolatePolyline(
      segments[index].points,
      segmentProgressRef.current
    );
  }, [segmentsRef]);

  const setStatus = useCallback((newStatus: PlaybackStatus) => {
    if (statusRef.current !== newStatus) {
      statusRef.current = newStatus;
      onStatusChangeRef.current();
    }
  }, []);

  const isAtEnd = useCallback((): boolean => {
    const segments = segmentsRef.current;
    return (
      segments.length === 0 ||
      (currentIndexRef.current >= segments.length - 1 && segmentProgressRef.current >= 1)
    );
  }, [segmentsRef]);

  // ── rAF loop ───────────────────────────────────────────────────────

  const tick = useCallback(
    (timestamp: number) => {
      if (statusRef.current !== PlaybackStatus.PLAYING) {
        return;
      }

      const lastTime = lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // First frame after play/resume: skip to avoid dt jump
      if (lastTime === 0) {
        rafIdRef.current = requestAnimationFrame(tick);
        return;
      }

      // Clamp dt to prevent large jumps when the webview panel is hidden
      // and regains focus (rAF resumes with a stale lastTime).
      const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
      const segments = segmentsRef.current;
      if (segments.length === 0) {
        return;
      }

      const speed = speedRef.current;
      let remainingTime = dt * speed;
      let index = currentIndexRef.current;
      let progress = segmentProgressRef.current;
      const prevIndex = index;

      while (remainingTime > 0 && index < segments.length) {
        const segment = segments[index];
        const duration = segmentDuration(segment, rapidSpeedRef.current, defaultFeedRef.current);

        if (duration === 0) {
          // Zero-length segment: complete it instantly and move on
          progress = 1;
          if (index < segments.length - 1) {
            index++;
            progress = 0;
            continue;
          }
          break;
        }

        // How much time remains in this segment at current progress
        const timeLeftInSegment = duration * (1 - progress);

        if (remainingTime >= timeLeftInSegment) {
          // Fully traverse this segment
          remainingTime -= timeLeftInSegment;
          progress = 1;

          if (index < segments.length - 1) {
            index++;
            progress = 0;
          } else {
            // Reached the end of the last segment
            break;
          }
        } else {
          // Partial advance within current segment
          progress += remainingTime / duration;
          remainingTime = 0;
        }
      }

      currentIndexRef.current = index;
      segmentProgressRef.current = Math.min(1, progress);
      updateToolPosition();

      if (index !== prevIndex) {
        onSegmentChangeRef.current(index);
      }

      onTickRef.current();

      // If at the end, pause
      if (index >= segments.length - 1 && progress >= 1) {
        setStatus(PlaybackStatus.PAUSED);
        return;
      }

      rafIdRef.current = requestAnimationFrame(tick);
    },
    [segmentsRef, updateToolPosition, setStatus]
  );

  const cancelLoop = useCallback(() => {
    if (rafIdRef.current !== 0) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    lastTimeRef.current = 0;
  }, []);

  // ── Actions ────────────────────────────────────────────────────────

  const play = useCallback(() => {
    if (statusRef.current === PlaybackStatus.PLAYING) {
      return;
    }
    if (segmentsRef.current.length === 0) {
      return;
    }

    // If at the end, restart from beginning
    if (isAtEnd()) {
      currentIndexRef.current = 0;
      segmentProgressRef.current = 0;
      updateToolPosition();
      onSegmentChangeRef.current(0);
    }

    lastTimeRef.current = 0; // Force dt=0 on first frame
    setStatus(PlaybackStatus.PLAYING);
    rafIdRef.current = requestAnimationFrame(tick);
  }, [isAtEnd, updateToolPosition, setStatus, tick]);

  const pause = useCallback(() => {
    if (statusRef.current !== PlaybackStatus.PLAYING) {
      return;
    }
    cancelLoop();
    setStatus(PlaybackStatus.PAUSED);
  }, [cancelLoop, setStatus]);

  const stop = useCallback(() => {
    cancelLoop();
    currentIndexRef.current = 0;
    segmentProgressRef.current = 0;
    updateToolPosition();
    setStatus(PlaybackStatus.PAUSED);
    onTickRef.current();
    onSegmentChangeRef.current(0);
  }, [cancelLoop, updateToolPosition, setStatus]);

  const exit = useCallback(() => {
    cancelLoop();
    currentIndexRef.current = 0;
    segmentProgressRef.current = 0;
    updateToolPosition();
    setStatus(PlaybackStatus.IDLE);
    onTickRef.current();
  }, [cancelLoop, updateToolPosition, setStatus]);

  const stepForward = useCallback(() => {
    const segments = segmentsRef.current;
    if (segments.length === 0) return;

    // If playing, pause first
    if (statusRef.current === PlaybackStatus.PLAYING) {
      cancelLoop();
    }

    const nextIndex = Math.min(currentIndexRef.current + 1, segments.length - 1);
    currentIndexRef.current = nextIndex;
    segmentProgressRef.current = 0;
    updateToolPosition();
    setStatus(PlaybackStatus.PAUSED);
    onTickRef.current();
    onSegmentChangeRef.current(nextIndex);
  }, [segmentsRef, cancelLoop, updateToolPosition, setStatus]);

  const stepBack = useCallback(() => {
    const segments = segmentsRef.current;
    if (segments.length === 0) return;

    // If playing, pause first
    if (statusRef.current === PlaybackStatus.PLAYING) {
      cancelLoop();
    }

    const prevIndex = Math.max(currentIndexRef.current - 1, 0);
    currentIndexRef.current = prevIndex;
    segmentProgressRef.current = 0;
    updateToolPosition();
    setStatus(PlaybackStatus.PAUSED);
    onTickRef.current();
    onSegmentChangeRef.current(prevIndex);
  }, [segmentsRef, cancelLoop, updateToolPosition, setStatus]);

  const seekToSegment = useCallback(
    (index: number) => {
      const segments = segmentsRef.current;
      if (segments.length === 0) return;

      const clamped = Math.max(0, Math.min(index, segments.length - 1));
      currentIndexRef.current = clamped;
      segmentProgressRef.current = 0;
      updateToolPosition();

      if (statusRef.current === PlaybackStatus.IDLE) {
        setStatus(PlaybackStatus.PAUSED);
      }

      onTickRef.current();
      onSegmentChangeRef.current(clamped);
    },
    [segmentsRef, updateToolPosition, setStatus]
  );

  const setSpeed = useCallback((multiplier: number) => {
    speedRef.current = multiplier;
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelLoop();
    };
  }, [cancelLoop]);

  // ── Return (memoized to prevent context value churn) ────────────────

  const refs = useMemo<PlaybackEngineRefs>(
    () => ({ currentIndexRef, segmentProgressRef, toolPositionRef, statusRef }),
    [] // Refs are created once by useRef — stable for the lifetime of the hook
  );

  const actions = useMemo<PlaybackEngineActions>(
    () => ({ play, pause, stop, exit, stepForward, stepBack, seekToSegment, setSpeed }),
    [play, pause, stop, exit, stepForward, stepBack, seekToSegment, setSpeed]
  );

  return { refs, actions };
}
