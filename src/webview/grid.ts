/**
 * Reference grid drawing for the G-code 3D visualizer.
 *
 * Draws a flat grid on the XY plane (Z=0) to give spatial context
 * when inspecting a tool path.  Minor lines are drawn at every
 * `gridSpacing` interval; every fifth line is treated as a major line
 * and rendered slightly more opaque.  The origin lines (X=0, Y=0) are
 * highlighted with the highest opacity.
 *
 * This module is free of DOM dependencies and can be unit-tested
 * under Node.js.
 */

import { PathBounds } from '../shared/visualizerTypes';
import { project } from './projection';
import { CameraState } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Opacity for minor grid lines. */
const MINOR_LINE_OPACITY = 0.12;

/** Opacity for major grid lines (every 5th minor line). */
const MAJOR_LINE_OPACITY = 0.3;

/** Opacity for the origin lines (X=0 and Y=0). */
const ORIGIN_LINE_OPACITY = 0.5;

/** Canvas line width for minor and major grid lines. */
const GRID_LINE_WIDTH = 0.5;

/** Canvas line width for the origin lines. */
const ORIGIN_LINE_WIDTH = 1.0;

/** Interval multiplier that defines "every Nth line is a major line". */
const MAJOR_LINE_INTERVAL = 5;

/** How many extra grid intervals to pad beyond the path bounding box. */
const GRID_PADDING_INTERVALS = 1;

/** Colour used for all grid lines (white, opacity applied separately). */
const GRID_LINE_COLOR = '#ffffff';

// ---------------------------------------------------------------------------
// Grid extent calculation (exported so it can be unit-tested)
// ---------------------------------------------------------------------------

/**
 * Computes the grid extent that covers `bounds` plus one interval of padding
 * on each side, snapped outward to the nearest grid interval.
 *
 * Examples (spacing = 10):
 *   bounds { min.x: 3.7, max.x: 47.2 } → minX: -10, maxX: 60
 *   bounds { min.x: 0,   max.x: 0    } → minX: -10, maxX: 10
 */
export function computeGridExtent(
  bounds: PathBounds,
  gridSpacing: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const paddedMinX = bounds.min.x - GRID_PADDING_INTERVALS * gridSpacing;
  const paddedMaxX = bounds.max.x + GRID_PADDING_INTERVALS * gridSpacing;
  const paddedMinY = bounds.min.y - GRID_PADDING_INTERVALS * gridSpacing;
  const paddedMaxY = bounds.max.y + GRID_PADDING_INTERVALS * gridSpacing;

  return {
    minX: Math.floor(paddedMinX / gridSpacing) * gridSpacing,
    maxX: Math.ceil(paddedMaxX / gridSpacing) * gridSpacing,
    minY: Math.floor(paddedMinY / gridSpacing) * gridSpacing,
    maxY: Math.ceil(paddedMaxY / gridSpacing) * gridSpacing,
  };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * Draws the reference grid on the XY plane (Z=0).
 *
 * Must be called BEFORE drawing path segments so the grid renders
 * behind the tool path (painter's algorithm).
 *
 * @param context      - The 2D rendering context to draw into
 * @param camera       - Current camera state
 * @param canvasWidth  - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param bounds       - Axis-aligned bounding box of the tool path
 * @param gridSpacing  - Distance between grid lines in world units
 */
export function drawGrid(
  context: CanvasRenderingContext2D,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  bounds: PathBounds,
  gridSpacing: number,
): void {
  const extent = computeGridExtent(bounds, gridSpacing);

  context.strokeStyle = GRID_LINE_COLOR;
  context.setLineDash([]);

  // --- Lines parallel to the Y axis (varying X, constant Y span) ---
  for (let worldX = extent.minX; worldX <= extent.maxX; worldX += gridSpacing) {
    const lineIndex = Math.round(worldX / gridSpacing);
    const isOrigin = worldX === 0;
    const isMajor = lineIndex % MAJOR_LINE_INTERVAL === 0;

    context.globalAlpha = isOrigin ? ORIGIN_LINE_OPACITY : isMajor ? MAJOR_LINE_OPACITY : MINOR_LINE_OPACITY;
    context.lineWidth = isOrigin ? ORIGIN_LINE_WIDTH : GRID_LINE_WIDTH;

    const startPoint = project(worldX, extent.minY, 0, camera, canvasWidth, canvasHeight);
    const endPoint = project(worldX, extent.maxY, 0, camera, canvasWidth, canvasHeight);

    if (!startPoint || !endPoint) {
      continue;
    }

    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();
  }

  // --- Lines parallel to the X axis (varying Y, constant X span) ---
  for (let worldY = extent.minY; worldY <= extent.maxY; worldY += gridSpacing) {
    const lineIndex = Math.round(worldY / gridSpacing);
    const isOrigin = worldY === 0;
    const isMajor = lineIndex % MAJOR_LINE_INTERVAL === 0;

    context.globalAlpha = isOrigin ? ORIGIN_LINE_OPACITY : isMajor ? MAJOR_LINE_OPACITY : MINOR_LINE_OPACITY;
    context.lineWidth = isOrigin ? ORIGIN_LINE_WIDTH : GRID_LINE_WIDTH;

    const startPoint = project(extent.minX, worldY, 0, camera, canvasWidth, canvasHeight);
    const endPoint = project(extent.maxX, worldY, 0, camera, canvasWidth, canvasHeight);

    if (!startPoint || !endPoint) {
      continue;
    }

    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();
  }

  // Restore context state
  context.globalAlpha = 1.0;
  context.lineWidth = 1.0;
}
