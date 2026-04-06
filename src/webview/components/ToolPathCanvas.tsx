import React, { useCallback, useEffect, useRef } from 'react';
import { PathBounds, PathSegment, VisualizerConfig } from '../../visualizer/types';
import { CameraState } from '../types';
import { useCamera } from '../hooks/useCamera';
import { useRenderLoop } from '../hooks/useRenderLoop';
import { useHitTesting } from '../hooks/useHitTesting';

interface ToolPathCanvasProps {
  readonly segments: PathSegment[];
  readonly bounds: PathBounds | null;
  readonly settings: VisualizerConfig;
  readonly hoveredSegmentIndex: number | null;
  readonly onHoverChange: (index: number | null) => void;
  readonly onCursorMove: (infoPanelVisible: boolean) => void;
  readonly onCanvasLeave: (infoPanelVisible: boolean) => void;
  readonly onDragStart: () => void;
  readonly infoPanelVisible: boolean;
  readonly onMousePosition: (clientX: number, clientY: number) => void;
  readonly wrapperRef: React.RefObject<HTMLDivElement | null>;
  /** Called with fitView/resetView so parent can trigger them. */
  readonly onCameraReady: (controls: CameraControls) => void;
}

export interface CameraControls {
  readonly fitView: (segments: PathSegment[], bounds: PathBounds | null) => void;
  readonly resetView: (segments: PathSegment[], bounds: PathBounds | null) => void;
  readonly scheduleRender: () => void;
  readonly clearProjectedCache: () => void;
  readonly renderOverlay: (hoveredIndex: number | null) => void;
}

export const ToolPathCanvas: React.FC<ToolPathCanvasProps> = ({
  segments,
  bounds,
  settings,
  hoveredSegmentIndex,
  onHoverChange,
  onCursorMove,
  onCanvasLeave,
  onDragStart,
  infoPanelVisible,
  onMousePosition,
  wrapperRef,
  onCameraReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // Stable refs for latest values
  const segmentsRef = useRef<PathSegment[]>(segments);
  segmentsRef.current = segments;
  const boundsRef = useRef<PathBounds | null>(bounds);
  boundsRef.current = bounds;
  const settingsRef = useRef<VisualizerConfig>(settings);
  settingsRef.current = settings;
  const hoveredRef = useRef<number | null>(hoveredSegmentIndex);
  hoveredRef.current = hoveredSegmentIndex;
  const infoPanelVisibleRef = useRef(infoPanelVisible);
  infoPanelVisibleRef.current = infoPanelVisible;

  // Camera ref for render loop
  const cameraRef = useRef<CameraState>(null as unknown as CameraState);

  const { scheduleRender, renderOverlay, getProjectedCache, clearProjectedCache } = useRenderLoop(
    canvasRef,
    overlayRef,
    segmentsRef,
    boundsRef,
    cameraRef,
    settingsRef
  );

  const { camera, fitView, resetView, isDragging } = useCamera(canvasRef, scheduleRender);
  cameraRef.current = camera;

  // Hit testing
  const onHitTestResult = useCallback(
    (index: number | null) => {
      if (index !== hoveredRef.current) {
        onHoverChange(index);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.style.cursor = index !== null ? 'pointer' : 'grab';
        }
        renderOverlay(index);
      }
      // Always notify for dwell timer restart
      onHoverChange(index);
    },
    [onHoverChange, renderOverlay]
  );

  const { scheduleHitTest } = useHitTesting(getProjectedCache, onHitTestResult);

  // Expose camera controls to parent
  useEffect(() => {
    onCameraReady({ fitView, resetView, scheduleRender, clearProjectedCache, renderOverlay });
  }, [fitView, resetView, scheduleRender, clearProjectedCache, renderOverlay, onCameraReady]);

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
      onMousePosition(event.clientX, event.clientY);

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
    [isDragging, onDragStart, onCursorMove, onMousePosition, renderOverlay, scheduleHitTest]
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
};
