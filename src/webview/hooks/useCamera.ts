import { useCallback, useEffect, useRef } from 'react';
import { PathBounds, PathSegment } from '../../visualizer/types';
import { CameraState } from '../types';
import { createCameraState, DEFAULT_CAMERA_ANGLES } from '../projection';
import { setupInteraction } from '../interaction';
import { FIT_VIEW_RADIUS_FACTOR } from '../constants';

export interface UseCameraResult {
  readonly camera: CameraState;
  readonly fitView: (segments: PathSegment[], bounds: PathBounds | null) => void;
  readonly resetView: (segments: PathSegment[], bounds: PathBounds | null) => void;
  readonly isDragging: () => boolean;
}

/**
 * Owns the camera state and wires orbit/pan/zoom interaction to a canvas element.
 * Returns a stable camera object (mutated in place by the interaction handlers).
 */
export function useCamera(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onCameraChange: () => void
): UseCameraResult {
  const cameraRef = useRef<CameraState>(createCameraState());
  const isDraggingRef = useRef<() => boolean>(() => false);

  // Wire up mouse interaction once the canvas is mounted
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = setupInteraction(canvas, cameraRef.current, onCameraChange);
    isDraggingRef.current = handle.isDragging;
    return () => handle.cleanup();
  }, [canvasRef, onCameraChange]);

  const fitView = useCallback((segments: PathSegment[], bounds: PathBounds | null) => {
    if (segments.length === 0 || !bounds) return;
    const cam = cameraRef.current;
    cam.target = {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2,
    };
    const size = Math.max(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
      1
    );
    cam.radius = size * FIT_VIEW_RADIUS_FACTOR;
    cam.panX = 0;
    cam.panY = 0;
    cam.theta = DEFAULT_CAMERA_ANGLES.theta;
    cam.phi = DEFAULT_CAMERA_ANGLES.phi;
  }, []);

  const resetView = useCallback(
    (segments: PathSegment[], bounds: PathBounds | null) => {
      fitView(segments, bounds);
      onCameraChange();
    },
    [fitView, onCameraChange]
  );

  const isDragging = useCallback(() => isDraggingRef.current(), []);

  return { camera: cameraRef.current, fitView, resetView, isDragging };
}
