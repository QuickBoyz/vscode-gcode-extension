/**
 * Axis indicator drawing for the G-code 3D visualizer.
 *
 * Draws small X/Y/Z reference axes at the camera look-at target
 * so the user can see the current orientation at a glance.
 */

import { CameraState } from './types';
import { project } from './projection';

// ---------------------------------------------------------------------------
// Axis configuration
// ---------------------------------------------------------------------------

interface AxisDefinition {
  readonly label: string;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaZ: number;
  readonly color: string;
}

/** Fraction of the orbit radius used as axis indicator length. */
const AXIS_LENGTH_FACTOR = 0.12;

/** Font used for axis labels. */
const AXIS_LABEL_FONT = 'bold 11px monospace';

/** Line width for axis lines. */
const AXIS_LINE_WIDTH = 1.5;

/** Opacity for axis drawing. */
const AXIS_OPACITY = 0.8;

/** Offset from axis tip to label text. */
const LABEL_OFFSET = 3;

/** X axis colour (red). */
const X_AXIS_COLOR = '#e05555';

/** Y axis colour (green). */
const Y_AXIS_COLOR = '#55bb55';

/** Z axis colour (blue). */
const Z_AXIS_COLOR = '#5588ff';

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * Draws XYZ reference axes at the camera look-at target.
 *
 * @param context      - The 2D rendering context to draw into
 * @param camera       - Current camera state
 * @param canvasWidth  - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 */
export function drawAxes(
  context: CanvasRenderingContext2D,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const axisLength = camera.radius * AXIS_LENGTH_FACTOR;

  const origin = project(
    camera.target.x,
    camera.target.y,
    camera.target.z,
    camera,
    canvasWidth,
    canvasHeight,
  );
  if (!origin) {
    return;
  }

  const axes: readonly AxisDefinition[] = [
    { label: 'X', deltaX: axisLength, deltaY: 0, deltaZ: 0, color: X_AXIS_COLOR },
    { label: 'Y', deltaX: 0, deltaY: axisLength, deltaZ: 0, color: Y_AXIS_COLOR },
    { label: 'Z', deltaX: 0, deltaY: 0, deltaZ: axisLength, color: Z_AXIS_COLOR },
  ];

  context.lineWidth = AXIS_LINE_WIDTH;
  context.globalAlpha = AXIS_OPACITY;

  for (const axis of axes) {
    const tip = project(
      camera.target.x + axis.deltaX,
      camera.target.y + axis.deltaY,
      camera.target.z + axis.deltaZ,
      camera,
      canvasWidth,
      canvasHeight,
    );
    if (!tip) {
      continue;
    }

    context.strokeStyle = axis.color;
    context.fillStyle = axis.color;
    context.beginPath();
    context.moveTo(origin.x, origin.y);
    context.lineTo(tip.x, tip.y);
    context.stroke();

    context.font = AXIS_LABEL_FONT;
    context.fillText(axis.label, tip.x + LABEL_OFFSET, tip.y + LABEL_OFFSET);
  }

  context.globalAlpha = 1.0;
}
