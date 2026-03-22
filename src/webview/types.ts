/**
 * Webview-internal types for the 3D G-code visualizer.
 *
 * These types are used exclusively within the webview rendering layer.
 * They contain NO DOM types so that pure-math modules (e.g. projection)
 * can be tested under Node.js without a browser environment.
 */

/**
 * A 2D point produced by projecting a 3D world coordinate onto the canvas,
 * together with the depth value needed for painter's algorithm sorting.
 */
export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

/**
 * Mutable camera state for the orbit/pan/zoom interaction model.
 *
 * Deviation from the project-wide `readonly` preference: the camera state
 * is intentionally mutable because it is updated continuously by mouse
 * and wheel event handlers.  Making every field readonly would require
 * allocating a new object on every drag frame, which hurts performance
 * with no practical testability benefit.
 */
export interface CameraState {
  /** Azimuth angle around the Z axis (radians). */
  theta: number;
  /** Elevation angle from the horizontal plane (radians). */
  phi: number;
  /** Orbit distance from the look-at target. */
  radius: number;
  /** Screen-space horizontal pan offset (pixels). */
  panX: number;
  /** Screen-space vertical pan offset (pixels). */
  panY: number;
  /** The 3D look-at point that the camera orbits around. */
  target: { x: number; y: number; z: number };
}

/**
 * The three possible drag interaction modes.
 */
export enum DragMode {
  /** Rotate the camera around the look-at target. */
  ORBIT = 'orbit',
  /** Pan the view in screen space. */
  PAN = 'pan',
}
