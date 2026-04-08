import React, { useCallback, useEffect, useRef } from 'react';
import { useCameraRef, useScheduleRender, useAnimationCancel } from '../context/VisualizerContext';
import { ORBIT_SENSITIVITY, POLE_MARGIN } from '../constants';
import { FACE_VIEWS, EDGE_VIEWS, ViewTarget } from '../viewCube/views';
import { animateCamera } from '../viewCube/animation';

/** Size of each cube face in CSS pixels. */
const CUBE_SIZE = 64;

/** Half the cube size — used for translateZ positioning. */
const HALF = CUBE_SIZE / 2;

/** Animation duration in milliseconds. */
const ANIMATION_DURATION = 100;

/** Minimum mouse movement in pixels to distinguish drag from click. */
const DRAG_THRESHOLD = 3;

/** CSS 3D transform for each face. */
const FACE_TRANSFORMS: Record<string, string> = {
  Front: `rotateY(0deg) translateZ(${HALF}px)`,
  Back: `rotateY(180deg) translateZ(${HALF}px)`,
  Right: `rotateY(90deg) translateZ(${HALF}px)`,
  Left: `rotateY(-90deg) translateZ(${HALF}px)`,
  Top: `rotateX(90deg) translateZ(${HALF}px)`,
  Bottom: `rotateX(-90deg) translateZ(${HALF}px)`,
};

/**
 * Edge definitions: each edge connects two faces and has a CSS 3D transform.
 * The transform positions a narrow strip at the boundary between the two faces.
 */
interface EdgeDefinition {
  readonly name: string;
  readonly transform: string;
  readonly width: number;
  readonly height: number;
}

const EDGE_SIZE = 12; // hit area width in px
const EDGE_LENGTH = CUBE_SIZE; // length along the edge

const EDGE_DEFINITIONS: readonly EdgeDefinition[] = [
  // Horizontal edges (connect side faces at same elevation)
  { name: 'Front-Right', transform: `rotateY(45deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_SIZE, height: EDGE_LENGTH },
  { name: 'Front-Left', transform: `rotateY(-45deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_SIZE, height: EDGE_LENGTH },
  { name: 'Back-Right', transform: `rotateY(135deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_SIZE, height: EDGE_LENGTH },
  { name: 'Back-Left', transform: `rotateY(-135deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_SIZE, height: EDGE_LENGTH },
  // Top horizontal edges
  { name: 'Front-Top', transform: `rotateX(45deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_LENGTH, height: EDGE_SIZE },
  { name: 'Back-Top', transform: `rotateX(45deg) rotateY(180deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_LENGTH, height: EDGE_SIZE },
  { name: 'Right-Top', transform: `rotateX(45deg) rotateY(90deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_LENGTH, height: EDGE_SIZE },
  { name: 'Left-Top', transform: `rotateX(45deg) rotateY(-90deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_LENGTH, height: EDGE_SIZE },
  // Bottom horizontal edges
  { name: 'Front-Bottom', transform: `rotateX(-45deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_LENGTH, height: EDGE_SIZE },
  { name: 'Back-Bottom', transform: `rotateX(-45deg) rotateY(180deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_LENGTH, height: EDGE_SIZE },
  { name: 'Right-Bottom', transform: `rotateX(-45deg) rotateY(90deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_LENGTH, height: EDGE_SIZE },
  { name: 'Left-Bottom', transform: `rotateX(-45deg) rotateY(-90deg) translateZ(${HALF * Math.SQRT2}px)`, width: EDGE_LENGTH, height: EDGE_SIZE },
];

/**
 * Converts camera spherical angles (theta, phi) to CSS 3D rotation.
 *
 * The visualizer uses Z-up convention:
 * - theta: azimuth around Z axis
 * - phi: elevation from XY plane
 *
 * CSS 3D uses Y-up by default, so we map:
 * - rotateX(phi in degrees) for elevation
 * - rotateZ(theta in degrees) for azimuth
 *
 * The signs are positive (not negated) because the cube represents the
 * scene, not the camera — when the camera orbits right (theta decreases),
 * the scene (and cube) appears to rotate left, which matches positive theta
 * in CSS rotateZ.
 */
function cameraToCSS(theta: number, phi: number): string {
  const thetaDeg = (theta * 180) / Math.PI;
  const phiDeg = (phi * 180) / Math.PI;
  return `rotateX(${phiDeg}deg) rotateZ(${thetaDeg}deg)`;
}

export function ViewCube() {
  const cameraRef = useCameraRef();
  const scheduleRender = useScheduleRender();
  const { registerAnimationCancel } = useAnimationCancel();

  const cubeRef = useRef<HTMLDivElement>(null);
  const cancelAnimationRef = useRef<(() => void) | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  // Sync cube CSS transform to camera state on every animation frame.
  // Dirty check avoids DOM writes when the camera is stationary.
  useEffect(() => {
    let prevTheta = NaN;
    let prevPhi = NaN;

    function syncTransform(): void {
      const camera = cameraRef.current;
      const cube = cubeRef.current;
      if (camera && cube && (camera.theta !== prevTheta || camera.phi !== prevPhi)) {
        prevTheta = camera.theta;
        prevPhi = camera.phi;
        cube.style.transform = cameraToCSS(camera.theta, camera.phi);
      }
      rafIdRef.current = requestAnimationFrame(syncTransform);
    }
    rafIdRef.current = requestAnimationFrame(syncTransform);
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [cameraRef]);

  // Navigate to a predefined view
  const navigateTo = useCallback(
    (view: ViewTarget) => {
      const camera = cameraRef.current;
      if (!camera) return;

      // Cancel any in-progress animation
      cancelAnimationRef.current?.();

      const cancel = animateCamera(
        camera,
        view,
        ANIMATION_DURATION,
        scheduleRender,
        () => {
          cancelAnimationRef.current = null;
          registerAnimationCancel(null);
        }
      );

      cancelAnimationRef.current = cancel;
      registerAnimationCancel(cancel);
    },
    [cameraRef, scheduleRender, registerAnimationCancel]
  );

  // Handle mouse down on the cube (start potential drag or click)
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      isDraggingRef.current = false;
      dragStartRef.current = { x: event.clientX, y: event.clientY };

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const dx = moveEvent.clientX - dragStartRef.current.x;
        const dy = moveEvent.clientY - dragStartRef.current.y;

        if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
          isDraggingRef.current = true;
          // Cancel any in-progress animation when drag starts
          cancelAnimationRef.current?.();
          cancelAnimationRef.current = null;
          // Reset drag start to current position for smooth initial movement
          dragStartRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
          return;
        }

        if (!isDraggingRef.current) return;

        const camera = cameraRef.current;
        if (!camera) return;

        const moveDx = moveEvent.clientX - dragStartRef.current.x;
        const moveDy = moveEvent.clientY - dragStartRef.current.y;
        dragStartRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };

        camera.theta -= moveDx * ORBIT_SENSITIVITY;
        camera.phi = Math.max(
          -Math.PI / 2 + POLE_MARGIN,
          Math.min(Math.PI / 2 - POLE_MARGIN, camera.phi + moveDy * ORBIT_SENSITIVITY)
        );
        scheduleRender();
      };

      const handleMouseUp = (): void => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [cameraRef, scheduleRender]
  );

  // Handle click on a face (only fires if not dragging)
  const handleFaceClick = useCallback(
    (faceName: string) => {
      if (isDraggingRef.current) return;
      const view = FACE_VIEWS[faceName];
      if (view) navigateTo(view);
    },
    [navigateTo]
  );

  // Handle click on an edge (only fires if not dragging)
  const handleEdgeClick = useCallback(
    (edgeName: string) => {
      if (isDraggingRef.current) return;
      const view = EDGE_VIEWS[edgeName];
      if (view) navigateTo(view);
    },
    [navigateTo]
  );

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      cancelAnimationRef.current?.();
      registerAnimationCancel(null);
    };
  }, [registerAnimationCancel]);

  return (
    <div id="view-cube-container" onMouseDown={handleMouseDown}>
      <div id="view-cube" ref={cubeRef}>
        {Object.keys(FACE_TRANSFORMS).map((name) => (
          <div
            key={name}
            className="view-cube-face"
            style={{ transform: FACE_TRANSFORMS[name] }}
            onClick={() => handleFaceClick(name)}
          >
            {name.toUpperCase()}
          </div>
        ))}
        {EDGE_DEFINITIONS.map((edge) => (
          <div
            key={edge.name}
            className={`view-cube-edge ${edge.width < edge.height ? 'view-cube-edge--vertical' : 'view-cube-edge--horizontal'}`}
            style={{
              transform: edge.transform,
              width: `${edge.width}px`,
              height: `${edge.height}px`,
            }}
            onClick={() => handleEdgeClick(edge.name)}
          />
        ))}
      </div>
    </div>
  );
}
