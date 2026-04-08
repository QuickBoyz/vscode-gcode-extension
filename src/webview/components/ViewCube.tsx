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

// Edge transforms use translate3d for positioning + rotations for orientation.
// CSS transforms apply right-to-left: rotation first, then translation in parent coords.
const EDGE_DEFINITIONS: readonly EdgeDefinition[] = [
  // Vertical edges (run along CSS Y-axis at cube corners)
  {
    name: 'Front-Right',
    transform: `translate3d(${HALF}px, 0, ${HALF}px) rotateY(45deg)`,
    width: EDGE_SIZE,
    height: EDGE_LENGTH,
  },
  {
    name: 'Front-Left',
    transform: `translate3d(${-HALF}px, 0, ${HALF}px) rotateY(-45deg)`,
    width: EDGE_SIZE,
    height: EDGE_LENGTH,
  },
  {
    name: 'Back-Right',
    transform: `translate3d(${HALF}px, 0, ${-HALF}px) rotateY(135deg)`,
    width: EDGE_SIZE,
    height: EDGE_LENGTH,
  },
  {
    name: 'Back-Left',
    transform: `translate3d(${-HALF}px, 0, ${-HALF}px) rotateY(-135deg)`,
    width: EDGE_SIZE,
    height: EDGE_LENGTH,
  },
  // Top edges (at y = -HALF in CSS coords)
  {
    name: 'Front-Top',
    transform: `translate3d(0, ${-HALF}px, ${HALF}px) rotateX(45deg)`,
    width: EDGE_LENGTH,
    height: EDGE_SIZE,
  },
  {
    name: 'Back-Top',
    transform: `translate3d(0, ${-HALF}px, ${-HALF}px) rotateX(135deg)`,
    width: EDGE_LENGTH,
    height: EDGE_SIZE,
  },
  {
    name: 'Right-Top',
    transform: `translate3d(${HALF}px, ${-HALF}px, 0) rotateY(90deg) rotateX(45deg)`,
    width: EDGE_LENGTH,
    height: EDGE_SIZE,
  },
  {
    name: 'Left-Top',
    transform: `translate3d(${-HALF}px, ${-HALF}px, 0) rotateY(-90deg) rotateX(45deg)`,
    width: EDGE_LENGTH,
    height: EDGE_SIZE,
  },
  // Bottom edges (at y = +HALF in CSS coords)
  {
    name: 'Front-Bottom',
    transform: `translate3d(0, ${HALF}px, ${HALF}px) rotateX(-45deg)`,
    width: EDGE_LENGTH,
    height: EDGE_SIZE,
  },
  {
    name: 'Back-Bottom',
    transform: `translate3d(0, ${HALF}px, ${-HALF}px) rotateX(-135deg)`,
    width: EDGE_LENGTH,
    height: EDGE_SIZE,
  },
  {
    name: 'Right-Bottom',
    transform: `translate3d(${HALF}px, ${HALF}px, 0) rotateY(90deg) rotateX(-45deg)`,
    width: EDGE_LENGTH,
    height: EDGE_SIZE,
  },
  {
    name: 'Left-Bottom',
    transform: `translate3d(${-HALF}px, ${HALF}px, 0) rotateY(-90deg) rotateX(-45deg)`,
    width: EDGE_LENGTH,
    height: EDGE_SIZE,
  },
];

/**
 * Converts camera spherical angles (theta, phi) to CSS 3D rotation.
 *
 * The visualizer uses Z-up convention:
 * - theta: azimuth around Z axis
 * - phi: elevation from XY plane
 *
 * CSS 3D uses Y-up by default, so we map:
 * - rotateX(-phi) for elevation (CSS rotateX positive tilts top away,
 *   but positive phi means looking up, so we negate)
 * - rotateY(theta) for azimuth (CSS Y axis = vertical = visualizer Z axis)
 */
function cameraToCSS(theta: number, phi: number): string {
  const thetaDeg = (theta * 180) / Math.PI;
  const phiDeg = (phi * 180) / Math.PI;
  return `rotateX(${-phiDeg}deg) rotateY(${thetaDeg}deg)`;
}

export function ViewCube() {
  const cameraRef = useCameraRef();
  const baseScheduleRender = useScheduleRender();
  const { registerAnimationCancel } = useAnimationCancel();

  const cubeRef = useRef<HTMLDivElement>(null);
  const cancelAnimationRef = useRef<(() => void) | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastSyncedAnglesRef = useRef({ theta: NaN, phi: NaN });

  // Sync cube CSS transform to match current camera angles.
  // Only writes to DOM when theta/phi have actually changed.
  const syncCubeTransform = useCallback((): void => {
    const camera = cameraRef.current;
    const cube = cubeRef.current;
    if (!camera || !cube) return;

    const last = lastSyncedAnglesRef.current;
    if (camera.theta === last.theta && camera.phi === last.phi) return;

    last.theta = camera.theta;
    last.phi = camera.phi;
    cube.style.transform = cameraToCSS(camera.theta, camera.phi);
  }, [cameraRef]);

  // Wrap scheduleRender to also sync the cube transform on every render.
  const scheduleRender = useCallback((): void => {
    syncCubeTransform();
    baseScheduleRender();
  }, [baseScheduleRender, syncCubeTransform]);

  // Sync cube transform once on mount; subsequent updates piggyback on render scheduling.
  useEffect(() => {
    syncCubeTransform();
  }, [syncCubeTransform]);

  // Navigate to a predefined view
  const navigateTo = useCallback(
    (view: ViewTarget) => {
      const camera = cameraRef.current;
      if (!camera) return;

      // Cancel any in-progress animation
      cancelAnimationRef.current?.();

      const cancel = animateCamera(camera, view, ANIMATION_DURATION, scheduleRender, () => {
        cancelAnimationRef.current = null;
        registerAnimationCancel(null);
      });

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
          registerAnimationCancel(null);
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
    [cameraRef, scheduleRender, registerAnimationCancel]
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

  // Handle keyboard activation on faces/edges
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, name: string, isEdge: boolean) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const views = isEdge ? EDGE_VIEWS : FACE_VIEWS;
        const view = views[name];
        if (view) navigateTo(view);
      }
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
            role="button"
            tabIndex={0}
            aria-label={`${name} view`}
            onClick={() => handleFaceClick(name)}
            onKeyDown={(e) => handleKeyDown(e, name, false)}
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
              marginLeft: `${-edge.width / 2}px`,
              marginTop: `${-edge.height / 2}px`,
            }}
            role="button"
            tabIndex={0}
            aria-label={`${edge.name} edge view`}
            onClick={() => handleEdgeClick(edge.name)}
            onKeyDown={(e) => handleKeyDown(e, edge.name, true)}
          />
        ))}
      </div>
    </div>
  );
}
