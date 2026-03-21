/**
 * GCodePathExtractor
 *
 * Visits a parsed G-code AST and extracts a list of {@link PathSegment}s
 * suitable for 3D rendering.
 *
 * Supported motion commands
 *   G0 / G00  – rapid positioning
 *   G1 / G01  – linear feed
 *   G2 / G02  – clockwise arc (XY plane, I/J offsets)
 *   G3 / G03  – counter-clockwise arc (XY plane, I/J offsets)
 *   G90       – absolute positioning mode (default)
 *   G91       – incremental positioning mode
 *
 * Variable-based axis values (e.g. X[#1]) are ignored; only literal
 * numbers can be resolved at visualise-time.
 */
import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import { AstTraverser } from '../parser/AstTraverser';
import { MotionCommandNode } from '../parser/nodes/MotionCommandNode';
import { AxisParameterNode } from '../parser/nodes/AxisParameterNode';
import { LiteralExpressionNode } from '../parser/nodes/expressions/LiteralExpressionNode';
import { UnaryExpressionNode } from '../parser/nodes/expressions/UnaryExpressionNode';
import { ExpressionNode } from '../parser/nodes/expressions/ExpressionNode';
import { ProgramNode } from '../parser/nodes/ProgramNode';
import { UnaryOperatorType } from '../parser/nodes/expressions/types';
import { MotionType, PathPoint, PathSegment, PathBounds, ToolPathData } from './types';

/** Number of interpolation segments used to approximate a full circle. */
const ARC_SEGMENTS_PER_FULL_CIRCLE = 72;

/** Minimum arc segments (for very small arcs). */
const ARC_MIN_SEGMENTS = 4;

/** Commands that switch to rapid mode. */
const RAPID_COMMANDS = new Set(['G0', 'G00']);

/** Commands that switch to feed mode. */
const FEED_COMMANDS = new Set(['G1', 'G01']);

/** Commands that switch to clockwise arc mode. */
const ARC_CW_COMMANDS = new Set(['G2', 'G02']);

/** Commands that switch to counter-clockwise arc mode. */
const ARC_CCW_COMMANDS = new Set(['G3', 'G03']);

/** Commands that set absolute positioning mode. */
const ABSOLUTE_COMMANDS = new Set(['G90']);

/** Commands that set incremental positioning mode. */
const INCREMENTAL_COMMANDS = new Set(['G91']);

/**
 * Normalises a raw G-code command token to uppercase.
 * E.g. "g1" → "G1", "G01" stays "G01".
 */
function normaliseCommand(raw: string): string {
  return raw.toUpperCase();
}

/**
 * Attempts to extract a numeric value from an expression node.
 * Returns `null` when the expression cannot be statically resolved
 * (e.g. variable references, complex expressions).
 */
function extractNumericValue(expr: ExpressionNode): number | null {
  if (expr instanceof LiteralExpressionNode) {
    const parsed = typeof expr.value === 'number' ? expr.value : parseFloat(String(expr.value));
    return isNaN(parsed) ? null : parsed;
  }
  if (expr instanceof UnaryExpressionNode && expr.operator === UnaryOperatorType.Minus) {
    const inner = extractNumericValue(expr.operand);
    return inner !== null ? -inner : null;
  }
  return null;
}

/**
 * Extracts the value of a named axis from a list of axis parameter nodes.
 * Returns `null` when the axis is absent or has a non-literal value.
 */
function axisValue(params: AxisParameterNode[], axis: string): number | null {
  for (const param of params) {
    if (param.axis.toUpperCase() === axis) {
      return extractNumericValue(param.value);
    }
  }
  return null;
}

/**
 * Generates intermediate 3D points for a circular arc in the XY plane.
 *
 * @param start   - Arc start point
 * @param end     - Arc end point
 * @param offsetI - I offset (X distance from start to arc centre)
 * @param offsetJ - J offset (Y distance from start to arc centre)
 * @param isCW    - true for G2 (clockwise), false for G3 (CCW)
 */
function generateArcPoints(
  start: PathPoint,
  end: PathPoint,
  offsetI: number,
  offsetJ: number,
  isCW: boolean
): PathPoint[] {
  const centerX = start.x + offsetI;
  const centerY = start.y + offsetJ;
  const radius = Math.sqrt(offsetI * offsetI + offsetJ * offsetJ);

  if (radius < 1e-6) {
    return [start, end];
  }

  const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
  let endAngle = Math.atan2(end.y - centerY, end.x - centerX);

  // Full-circle special case: start and end are the same point.
  const isFullCircle =
    Math.abs(start.x - end.x) < 1e-6 &&
    Math.abs(start.y - end.y) < 1e-6 &&
    Math.abs(start.z - end.z) < 1e-6;

  let sweep: number;
  if (isFullCircle) {
    sweep = isCW ? -2 * Math.PI : 2 * Math.PI;
  } else if (isCW) {
    // Clockwise → angle decreases
    if (endAngle >= startAngle) {
      endAngle -= 2 * Math.PI;
    }
    sweep = endAngle - startAngle; // negative
  } else {
    // Counter-clockwise → angle increases
    if (endAngle <= startAngle) {
      endAngle += 2 * Math.PI;
    }
    sweep = endAngle - startAngle; // positive
  }

  const numSegments = Math.max(
    ARC_MIN_SEGMENTS,
    Math.round((Math.abs(sweep) / (2 * Math.PI)) * ARC_SEGMENTS_PER_FULL_CIRCLE)
  );

  const points: PathPoint[] = [start];
  const zStep = (end.z - start.z) / numSegments;

  for (let i = 1; i < numSegments; i++) {
    const fraction = i / numSegments;
    const angle = startAngle + sweep * fraction;
    points.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      z: start.z + zStep * i,
    });
  }
  points.push(end);
  return points;
}

/**
 * Computes the axis-aligned bounding box for a set of path segments.
 * Returns a zero-sized box at the origin if there are no segments.
 */
function computeBounds(segments: PathSegment[]): PathBounds {
  if (segments.length === 0) {
    const origin: PathPoint = { x: 0, y: 0, z: 0 };
    return { min: origin, max: origin };
  }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (const seg of segments) {
    for (const pt of seg.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
      if (pt.z > maxZ) maxZ = pt.z;
    }
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

/**
 * AST visitor that walks a parsed G-code program and produces
 * a {@link ToolPathData} object ready for rendering.
 */
export class GCodePathExtractor extends BaseAstVisitor<void> {
  private currentPosition: PathPoint = { x: 0, y: 0, z: 0 };
  private isAbsoluteMode = true;
  private segments: PathSegment[] = [];

  /**
   * Entry point: traverse the program AST and return extracted path data.
   * Resets all internal state before each extraction so the same instance
   * can be reused across multiple documents.
   */
  extract(program: ProgramNode): ToolPathData {
    this.segments = [];
    this.currentPosition = { x: 0, y: 0, z: 0 };
    this.isAbsoluteMode = true;

    const traverser = new AstTraverser(this);
    traverser.traverseProgram(program);
    const bounds = computeBounds(this.segments);
    return { segments: this.segments, bounds };
  }

  // -------------------------------------------------------------------------
  // Visitor overrides
  // -------------------------------------------------------------------------

  override visitMotionCommand(node: MotionCommandNode): void {
    const command = normaliseCommand(node.command);

    if (ABSOLUTE_COMMANDS.has(command)) {
      this.isAbsoluteMode = true;
      return;
    }
    if (INCREMENTAL_COMMANDS.has(command)) {
      this.isAbsoluteMode = false;
      return;
    }

    const motionType = this.classifyMotionType(command);
    if (motionType === null) {
      return; // Not a motion command we handle (e.g. M-codes, T, S, F…)
    }

    const params = node.getParameters();
    this.processMotion(motionType, params);
  }

  protected defaultValue(): void {
    // No-op – we only care about visitMotionCommand.
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private classifyMotionType(command: string): MotionType | null {
    if (RAPID_COMMANDS.has(command)) return MotionType.RAPID;
    if (FEED_COMMANDS.has(command)) return MotionType.FEED;
    if (ARC_CW_COMMANDS.has(command)) return MotionType.ARC_CW;
    if (ARC_CCW_COMMANDS.has(command)) return MotionType.ARC_CCW;
    return null;
  }

  private processMotion(motionType: MotionType, params: AxisParameterNode[]): void {
    const newPosition = this.computeNewPosition(params);

    if (motionType === MotionType.ARC_CW || motionType === MotionType.ARC_CCW) {
      const offsetI = axisValue(params, 'I') ?? 0;
      const offsetJ = axisValue(params, 'J') ?? 0;
      const arcPoints = generateArcPoints(
        this.currentPosition,
        newPosition,
        offsetI,
        offsetJ,
        motionType === MotionType.ARC_CW
      );
      this.pushSegment(motionType, arcPoints);
    } else {
      this.pushSegment(motionType, [this.currentPosition, newPosition]);
    }

    this.currentPosition = newPosition;
  }

  private computeNewPosition(params: AxisParameterNode[]): PathPoint {
    let { x, y, z } = this.currentPosition;

    const xVal = axisValue(params, 'X');
    const yVal = axisValue(params, 'Y');
    const zVal = axisValue(params, 'Z');

    if (xVal !== null) {
      x = this.isAbsoluteMode ? xVal : x + xVal;
    }
    if (yVal !== null) {
      y = this.isAbsoluteMode ? yVal : y + yVal;
    }
    if (zVal !== null) {
      z = this.isAbsoluteMode ? zVal : z + zVal;
    }

    return { x, y, z };
  }

  private pushSegment(type: MotionType, points: PathPoint[]): void {
    if (points.length < 2) return;
    this.segments.push({ type, points });
  }
}
