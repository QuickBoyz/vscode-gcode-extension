/**
 * Mouse and wheel interaction handlers for the G-code 3D visualizer.
 *
 * Sets up orbit (left drag), pan (shift+drag or right drag), and
 * zoom (scroll wheel) interactions on the canvas element.
 *
 * Returns a cleanup function that removes all event listeners.
 */

import { CameraState, DragMode } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Radians per pixel of mouse movement during orbit. */
const ORBIT_SENSITIVITY = 0.008;

/** Zoom multiplier when scrolling down (zoom out). */
const ZOOM_OUT_FACTOR = 1.12;

/** Zoom multiplier when scrolling up (zoom in). */
const ZOOM_IN_FACTOR = 0.89;

/** Minimum orbit radius to prevent the camera from collapsing. */
const MINIMUM_RADIUS = 0.01;

/**
 * Margin in radians from the poles (+/- PI/2) to prevent gimbal lock.
 */
const POLE_MARGIN = 0.01;

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
 * @returns A cleanup function that removes all event listeners
 */
export function setupInteraction(
  canvas: HTMLCanvasElement,
  camera: CameraState,
  onCameraChange: () => void,
): () => void {
  let dragMode: DragMode | null = null;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function handleMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      dragMode = event.shiftKey ? DragMode.PAN : DragMode.ORBIT;
    } else if (event.button === 1 || event.button === 2) {
      dragMode = DragMode.PAN;
    }
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    canvas.classList.add(DRAGGING_CLASS);
    event.preventDefault();
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!dragMode) {
      return;
    }
    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    if (dragMode === DragMode.ORBIT) {
      camera.theta -= deltaX * ORBIT_SENSITIVITY;
      camera.phi = Math.max(
        -Math.PI / 2 + POLE_MARGIN,
        Math.min(Math.PI / 2 - POLE_MARGIN, camera.phi + deltaY * ORBIT_SENSITIVITY),
      );
    } else {
      camera.panX += deltaX;
      camera.panY += deltaY;
    }
    onCameraChange();
  }

  function handleMouseUp(): void {
    dragMode = null;
    canvas.classList.remove(DRAGGING_CLASS);
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

  // Return cleanup function
  return () => {
    canvas.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    canvas.removeEventListener('wheel', handleWheel);
    canvas.removeEventListener('contextmenu', handleContextMenu);
  };
}
