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

import { ProjectionMode } from '../visualizer/types';
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

// ---------------------------------------------------------------------------
// Batch projection
// ---------------------------------------------------------------------------

/**
 * Projects a flat buffer of world-space points into a flat buffer of
 * screen-space coordinates and a per-point depth buffer in one tight
 * loop. This is the hot path for the per-frame render on large files.
 *
 * Trigonometric constants (`cos/sin theta`, `cos/sin phi`), the FOV
 * scalar, and the canvas centre are computed once *before* the loop,
 * not per point — this is the single largest win over calling `project()`
 * in a loop, because per-point overhead drops to ~a dozen FLOPs with
 * zero object allocation.
 *
 * Invalid (behind-camera) points are encoded as `NaN` in `outScreen`;
 * the raw depth is still written to `outDepth` so painter's-algorithm
 * midpoint sorting can substitute its own sentinel at the segment level.
 *
 * @param worldPoints    Flat world-space buffer: [x,y,z, x,y,z, …]. Length must be >= 3*pointCount.
 * @param pointCount     Number of points to project.
 * @param camera         Current camera state.
 * @param canvasWidth    Canvas width in pixels.
 * @param canvasHeight   Canvas height in pixels.
 * @param projectionMode Perspective or orthographic.
 * @param outScreen      Output: interleaved [x,y, x,y, …]. Length must be >= 2*pointCount.
 * @param outDepth       Output: per-point raw depth. Length must be >= pointCount.
 */
export function projectBatch(
  worldPoints: Float32Array,
  pointCount: number,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  projectionMode: ProjectionMode,
  outScreen: Float32Array,
  outDepth: Float32Array
): void {
  const cosTheta = Math.cos(camera.theta);
  const sinTheta = Math.sin(camera.theta);
  const cosPhi = Math.cos(camera.phi);
  const sinPhi = Math.sin(camera.phi);
  const targetX = camera.target.x;
  const targetY = camera.target.y;
  const targetZ = camera.target.z;
  const radius = camera.radius;
  const cx0 = canvasWidth / 2 + camera.panX;
  const cy0 = canvasHeight / 2 + camera.panY;
  const fieldOfView = Math.min(canvasWidth, canvasHeight) * FOV_MULTIPLIER;
  const isOrthographic = projectionMode === ProjectionMode.ORTHOGRAPHIC;
  const orthographicScale = fieldOfView / radius;

  for (let i = 0; i < pointCount; i++) {
    const base = i * 3;
    const deltaX = worldPoints[base] - targetX;
    const deltaY = worldPoints[base + 1] - targetY;
    const deltaZ = worldPoints[base + 2] - targetZ;

    const rotatedX = deltaX * cosTheta + deltaY * sinTheta;
    const rotatedY1 = -deltaX * sinTheta + deltaY * cosTheta;

    const depthAxis = rotatedY1 * cosPhi - deltaZ * sinPhi;
    const verticalAxis = rotatedY1 * sinPhi + deltaZ * cosPhi;

    const depth = radius + depthAxis;
    outDepth[i] = depth;

    const s = i * 2;
    if (depth < MINIMUM_DEPTH) {
      outScreen[s] = NaN;
      outScreen[s + 1] = NaN;
      continue;
    }

    const scale = isOrthographic ? orthographicScale : fieldOfView / depth;
    outScreen[s] = cx0 + rotatedX * scale;
    outScreen[s + 1] = cy0 - verticalAxis * scale;
  }
}
