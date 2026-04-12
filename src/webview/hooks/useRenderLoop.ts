import { useCallback, useRef } from 'react';
import {
  MotionType,
  PathBounds,
  PathPoint,
  PathSegment,
  VisualizerConfig,
} from '../../visualizer/types';
import { CameraState } from '../types';
import { project } from '../projection';
import { drawAxes } from '../axes';
import { drawGrid } from '../grid';
import { drawToolMarkerBody, drawToolMarkerTip } from '../toolMarker';
import { ProjectedSegmentData } from '../hitTesting';
import { PlaybackStatus } from '../playback/types';
import {
  DEFAULT_BACKGROUND_COLOR,
  getSegmentColor,
  MINIMUM_THICKNESS,
  PLAYBACK_PAST_OPACITY,
  RAPID_DASH_PATTERN,
  RAPID_OPACITY,
  RAPID_THICKNESS_FACTOR,
  HOVER_THICKNESS_FACTOR,
  HOVER_ALPHA,
  HOVER_SHADOW_BLUR,
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
  readonly getProjectedCache: () => readonly ProjectedSegmentData[];
  readonly clearProjectedCache: () => void;
}

/**
 * Manages the requestAnimationFrame render loop for the tool-path canvas.
 * Renders segments with depth sorting (painter's algorithm) and caches
 * projected polylines for hit testing.
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
  const projectedCacheRef = useRef<ProjectedSegmentData[]>([]);
  const hoveredIndexRef = useRef<number | null>(null);
  const renderOverlayRef = useRef<(hoveredIndex: number | null) => void>(() => {});
  const backgroundColorRef = useRef<string>(
    getComputedStyle(document.documentElement)
      .getPropertyValue('--vscode-editor-background')
      .trim() || DEFAULT_BACKGROUND_COLOR
  );

  const render = useCallback(() => {
    // Cancel any pending scheduled render — we're rendering now.
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

    if (segments.length === 0) return;

    const thickness = Math.max(MINIMUM_THICKNESS, settings.lineThickness);
    const projectionMode = settings.projection;

    // Determine playback state
    const isPlaybackActive =
      playbackRef?.statusRef.current !== undefined &&
      playbackRef.statusRef.current !== PlaybackStatus.IDLE;
    const playbackIndex = playbackRef?.currentIndexRef.current ?? -1;

    // Depth-sort segments (painter's algorithm using mid-point depth)
    // Iterate directly with index to avoid both the filter allocation and O(n) indexOf.
    const visibleCount = isPlaybackActive
      ? Math.min(Math.max(playbackIndex + 1, 0), segments.length)
      : segments.length;

    const sorted: { segment: PathSegment; depth: number; segmentIndex: number }[] = [];
    for (let i = 0; i < visibleCount; i++) {
      const segment = segments[i];
      if (!segment) {
        continue;
      }
      const midpoint = segment.points[Math.floor(segment.points.length / 2)];
      const projected = project(
        midpoint.x,
        midpoint.y,
        midpoint.z,
        camera,
        canvasWidth,
        canvasHeight,
        projectionMode
      );
      sorted.push({ segment, depth: projected ? projected.depth : Infinity, segmentIndex: i });
    }
    sorted.sort((a, b) => b.depth - a.depth);

    const newProjectedCache: ProjectedSegmentData[] = [];

    for (const entry of sorted) {
      const segment = entry.segment;
      const isRapidMove = segment.type === MotionType.RAPID;

      if (isRapidMove && !settings.showRapidMoves) continue;

      const segmentIndex = entry.segmentIndex;
      const isCurrentSegment = isPlaybackActive && segmentIndex === playbackIndex;
      const isPastSegment = isPlaybackActive && segmentIndex < playbackIndex;

      const color = getSegmentColor(segment.type, settings);
      context.strokeStyle = color;
      context.lineWidth = isRapidMove
        ? Math.max(MINIMUM_THICKNESS, thickness * RAPID_THICKNESS_FACTOR)
        : thickness;

      // Apply playback dimming
      if (isPastSegment) {
        context.globalAlpha = PLAYBACK_PAST_OPACITY;
      } else if (isCurrentSegment) {
        context.globalAlpha = 1.0;
      } else if (isRapidMove) {
        context.globalAlpha = RAPID_OPACITY;
      } else {
        context.globalAlpha = 1.0;
      }

      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.setLineDash(isRapidMove ? (RAPID_DASH_PATTERN as number[]) : []);

      context.beginPath();
      let pathStarted = false;
      const projectedPoints: { x: number; y: number }[] = [];
      for (const point of segment.points) {
        const projected = project(
          point.x,
          point.y,
          point.z,
          camera,
          canvasWidth,
          canvasHeight,
          projectionMode
        );
        if (!projected) {
          pathStarted = false;
          continue;
        }
        projectedPoints.push({ x: projected.x, y: projected.y });
        if (!pathStarted) {
          context.moveTo(projected.x, projected.y);
          pathStarted = true;
        } else {
          context.lineTo(projected.x, projected.y);
        }
      }
      context.stroke();

      if (projectedPoints.length >= 2) {
        newProjectedCache.push({ segmentIndex, points: projectedPoints });
      }
    }

    projectedCacheRef.current = newProjectedCache;
    context.globalAlpha = 1.0;
    context.setLineDash([]);

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

    // Draw tip dot after axes so it's always on top
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

    // Keep the highlight overlay in sync with the freshly-rebuilt projection
    // cache so it tracks its 3D segment during camera orbit/pan/zoom (#136).
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

      const cached = projectedCacheRef.current.find((c) => c.segmentIndex === hoveredIndex);
      if (!cached || cached.points.length < 2) return;

      const segment = segments[hoveredIndex];
      const color = getSegmentColor(segment.type, settings);
      const thickness = Math.max(MINIMUM_THICKNESS, settings.lineThickness);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness * HOVER_THICKNESS_FACTOR;
      ctx.globalAlpha = HOVER_ALPHA;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = HOVER_SHADOW_BLUR;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(cached.points[0].x, cached.points[0].y);
      for (let i = 1; i < cached.points.length; i++) {
        ctx.lineTo(cached.points[i].x, cached.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    },
    [overlayRef, segmentsRef, settingsRef]
  );

  renderOverlayRef.current = renderOverlay;

  const getProjectedCache = useCallback(() => projectedCacheRef.current, []);
  const clearProjectedCache = useCallback(() => {
    projectedCacheRef.current = [];
  }, []);

  return {
    scheduleRender,
    renderNow: render,
    renderOverlay,
    getProjectedCache,
    clearProjectedCache,
  };
}
