import { PathPoint } from '../../visualizer/types';

/** Playback state machine status. */
export enum PlaybackStatus {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
}

/** Speed multiplier presets for the playback speed selector. */
export const SPEED_PRESETS: readonly number[] = [0.25, 0.5, 1, 2, 5, 10, 25, 50] as const;

/** Default speed multiplier index (5x). */
export const DEFAULT_SPEED_MULTIPLIER = 5;

/** Throttle interval in ms for UI updates during playback. */
export const UI_THROTTLE_MS = 100;

/** Throttle interval in ms for source line navigation during playback. */
export const SOURCE_LINE_THROTTLE_MS = 200;

/**
 * Read-only playback state exposed to UI components.
 * Updated at a throttled rate (~100ms) to avoid re-render thrashing.
 */
export interface PlaybackSnapshot {
  readonly status: PlaybackStatus;
  readonly currentIndex: number;
  readonly segmentProgress: number;
  readonly speedMultiplier: number;
  readonly totalSegments: number;
  readonly toolPosition: PathPoint;
}

/**
 * Actions exposed by the playback context to control playback.
 */
export interface PlaybackActions {
  readonly play: () => void;
  readonly pause: () => void;
  /** Reset to beginning, stay in playback mode (paused at segment 0). */
  readonly stop: () => void;
  /** Exit playback mode entirely, return to full static view. */
  readonly exit: () => void;
  readonly stepForward: () => void;
  readonly stepBack: () => void;
  readonly seekToSegment: (index: number) => void;
  readonly setSpeed: (multiplier: number) => void;
}

/**
 * Discriminated union for playback control messages posted to the webview window.
 * Mirrors PlaybackActions — used by the screenshot harness to drive scene #7.
 */
export type PlaybackControlMessage =
  | { readonly type: 'playbackControl'; readonly action: 'play' }
  | { readonly type: 'playbackControl'; readonly action: 'pause' }
  | { readonly type: 'playbackControl'; readonly action: 'stop' }
  | { readonly type: 'playbackControl'; readonly action: 'exit' }
  | { readonly type: 'playbackControl'; readonly action: 'stepForward' }
  | { readonly type: 'playbackControl'; readonly action: 'stepBack' }
  | { readonly type: 'playbackControl'; readonly action: 'seekToSegment'; readonly index: number }
  | { readonly type: 'playbackControl'; readonly action: 'setSpeed'; readonly multiplier: number };
