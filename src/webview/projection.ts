/**
 * Pure 3D-to-2D projection math for the G-code visualizer.
 *
 * This module is free of DOM dependencies so it can be unit-tested
 * under Node.js.  All canvas/browser concerns are kept in the
 * renderer and interaction modules.
 *
 * Coordinate convention: Z-up.
 *   - Azimuth (theta) rotates around the Z axis
 *   - Elevation (phi) tilts from the horizontal XY plane
 *   - After rotation: x2 -> screen horizontal, z2 -> screen vertical
 *     (negated so Z-up = canvas-up), y2 -> depth (into screen)
 */

import { ProjectionMode } from '../shared/visualizerTypes';
import { CameraState, ProjectedPoint } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default camera angles giving a front-right isometric-ish view.
 */
export const DEFAULT_CAMERA_ANGLES = {
  /** Azimuth: front-right view */
  theta: -Math.PI / 4,
  /** Elevation: 36 degrees above the XY plane */
  phi: Math.PI / 5,
} as const;

/** Default orbit distance. */
const DEFAULT_RADIUS = 200;

/** Minimum depth before a point is considered behind the camera. */
const MINIMUM_DEPTH = 0.01;

/**
 * FOV multiplier applied to the smaller canvas dimension.
 *
 * At the default orbit distance the geometry fills approximately 70%
 * of the smaller canvas dimension.  Using a constant canvas-based value
 * (rather than radius * K) means perspective scale is correct and zoom
 * works by varying radius / depth only.
 */
const FOV_MULTIPLIER = 1.5;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a default {@link CameraState} with the standard initial view.
 */
export function createCameraState(): CameraState {
  return {
    theta: DEFAULT_CAMERA_ANGLES.theta,
    phi: DEFAULT_CAMERA_ANGLES.phi,
    radius: DEFAULT_RADIUS,
    panX: 0,
    panY: 0,
    target: { x: 0, y: 0, z: 0 },
  };
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Projects a 3D world point to 2D canvas coordinates (Z-up convention).
 *
 * Rotation order:
 *   1. Azimuth (theta) around the Z axis
 *   2. Elevation (phi) around the X axis
 *
 * After rotation the axes map to:
 *   x2 -> screen horizontal
 *   z2 -> screen vertical (negated so Z-up = canvas-up)
 *   y2 -> depth (into the screen)
 *
 * @param pointX         - World X coordinate
 * @param pointY         - World Y coordinate
 * @param pointZ         - World Z coordinate
 * @param camera         - Current camera state
 * @param canvasWidth    - Canvas width in pixels
 * @param canvasHeight   - Canvas height in pixels
 * @param projectionMode - Perspective or orthographic projection (default: perspective)
 * @returns The projected 2D point with depth, or `null` if behind the camera.
 */
export function project(
  pointX: number,
  pointY: number,
  pointZ: number,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  projectionMode: ProjectionMode = ProjectionMode.PERSPECTIVE
): ProjectedPoint | null {
  // Translate to camera-relative
  const deltaX = pointX - camera.target.x;
  const deltaY = pointY - camera.target.y;
  const deltaZ = pointZ - camera.target.z;

  // Rotate around Z axis (azimuth)
  const cosTheta = Math.cos(camera.theta);
  const sinTheta = Math.sin(camera.theta);
  const rotatedX = deltaX * cosTheta + deltaY * sinTheta;
  const rotatedY1 = -deltaX * sinTheta + deltaY * cosTheta;

  // Rotate around X axis (elevation)
  const cosPhi = Math.cos(camera.phi);
  const sinPhi = Math.sin(camera.phi);
  const depthAxis = rotatedY1 * cosPhi - deltaZ * sinPhi;
  const verticalAxis = rotatedY1 * sinPhi + deltaZ * cosPhi;

  // Depth (used for painter's algorithm sorting and null-check)
  const depth = camera.radius + depthAxis;
  if (depth < MINIMUM_DEPTH) {
    return null;
  }

  // Canvas-based FOV
  const fieldOfView = Math.min(canvasWidth, canvasHeight) * FOV_MULTIPLIER;

  // In orthographic mode the scale is constant (based on orbit radius rather
  // than per-point depth), so all points render at the same size regardless of
  // how far they are from the camera.  Depth is still returned for sorting.
  const scale =
    projectionMode === ProjectionMode.ORTHOGRAPHIC
      ? fieldOfView / camera.radius
      : fieldOfView / depth;

  return {
    x: canvasWidth / 2 + camera.panX + rotatedX * scale,
    y: canvasHeight / 2 + camera.panY - verticalAxis * scale,
    depth,
  };
}
