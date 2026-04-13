/**
 * Mouse and wheel interaction handlers for the G-code 3D visualizer.
 *
 * Sets up orbit (left drag), pan (shift+drag or right drag), and
 * zoom (scroll wheel) interactions on the canvas element.
 *
 * Returns an {@link InteractionState} object that exposes a drag-state
 * query (for hit-testing coordination) and a cleanup function.
 */

import { CameraState, DragMode } from './types';
import { ORBIT_SENSITIVITY, POLE_MARGIN } from './constants';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Handle returned by {@link setupInteraction} so that other modules
 * (e.g. the hit-testing layer) can query whether a drag is in progress
 * and clean up listeners when the webview is disposed.
 */
export interface InteractionState {
  /** Returns `true` while the user is actively dragging (orbit or pan). */
  readonly isDragging: () => boolean;
  /** Removes all event listeners attached by {@link setupInteraction}. */
  readonly cleanup: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Zoom multiplier when scrolling down (zoom out). */
const ZOOM_OUT_FACTOR = 1.12;

/** Zoom multiplier when scrolling up (zoom in). */
const ZOOM_IN_FACTOR = 0.89;

/** Minimum orbit radius to prevent the camera from collapsing. */
const MINIMUM_RADIUS = 0.01;

/** CSS class applied to the canvas while dragging. */
const DRAGGING_CLASS = 'dragging';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Attaches mouse and wheel event listeners for orbit/pan/zoom interaction.
 *
 * @param canvas         - The canvas element to attach listeners to
 * @param camera         - Mutable camera state that handlers will update
 * @param onCameraChange - Callback invoked after each camera update to
 *                         trigger a re-render
 * @returns An {@link InteractionState} with drag-state query and cleanup
 */
/**
 * Optional injection seam for tests — lets a spec replace rAF/cAF with
 * synchronous stand-ins so the coalescing behavior is observable.
 */
export interface InteractionSchedulerHooks {
  readonly requestAnimationFrame?: (cb: FrameRequestCallback) => number;
  readonly cancelAnimationFrame?: (handle: number) => void;
}

export function setupInteraction(
  canvas: HTMLCanvasElement,
  camera: CameraState,
  onCameraChange: () => void,
  onDragStart?: () => void,
  scheduler?: InteractionSchedulerHooks
): InteractionState {
  const raf =
    scheduler?.requestAnimationFrame ?? window.requestAnimationFrame.bind(window);
  const caf =
    scheduler?.cancelAnimationFrame ?? window.cancelAnimationFrame.bind(window);

  let dragMode: DragMode | null = null;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Coalesced pointer delta. Mousemove events can arrive at 120–500 Hz
  // and VSCode's input plumbing charges ~3–7 ms of _markUserActivity /
  // IPC to each one. If every event also mutated the camera and fired
  // onCameraChange, mid-frame mousemove bursts would preempt the
  // render loop and blow the p99 tail (trace-before.json.gz shows
  // FireAnimationFrame p99 = 1263 ms on surface-finish.ngc). Instead
  // we buffer the delta and apply it on the next rAF tick, so any
  // burst of N mousemoves collapses to ONE camera update per frame.
  let pendingDeltaX = 0;
  let pendingDeltaY = 0;
  let pendingRafHandle: number | null = null;

  function flushPendingDelta(): void {
    pendingRafHandle = null;
    if (!dragMode) {
      pendingDeltaX = 0;
      pendingDeltaY = 0;
      return;
    }
    const deltaX = pendingDeltaX;
    const deltaY = pendingDeltaY;
    pendingDeltaX = 0;
    pendingDeltaY = 0;
    if (deltaX === 0 && deltaY === 0) {
      return;
    }
    if (dragMode === DragMode.ORBIT) {
      camera.theta -= deltaX * ORBIT_SENSITIVITY;
      camera.phi = Math.max(
        -Math.PI / 2 + POLE_MARGIN,
        Math.min(Math.PI / 2 - POLE_MARGIN, camera.phi + deltaY * ORBIT_SENSITIVITY)
      );
    } else {
      camera.panX += deltaX;
      camera.panY += deltaY;
    }
    onCameraChange();
  }

  function scheduleFlush(): void {
    if (pendingRafHandle !== null) {
      return;
    }
    pendingRafHandle = raf(flushPendingDelta);
  }

  function handleMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      dragMode = event.shiftKey ? DragMode.PAN : DragMode.ORBIT;
    } else if (event.button === 1 || event.button === 2) {
      dragMode = DragMode.PAN;
    }
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    pendingDeltaX = 0;
    pendingDeltaY = 0;
    canvas.classList.add(DRAGGING_CLASS);
    onDragStart?.();
    event.preventDefault();
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!dragMode) {
      return;
    }
    pendingDeltaX += event.clientX - lastMouseX;
    pendingDeltaY += event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    scheduleFlush();
  }

  function handleMouseUp(): void {
    dragMode = null;
    canvas.classList.remove(DRAGGING_CLASS);
    if (pendingRafHandle !== null) {
      caf(pendingRafHandle);
      pendingRafHandle = null;
    }
    pendingDeltaX = 0;
    pendingDeltaY = 0;
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const factor = event.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
    camera.radius = Math.max(MINIMUM_RADIUS, camera.radius * factor);
    onCameraChange();
  }

  function handleContextMenu(event: Event): void {
    event.preventDefault();
  }

  // Attach listeners
  canvas.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('contextmenu', handleContextMenu);

  // Return interaction state handle
  return {
    isDragging: () => dragMode !== null,
    cleanup: () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      if (pendingRafHandle !== null) {
        caf(pendingRafHandle);
        pendingRafHandle = null;
      }
    },
  };
}
