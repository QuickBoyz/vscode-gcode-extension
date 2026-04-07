/**
 * Draws a pencil-shaped tool marker at the given world position.
 *
 * The marker is a vertical cylinder (body) with a cone (tip) attached
 * at the bottom, like a pencil. The cone tip points down at the tool
 * position. A bright dot is drawn at the tip, always on top of everything.
 *
 * Geometry (Z-up, tip pointing down):
 *   tip           = toolPosition.z
 *   cone base     = toolPosition.z + TOOL_CONE_HEIGHT
 *   cylinder top  = toolPosition.z + TOOL_CONE_HEIGHT + TOOL_CYLINDER_HEIGHT
 *
 * This module is free of React and DOM dependencies (Canvas 2D only).
 */

import { PathPoint, ProjectionMode } from '../visualizer/types';
import { CameraState } from './types';
import { project } from './projection';
import {
  TOOL_CONE_COLOR,
  TOOL_CONE_HEIGHT,
  TOOL_CYLINDER_COLOR,
  TOOL_CYLINDER_HEIGHT,
  TOOL_MARKER_DIAMETER,
  TOOL_MARKER_OPACITY,
  TOOL_MARKER_OUTLINE_COLOR,
  TOOL_MARKER_OUTLINE_WIDTH,
  TOOL_MARKER_RESOLUTION,
  TOOL_TIP_COLOR,
  TOOL_TIP_OUTLINE_COLOR,
  TOOL_TIP_OUTLINE_WIDTH,
  TOOL_TIP_RADIUS,
} from './constants';

/** Projected 2D point. */
interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * Projects a ring of points at a given Z height around the tool position.
 */
function projectRing(
  cx: number,
  cy: number,
  z: number,
  radius: number,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  projectionMode: ProjectionMode
): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < TOOL_MARKER_RESOLUTION; i++) {
    const angle = (2 * Math.PI * i) / TOOL_MARKER_RESOLUTION;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    const projected = project(px, py, z, camera, canvasWidth, canvasHeight, projectionMode);
    if (projected) {
      points.push({ x: projected.x, y: projected.y });
    }
  }
  return points;
}

/**
 * Fills and strokes a closed polygon from an array of 2D points.
 */
function drawClosedPolygon(ctx: CanvasRenderingContext2D, points: readonly Point2D[]): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Draws individual triangular faces from an apex to consecutive ring points.
 * Each triangle is: apex → ring[i] → ring[i+1].
 */
function drawConeFaces(
  ctx: CanvasRenderingContext2D,
  apex: Point2D,
  ring: readonly Point2D[]
): void {
  const n = ring.length;
  if (n < 2) return;
  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(ring[i].x, ring[i].y);
    ctx.lineTo(ring[ni].x, ring[ni].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Draws quad faces connecting two rings (cylinder side surface).
 * Each quad is: bottom[i] → top[i] → top[i+1] → bottom[i+1].
 */
function drawCylinderSides(
  ctx: CanvasRenderingContext2D,
  bottom: readonly Point2D[],
  top: readonly Point2D[]
): void {
  const n = Math.min(bottom.length, top.length);
  if (n < 2) return;
  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    ctx.beginPath();
    ctx.moveTo(bottom[i].x, bottom[i].y);
    ctx.lineTo(top[i].x, top[i].y);
    ctx.lineTo(top[ni].x, top[ni].y);
    ctx.lineTo(bottom[ni].x, bottom[ni].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Draws the cone and cylinder body of the tool marker (without the tip dot).
 * Call this before axes so the body appears behind them.
 */
export function drawToolMarkerBody(
  ctx: CanvasRenderingContext2D,
  toolPosition: PathPoint,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  projectionMode: ProjectionMode
): void {
  const radius = TOOL_MARKER_DIAMETER / 2;
  const { x: cx, y: cy, z: tipZ } = toolPosition;
  const coneBaseZ = tipZ + TOOL_CONE_HEIGHT;
  const cylinderTopZ = coneBaseZ + TOOL_CYLINDER_HEIGHT;

  const tip = project(cx, cy, tipZ, camera, canvasWidth, canvasHeight, projectionMode);
  if (!tip) return;

  const coneBaseRing = projectRing(
    cx,
    cy,
    coneBaseZ,
    radius,
    camera,
    canvasWidth,
    canvasHeight,
    projectionMode
  );
  const cylinderTopRing = projectRing(
    cx,
    cy,
    cylinderTopZ,
    radius,
    camera,
    canvasWidth,
    canvasHeight,
    projectionMode
  );

  ctx.save();
  ctx.globalAlpha = TOOL_MARKER_OPACITY;
  ctx.lineWidth = TOOL_MARKER_OUTLINE_WIDTH;
  ctx.strokeStyle = TOOL_MARKER_OUTLINE_COLOR;
  ctx.lineJoin = 'round';

  // Draw cylinder body
  if (cylinderTopRing.length >= 2 && coneBaseRing.length >= 2) {
    ctx.fillStyle = TOOL_CYLINDER_COLOR;
    drawClosedPolygon(ctx, cylinderTopRing);
    drawCylinderSides(ctx, coneBaseRing, cylinderTopRing);
  }

  // Draw cone (individual triangular faces for correct rendering)
  if (coneBaseRing.length >= 2) {
    ctx.fillStyle = TOOL_CONE_COLOR;
    drawClosedPolygon(ctx, coneBaseRing);
    drawConeFaces(ctx, tip, coneBaseRing);
  }

  ctx.restore();
}

/**
 * Draws the tip dot of the tool marker. Always rendered on top of everything.
 * Call this after axes so the tip dot appears above them.
 */
export function drawToolMarkerTip(
  ctx: CanvasRenderingContext2D,
  toolPosition: PathPoint,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  projectionMode: ProjectionMode
): void {
  const { x: cx, y: cy, z: tipZ } = toolPosition;
  const tip = project(cx, cy, tipZ, camera, canvasWidth, canvasHeight, projectionMode);
  if (!tip) return;

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
