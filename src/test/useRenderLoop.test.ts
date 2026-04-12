/**
 * Regression test for #136: when the camera orbits/pans/zooms, the highlight
 * overlay must be redrawn with the refreshed projection cache so the highlight
 * tracks its underlying 3D segment instead of staying frozen at click-time
 * screen coordinates.
 *
 * The webview rendering hook is exercised directly without React by stubbing
 * the small subset of React hook primitives it relies on (useRef/useCallback).
 * This keeps the test in the existing plain-ts Jest harness — no jsdom, no
 * React testing libraries — mirroring how other webview modules (projection,
 * hitTesting, grid) are tested in this repo.
 */

jest.mock('react', () => ({
  useRef: <T>(initial: T) => ({ current: initial ?? null }),
  useCallback: <T>(fn: T) => fn,
}));

jest.mock('../webview/projection', () => ({
  // Deterministic identity-ish projection so every point is considered visible
  // and lands on screen. Depth is threaded through for the painter's sort.
  project: (x: number, y: number, z: number) => ({
    x: x + 400,
    y: y + 300,
    depth: z,
  }),
}));

jest.mock('../webview/axes', () => ({ drawAxes: jest.fn() }));
jest.mock('../webview/grid', () => ({ drawGrid: jest.fn() }));
jest.mock('../webview/toolMarker', () => ({
  drawToolMarkerBody: jest.fn(),
  drawToolMarkerTip: jest.fn(),
}));

// useRenderLoop reads the VS Code editor background colour from the document
// once, at hook-creation time. Stub the browser globals it touches before
// importing the module under test.
(global as unknown as { document: unknown }).document = { documentElement: {} };
(global as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({
  getPropertyValue: () => '',
});

import { useRenderLoop } from '../webview/hooks/useRenderLoop';
import {
  MotionType,
  PathBounds,
  PathSegment,
  ProjectionMode,
  VisualizerConfig,
} from '../visualizer/types';
import { CameraState } from '../webview/types';

interface MockCtx {
  clearRect: jest.Mock;
  fillRect: jest.Mock;
  beginPath: jest.Mock;
  moveTo: jest.Mock;
  lineTo: jest.Mock;
  stroke: jest.Mock;
  save: jest.Mock;
  restore: jest.Mock;
  setLineDash: jest.Mock;
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  globalAlpha: number;
  lineCap: string;
  lineJoin: string;
  shadowColor: string;
  shadowBlur: number;
}

function createMockCtx(): MockCtx {
  return {
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    setLineDash: jest.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    lineCap: '',
    lineJoin: '',
    shadowColor: '',
    shadowBlur: 0,
  };
}

function createMockCanvas(ctx: MockCtx): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

function makeRef<T>(value: T): React.RefObject<T> {
  return { current: value } as React.RefObject<T>;
}

function makeSettings(): VisualizerConfig {
  return {
    rapidColor: '#ff0000',
    feedColor: '#00ff00',
    arcColor: '#0000ff',
    lineThickness: 2,
    showGrid: false,
    gridSpacing: 10,
    showRapidMoves: true,
    projection: ProjectionMode.PERSPECTIVE,
    playback: {
      rapidSpeed: 3000,
      defaultFeedRate: 500,
      followSourceLine: false,
    },
  };
}

function makeCamera(): CameraState {
  return {
    theta: 0,
    phi: 0,
    radius: 100,
    panX: 0,
    panY: 0,
    target: { x: 0, y: 0, z: 0 },
  };
}

function makeSegment(): PathSegment {
  return {
    type: MotionType.FEED,
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 5, z: 0 },
      { x: 10, y: 10, z: 0 },
    ],
  };
}

function makeBounds(): PathBounds {
  return {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 10, y: 10, z: 0 },
  };
}

describe('useRenderLoop', () => {
  describe('highlight overlay tracks camera changes (#136)', () => {
    it('redraws the highlight overlay when the main canvas re-renders', () => {
      const canvasCtx = createMockCtx();
      const overlayCtx = createMockCtx();
      const canvas = createMockCanvas(canvasCtx);
      const overlay = createMockCanvas(overlayCtx);

      const segments = [makeSegment()];

      const loop = useRenderLoop(
        makeRef<HTMLCanvasElement | null>(canvas),
        makeRef<HTMLCanvasElement | null>(overlay),
        makeRef<PathSegment[]>(segments),
        makeRef<PathBounds | null>(makeBounds()),
        makeRef<CameraState | null>(makeCamera()),
        makeRef<VisualizerConfig>(makeSettings())
      );

      // Populate the projection cache by rendering the main canvas once.
      loop.renderNow();

      // A click has just selected segment 0 — overlay is drawn the first time
      // from the hit-test code path.
      loop.renderOverlay(0);
      expect(overlayCtx.stroke).toHaveBeenCalledTimes(1);

      // Reset the overlay spies so we can prove the *next* overlay draw comes
      // purely from the main render pipeline, not from another renderOverlay
      // call outside the hook.
      overlayCtx.clearRect.mockClear();
      overlayCtx.stroke.mockClear();
      overlayCtx.beginPath.mockClear();

      // Simulate a camera change — the main render loop re-runs, rebuilds the
      // projection cache, and (with the #136 fix) re-issues the overlay draw
      // with the stored hovered index.
      loop.renderNow();

      expect(overlayCtx.clearRect).toHaveBeenCalled();
      expect(overlayCtx.beginPath).toHaveBeenCalled();
      expect(overlayCtx.stroke).toHaveBeenCalled();
    });

    it('does not stroke the overlay when no segment is highlighted', () => {
      const canvasCtx = createMockCtx();
      const overlayCtx = createMockCtx();
      const canvas = createMockCanvas(canvasCtx);
      const overlay = createMockCanvas(overlayCtx);

      const loop = useRenderLoop(
        makeRef<HTMLCanvasElement | null>(canvas),
        makeRef<HTMLCanvasElement | null>(overlay),
        makeRef<PathSegment[]>([makeSegment()]),
        makeRef<PathBounds | null>(makeBounds()),
        makeRef<CameraState | null>(makeCamera()),
        makeRef<VisualizerConfig>(makeSettings())
      );

      loop.renderNow();
      // No renderOverlay call — the hovered index stays null.

      overlayCtx.stroke.mockClear();
      loop.renderNow();

      // The overlay clear runs (cheap, always-safe), but nothing is drawn.
      expect(overlayCtx.stroke).not.toHaveBeenCalled();
    });
  });
});
