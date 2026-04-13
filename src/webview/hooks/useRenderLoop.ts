import { useCallback, useRef } from 'react';
import {
  PathBounds,
  PathPoint,
  PathSegment,
  VisualizerConfig,
} from '../../visualizer/types';
import { CameraState } from '../types';
import { projectBatch } from '../projection';
import { drawAxes } from '../axes';
import { drawGrid } from '../grid';
import { drawToolMarkerBody, drawToolMarkerTip } from '../toolMarker';
import { ProjectedFrame } from '../hitTesting';
import { PlaybackStatus } from '../playback/types';
import { FrameScratch, GeometryCache } from '../geometryCache';
import { StyleBucket } from '../renderBuckets';
import {
  DEFAULT_BACKGROUND_COLOR,
  HOVER_ALPHA,
  HOVER_SHADOW_BLUR,
  HOVER_THICKNESS_FACTOR,
  MINIMUM_THICKNESS,
  PLAYBACK_PAST_OPACITY,
  RAPID_DASH_PATTERN,
  RAPID_OPACITY,
  RAPID_THICKNESS_FACTOR,
} from '../constants';

export interface PlaybackRenderRefs {
  readonly statusRef: React.RefObject<PlaybackStatus>;
  readonly currentIndexRef: React.RefObject<number>;
  readonly toolPositionRef: React.RefObject<PathPoint>;
}

export interface UseRenderLoopResult {
  readonly scheduleRender: () => void;
  /** Render immediately (synchronous). Use from within an existing rAF callback. */
  readonly renderNow: () => void;
  readonly renderOverlay: (hoveredIndex: number | null) => void;
  readonly getProjectedFrame: () => ProjectedFrame;
  readonly clearProjectedCache: () => void;
}

// Alpha sub-key for the (bucket × alphaState) batching grid.
const ALPHA_FULL = 0;
const ALPHA_RAPID = 1;
const ALPHA_PAST = 2;

const EMPTY_FRAME: ProjectedFrame = {
  screen: new Float32Array(0),
  segmentStart: new Uint32Array(0),
  segmentLength: new Uint32Array(0),
  drawnSegments: new Uint32Array(0),
  drawnCount: 0,
};

/**
 * Manages the requestAnimationFrame render loop for the tool-path canvas.
 *
 * The hot path is fully zero-allocation during orbit: a typed-array
 * {@link GeometryCache} is built once per segments load, reusable
 * {@link FrameScratch} buffers hold per-frame screen coords and depth,
 * and segments are drawn as bucketed Path2D batches keyed by
 * (StyleBucket × alphaState) — so the 190k-segment benchmark collapses
 * to O(bucket × alphaState) stroke() calls instead of O(segmentCount).
 *
 * Painter's-algorithm depth sorting is preserved on the fast path: we
 * sort segment indices by per-segment midpoint depth every frame, which
 * is the correctness mechanism CNC users rely on for safe toolpath
 * visualization on Canvas2D (no depth buffer).
 */
export function useRenderLoop(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  overlayRef: React.RefObject<HTMLCanvasElement | null>,
  segmentsRef: React.RefObject<PathSegment[]>,
  boundsRef: React.RefObject<PathBounds | null>,
  cameraRef: React.RefObject<CameraState | null>,
  settingsRef: React.RefObject<VisualizerConfig>,
  playbackRef?: PlaybackRenderRefs
): UseRenderLoopResult {
  const animationFrameIdRef = useRef<number | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);
  const renderOverlayRef = useRef<(hoveredIndex: number | null) => void>(() => {});
  const backgroundColorRef = useRef<string>(
    getComputedStyle(document.documentElement)
      .getPropertyValue('--vscode-editor-background')
      .trim() || DEFAULT_BACKGROUND_COLOR
  );

  // Built lazily and rebuilt only when the segments reference changes.
  const cachedSegmentsRef = useRef<PathSegment[] | null>(null);
  const geometryRef = useRef<GeometryCache | null>(null);
  const scratchRef = useRef<FrameScratch | null>(null);
  const projectedFrameRef = useRef<ProjectedFrame>(EMPTY_FRAME);

  const render = useCallback(() => {
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = null;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) return;

    const camera = cameraRef.current;
    if (!camera) return;

    const segments = segmentsRef.current;
    const bounds = boundsRef.current;
    const settings = settingsRef.current;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = backgroundColorRef.current;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    if (bounds && settings.showGrid) {
      drawGrid(
        context,
        camera,
        canvasWidth,
        canvasHeight,
        bounds,
        settings.gridSpacing,
        settings.projection
      );
    }

    if (segments.length === 0) {
      projectedFrameRef.current = EMPTY_FRAME;
      context.globalAlpha = 1.0;
      context.setLineDash([]);
      drawAxes(context, camera, canvasWidth, canvasHeight, settings.projection);
      renderOverlayRef.current(hoveredIndexRef.current);
      return;
    }

    // Rebuild geometry only when segments identity changes.
    if (cachedSegmentsRef.current !== segments || geometryRef.current === null) {
      const geometry = GeometryCache.build(segments);
      geometryRef.current = geometry;
      scratchRef.current = FrameScratch.forCache(geometry);
      cachedSegmentsRef.current = segments;
    }
    const geometry = geometryRef.current;
    const scratch = scratchRef.current!;

    const thickness = Math.max(MINIMUM_THICKNESS, settings.lineThickness);
    const rapidThickness = Math.max(MINIMUM_THICKNESS, thickness * RAPID_THICKNESS_FACTOR);
    const projectionMode = settings.projection;

    const isPlaybackActive =
      playbackRef?.statusRef.current !== undefined &&
      playbackRef.statusRef.current !== PlaybackStatus.IDLE;
    const playbackIndex = playbackRef?.currentIndexRef.current ?? -1;
    const visibleCount = isPlaybackActive
      ? Math.min(Math.max(playbackIndex + 1, 0), geometry.segmentCount)
      : geometry.segmentCount;

    // Project every point once. Cheap per point (≈ a dozen FLOPs, no
    // allocation) so we project the entire cache even though playback
    // may hide the tail — this keeps the hot loop branch-free.
    projectBatch(
      geometry.worldPoints,
      geometry.pointCount,
      camera,
      canvasWidth,
      canvasHeight,
      projectionMode,
      scratch.screen,
      scratch.pointDepth
    );

    // Build the list of drawn segments + per-segment sort depth.
    const showRapidMoves = settings.showRapidMoves;
    const { segmentStart, segmentLength, segmentBucket, segmentMidpoint } = geometry;
    const { pointDepth, segmentDepth, sortedSegments } = scratch;

    let drawnCount = 0;
    for (let i = 0; i < visibleCount; i++) {
      if (!showRapidMoves && segmentBucket[i] === StyleBucket.RAPID) {
        continue;
      }
      const midDepth = pointDepth[segmentMidpoint[i]];
      // Behind-camera midpoints get pushed to the back of the sort so
      // they don't overdraw foreground geometry if any sub-edge survives.
      segmentDepth[i] = midDepth < 0.01 ? Infinity : midDepth;
      sortedSegments[drawnCount++] = i;
    }

    // Painter's sort: back-to-front (larger depth first). In-place on a
    // typed Uint32Array via .subarray — no allocation beyond the view.
    const drawList = sortedSegments.subarray(0, drawnCount);
    drawList.sort((a, b) => segmentDepth[b] - segmentDepth[a]);

    // --- Batched stroke pass ---------------------------------------------
    //
    // Instead of calling stroke() once per segment (190k calls on the
    // benchmark), we build one Path2D per (bucket, alphaState) pair and
    // flush it whenever the next segment's state key differs. In the
    // common case where the painter's sort keeps same-bucket segments
    // adjacent, this collapses to ~3-10 strokes per frame.
    const bucketColors = [
      settings.feedColor,
      settings.rapidColor,
      settings.arcColor,
    ];
    const bucketThickness = [thickness, rapidThickness, thickness];

    context.lineCap = 'round';
    context.lineJoin = 'round';

    let currentBucket = -1;
    let currentAlpha = -1;
    let currentPath: Path2D | null = null;

    const screen = scratch.screen;

    const flush = () => {
      if (currentPath === null || currentBucket < 0) return;
      context.strokeStyle = bucketColors[currentBucket];
      context.lineWidth = bucketThickness[currentBucket];
      context.setLineDash(
        currentBucket === StyleBucket.RAPID ? (RAPID_DASH_PATTERN as number[]) : []
      );
      switch (currentAlpha) {
        case ALPHA_PAST:
          context.globalAlpha = PLAYBACK_PAST_OPACITY;
          break;
        case ALPHA_RAPID:
          context.globalAlpha = RAPID_OPACITY;
          break;
        default:
          context.globalAlpha = 1.0;
      }
      context.stroke(currentPath);
    };

    for (let d = 0; d < drawnCount; d++) {
      const segIdx = drawList[d];
      const bucket = segmentBucket[segIdx];
      const isRapid = bucket === StyleBucket.RAPID;

      let alphaState: number;
      if (isPlaybackActive && segIdx < playbackIndex) {
        alphaState = ALPHA_PAST;
      } else if (isPlaybackActive && segIdx === playbackIndex) {
        alphaState = ALPHA_FULL;
      } else if (isRapid) {
        alphaState = ALPHA_RAPID;
      } else {
        alphaState = ALPHA_FULL;
      }

      if (bucket !== currentBucket || alphaState !== currentAlpha) {
        flush();
        currentBucket = bucket;
        currentAlpha = alphaState;
        currentPath = new Path2D();
      }

      // Append the segment polyline to the active Path2D, breaking
      // on NaN (behind-camera) points.
      const start = segmentStart[segIdx];
      const length = segmentLength[segIdx];
      let pathStarted = false;
      const end = start + length;
      for (let p = start; p < end; p++) {
        const sBase = p * 2;
        const x = screen[sBase];
        // Fast NaN check: NaN !== NaN.
        if (x !== x) {
          pathStarted = false;
          continue;
        }
        const y = screen[sBase + 1];
        if (!pathStarted) {
          currentPath!.moveTo(x, y);
          pathStarted = true;
        } else {
          currentPath!.lineTo(x, y);
        }
      }
    }
    flush();

    context.globalAlpha = 1.0;
    context.setLineDash([]);

    // Expose the drawn set so hit testing can match what the user sees.
    // One tiny wrapper object per frame — the typed arrays beneath it
    // are reused, so hot-path allocation is still bounded.
    projectedFrameRef.current = {
      screen,
      segmentStart,
      segmentLength,
      drawnSegments: sortedSegments,
      drawnCount,
    };

    // Draw tool marker body before axes so axes render above the cone/cylinder
    if (isPlaybackActive && playbackRef?.toolPositionRef.current) {
      drawToolMarkerBody(
        context,
        playbackRef.toolPositionRef.current,
        camera,
        canvasWidth,
        canvasHeight,
        projectionMode
      );
    }

    drawAxes(context, camera, canvasWidth, canvasHeight, settings.projection);

    if (isPlaybackActive && playbackRef?.toolPositionRef.current) {
      drawToolMarkerTip(
        context,
        playbackRef.toolPositionRef.current,
        camera,
        canvasWidth,
        canvasHeight,
        projectionMode
      );
    }

    // Keep the highlight overlay in sync with the freshly-rebuilt
    // projection so it tracks its 3D segment during camera orbit (#136).
    renderOverlayRef.current(hoveredIndexRef.current);
  }, [canvasRef, segmentsRef, boundsRef, cameraRef, settingsRef, playbackRef]);

  const scheduleRender = useCallback(() => {
    if (animationFrameIdRef.current === null) {
      animationFrameIdRef.current = requestAnimationFrame(render);
    }
  }, [render]);

  const renderOverlay = useCallback(
    (hoveredIndex: number | null) => {
      hoveredIndexRef.current = hoveredIndex;
      const overlay = overlayRef.current;
      const ctx = overlay?.getContext('2d');
      if (!overlay || !ctx) return;

      ctx.clearRect(0, 0, overlay.width, overlay.height);
      const segments = segmentsRef.current;
      const settings = settingsRef.current;

      if (hoveredIndex === null || hoveredIndex >= segments.length) return;

      const geometry = geometryRef.current;
      const frame = projectedFrameRef.current;
      if (!geometry || frame.drawnCount === 0) return;
      if (hoveredIndex >= geometry.segmentCount) return;

      const bucket = geometry.segmentBucket[hoveredIndex];
      const color =
        bucket === StyleBucket.RAPID
          ? settings.rapidColor
          : bucket === StyleBucket.ARC
          ? settings.arcColor
          : settings.feedColor;

      const thickness = Math.max(MINIMUM_THICKNESS, settings.lineThickness);
      const start = geometry.segmentStart[hoveredIndex];
      const length = geometry.segmentLength[hoveredIndex];
      if (length < 2) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness * HOVER_THICKNESS_FACTOR;
      ctx.globalAlpha = HOVER_ALPHA;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = HOVER_SHADOW_BLUR;
      ctx.setLineDash([]);

      const screen = frame.screen;
      ctx.beginPath();
      let pathStarted = false;
      const end = start + length;
      for (let p = start; p < end; p++) {
        const sBase = p * 2;
        const x = screen[sBase];
        if (x !== x) {
          pathStarted = false;
          continue;
        }
        const y = screen[sBase + 1];
        if (!pathStarted) {
          ctx.moveTo(x, y);
          pathStarted = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    },
    [overlayRef, segmentsRef, settingsRef]
  );

  renderOverlayRef.current = renderOverlay;

  const getProjectedFrame = useCallback(() => projectedFrameRef.current, []);
  const clearProjectedCache = useCallback(() => {
    projectedFrameRef.current = EMPTY_FRAME;
  }, []);

  return {
    scheduleRender,
    renderNow: render,
    renderOverlay,
    getProjectedFrame,
    clearProjectedCache,
  };
}
