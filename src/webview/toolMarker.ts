import { PathPoint, ProjectionMode } from '../visualizer/types';
import { CameraState } from './types';
import { project } from './projection';
import {
  TOOL_CONE_COLOR,
  TOOL_CONE_DIAMETER,
  TOOL_CONE_HEIGHT,
  TOOL_CONE_OPACITY,
  TOOL_CONE_OUTLINE_COLOR,
  TOOL_CONE_OUTLINE_WIDTH,
  TOOL_CONE_RESOLUTION,
  TOOL_TIP_COLOR,
  TOOL_TIP_OUTLINE_COLOR,
  TOOL_TIP_OUTLINE_WIDTH,
  TOOL_TIP_RADIUS,
} from './constants';

/**
 * Draws a tool marker at the given world position on the canvas.
 *
 * The marker consists of:
 *  - A vertical cone (Z-up, tip pointing down at the tool position,
 *    base raised by TOOL_CONE_HEIGHT above it) with a semi-transparent body.
 *  - A bright tip dot drawn last so it is always on top.
 */
export function drawToolMarker(
  ctx: CanvasRenderingContext2D,
  toolPosition: PathPoint,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  projectionMode: ProjectionMode
): void {
  const radius = TOOL_CONE_DIAMETER / 2;

  // Project the tip (tool position)
  const tip = project(
    toolPosition.x,
    toolPosition.y,
    toolPosition.z,
    camera,
    canvasWidth,
    canvasHeight,
    projectionMode
  );
  if (!tip) return;

  // Project points around the base circle
  const baseZ = toolPosition.z + TOOL_CONE_HEIGHT;
  const basePoints: { x: number; y: number }[] = [];
  for (let i = 0; i < TOOL_CONE_RESOLUTION; i++) {
    const angle = (2 * Math.PI * i) / TOOL_CONE_RESOLUTION;
    const bx = toolPosition.x + radius * Math.cos(angle);
    const by = toolPosition.y + radius * Math.sin(angle);
    const projected = project(bx, by, baseZ, camera, canvasWidth, canvasHeight, projectionMode);
    if (projected) {
      basePoints.push({ x: projected.x, y: projected.y });
    }
  }

  // Draw cone body
  if (basePoints.length >= 2) {
    ctx.save();
    ctx.globalAlpha = TOOL_CONE_OPACITY;
    ctx.fillStyle = TOOL_CONE_COLOR;
    ctx.strokeStyle = TOOL_CONE_OUTLINE_COLOR;
    ctx.lineWidth = TOOL_CONE_OUTLINE_WIDTH;

    // Cone sides: tip → base points
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    for (const bp of basePoints) {
      ctx.lineTo(bp.x, bp.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Base ellipse
    ctx.beginPath();
    ctx.moveTo(basePoints[0].x, basePoints[0].y);
    for (let i = 1; i < basePoints.length; i++) {
      ctx.lineTo(basePoints[i].x, basePoints[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Tip dot — always on top
  ctx.save();
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = TOOL_TIP_COLOR;
  ctx.strokeStyle = TOOL_TIP_OUTLINE_COLOR;
  ctx.lineWidth = TOOL_TIP_OUTLINE_WIDTH;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, TOOL_TIP_RADIUS, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
