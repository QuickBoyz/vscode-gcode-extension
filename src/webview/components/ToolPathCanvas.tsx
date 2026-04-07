import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { PathBounds, PathSegment } from '../../visualizer/types';
import { CameraState } from '../types';
import { useCamera } from '../hooks/useCamera';
import { useRenderLoop } from '../hooks/useRenderLoop';
import { useHitTesting } from '../hooks/useHitTesting';
import {
  useDocumentState,
  useVisualizerSettings,
  useTooltip,
  useCameraControls,
  useMousePosition,
} from '../context/VisualizerContext';
import { usePlaybackEngineRefs } from '../context/PlaybackContext';

interface ToolPathCanvasProps {
  readonly wrapperRef: React.RefObject<HTMLDivElement | null>;
}

export interface CameraControls {
  readonly fitView: (segments: PathSegment[], bounds: PathBounds | null) => void;
  readonly resetView: (segments: PathSegment[], bounds: PathBounds | null) => void;
  readonly scheduleRender: () => void;
  /** Render immediately (synchronous). Use from within an existing rAF callback. */
  readonly renderNow: () => void;
  readonly clearProjectedCache: () => void;
  readonly renderOverlay: (hoveredIndex: number | null) => void;
}

export function ToolPathCanvas({ wrapperRef }: ToolPathCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const { segments, bounds } = useDocumentState();
  const { settings } = useVisualizerSettings();
  const { visibleIndex, onHoverChange, onCursorMove, onCanvasLeave, onDragStart } = useTooltip();
  const { registerCameraControls } = useCameraControls();
  const { updateMousePosition } = useMousePosition();

  // Stable refs for latest values (used by imperative render/hit-test loops)
  const segmentsRef = useRef<PathSegment[]>(segments);
  segmentsRef.current = segments;
  const boundsRef = useRef<PathBounds | null>(bounds);
  boundsRef.current = bounds;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const hoveredRef = useRef<number | null>(visibleIndex);
  hoveredRef.current = visibleIndex;
  const infoPanelVisibleRef = useRef(visibleIndex !== null);
  infoPanelVisibleRef.current = visibleIndex !== null;

  const cameraRef = useRef<CameraState>(null);

  const playbackRefs = usePlaybackEngineRefs();

  // Memoize so the render callback's dependency is stable across re-renders.
  // The individual refs (useRef objects) never change reference.
  const playbackRenderRefs = useMemo(
    () => ({
      statusRef: playbackRefs.statusRef,
      currentIndexRef: playbackRefs.currentIndexRef,
      toolPositionRef: playbackRefs.toolPositionRef,
    }),
    [playbackRefs.statusRef, playbackRefs.currentIndexRef, playbackRefs.toolPositionRef]
  );

  const { scheduleRender, renderNow, renderOverlay, getProjectedCache, clearProjectedCache } =
    useRenderLoop(
      canvasRef,
      overlayRef,
      segmentsRef,
      boundsRef,
      cameraRef,
      settingsRef,
      playbackRenderRefs
    );

  const { camera, fitView, resetView, isDragging } = useCamera(canvasRef, scheduleRender);
  cameraRef.current = camera;

  // Hit testing — only call onHoverChange once per result (fixes issue #3)
  const onHitTestResult = useCallback(
    (index: number | null) => {
      if (index !== hoveredRef.current) {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.style.cursor = index !== null ? 'pointer' : 'grab';
        }
        renderOverlay(index);
      }
      onHoverChange(index);
    },
    [onHoverChange, renderOverlay]
  );

  const { scheduleHitTest } = useHitTesting(getProjectedCache, onHitTestResult);

  // Expose camera controls to provider
  useEffect(() => {
    registerCameraControls({
      fitView,
      resetView,
      scheduleRender,
      renderNow,
      clearProjectedCache,
      renderOverlay,
    });
  }, [
    fitView,
    resetView,
    scheduleRender,
    renderNow,
    clearProjectedCache,
    renderOverlay,
    registerCameraControls,
  ]);

  // Canvas resize
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      if (!canvas || !overlay) return;
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      // Only reset dimensions when they actually change — setting
      // canvas.width/height clears all content (web platform behavior).
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      overlay.width = width;
      overlay.height = height;
      scheduleRender();
    };

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(wrapper);
    resizeCanvas();
    return () => observer.disconnect();
  }, [wrapperRef, scheduleRender]);

  // Mouse move handler
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      updateMousePosition(event.clientX, event.clientY);

      if (isDragging()) {
        if (hoveredRef.current !== null) {
          onDragStart();
          renderOverlay(null);
        }
        return;
      }

      onCursorMove(infoPanelVisibleRef.current);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      scheduleHitTest(x, y);
    },
    [isDragging, onDragStart, onCursorMove, updateMousePosition, renderOverlay, scheduleHitTest]
  );

  const handleMouseLeave = useCallback(() => {
    onCanvasLeave(infoPanelVisibleRef.current);
    if (hoveredRef.current !== null) {
      onHoverChange(null);
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'grab';
      renderOverlay(null);
    }
  }, [onCanvasLeave, onHoverChange, renderOverlay]);

  return (
    <>
      <canvas
        id="canvas"
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      <canvas id="overlay" ref={overlayRef} />
    </>
  );
}
