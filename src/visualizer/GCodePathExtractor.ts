/**
 * GCodePathExtractor
 *
 * Implements {@link MotionHandler} and delegates AST walking to
 * {@link GCodeInterpreter}. This enables variable resolution,
 * arithmetic evaluation, WHILE loops, and IF/ELSE branches.
 *
 * Supported motion commands
 *   G0 / G00  -- rapid positioning
 *   G1 / G01  -- linear feed
 *   G2 / G02  -- clockwise arc (XY plane, I/J offsets)
 *   G3 / G03  -- counter-clockwise arc (XY plane, I/J offsets)
 *   G90       -- absolute positioning mode (default)
 *   G91       -- incremental positioning mode
 */
import { AxisParameterNode } from '../parser/nodes/AxisParameterNode';
import { ProgramNode } from '../parser/nodes/ProgramNode';
import { normalizeCommand } from '../utils/GCodeNormalizer';
import { GCodeExpressionEvaluator } from './GCodeExpressionEvaluator';
import { GCodeInterpreter } from './GCodeInterpreter';
import {
  MotionContext,
  MotionHandler,
  MotionType,
  PathBounds,
  PathPoint,
  PathSegment,
  ToolPathData,
} from './types';

/** Number of interpolation segments used to approximate a full circle. */
const ARC_SEGMENTS_PER_FULL_CIRCLE = 72;

/** Minimum arc segments (for very small arcs). */
const ARC_MIN_SEGMENTS = 4;

/**
 * Motion command Sets use only the normalized (padded) form because all
 * incoming command strings are passed through {@link normalizeCommand} first,
 * which converts "G0" → "G00", "G1" → "G01", etc.
 */

/** Commands that switch to rapid mode. */
const RAPID_COMMANDS = new Set(['G00']);

/** Commands that switch to feed mode. */
const FEED_COMMANDS = new Set(['G01']);

/** Commands that switch to clockwise arc mode. */
const ARC_CW_COMMANDS = new Set(['G02']);

/** Commands that switch to counter-clockwise arc mode. */
const ARC_CCW_COMMANDS = new Set(['G03']);

/** Commands that set absolute positioning mode. */
const ABSOLUTE_COMMANDS = new Set(['G90']);

/** Commands that set incremental positioning mode. */
const INCREMENTAL_COMMANDS = new Set(['G91']);

/**
 * Extracts the evaluated value of a named axis from a list of
 * axis parameter nodes using the expression evaluator.
 * Returns `null` when the axis is absent or has an unresolvable value.
 */
function evaluateAxisValue(
  parameters: readonly AxisParameterNode[],
  axis: string,
  evaluator: GCodeExpressionEvaluator
): number | null {
  for (const param of parameters) {
    if (param.axis.toUpperCase() === axis) {
      return evaluator.evaluate(param.value);
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
  const radius = Math.hypot(offsetI, offsetJ);

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
    // Clockwise -> angle decreases
    if (endAngle >= startAngle) {
      endAngle -= 2 * Math.PI;
    }
    sweep = endAngle - startAngle; // negative
  } else {
    // Counter-clockwise -> angle increases
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

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const segment of segments) {
    for (const point of segment.points) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.z < minZ) minZ = point.z;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
      if (point.z > maxZ) maxZ = point.z;
    }
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

/**
 * Extracts 3D tool-path data from a parsed G-code program.
 *
 * Implements {@link MotionHandler} and delegates AST walking to
 * {@link GCodeInterpreter}, which handles variable assignment,
 * expression evaluation, WHILE loops, and IF/ELSE branches.
 */
export class GCodePathExtractor implements MotionHandler {
  private currentPosition: PathPoint = { x: 0, y: 0, z: 0 };
  private isAbsoluteMode = true;
  private segments: PathSegment[] = [];

  /** Modal feed rate (F value), updated when F appears on any motion line. */
  private modalFeedRate: number | null = null;

  /** Modal spindle speed (S value), updated when S appears on any motion line. */
  private modalSpindleSpeed: number | null = null;

  /**
   * Entry point: interpret the program AST and return extracted path data.
   * Resets all internal state before each extraction so the same instance
   * can be reused across multiple documents.
   */
  extract(program: ProgramNode): ToolPathData {
    this.segments = [];
    this.currentPosition = { x: 0, y: 0, z: 0 };
    this.isAbsoluteMode = true;
    this.modalFeedRate = null;
    this.modalSpindleSpeed = null;

    const interpreter = new GCodeInterpreter(this);
    interpreter.interpret(program);
    const bounds = computeBounds(this.segments);
    return { segments: this.segments, bounds };
  }

  // -------------------------------------------------------------------------
  // MotionHandler implementation
  // -------------------------------------------------------------------------

  onMotionCommand(
    command: string,
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): void {
    // Track modal F/S values from parameters on any motion line.
    this.updateModalFeedAndSpindle(parameters, evaluator);

    const normalisedCommand = normalizeCommand(command);

    if (ABSOLUTE_COMMANDS.has(normalisedCommand)) {
      this.isAbsoluteMode = true;
      return;
    }
    if (INCREMENTAL_COMMANDS.has(normalisedCommand)) {
      this.isAbsoluteMode = false;
      return;
    }

    const motionType = this.classifyMotionType(normalisedCommand);
    if (motionType === null) {
      return; // Not a motion command we handle (e.g. M-codes, T, S, F...)
    }

    this.processMotion(motionType, parameters, evaluator);
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

  private processMotion(
    motionType: MotionType,
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): void {
    const newPosition = this.computeNewPosition(parameters, evaluator);
    const context = this.buildMotionContext(parameters, evaluator);

    if (motionType === MotionType.ARC_CW || motionType === MotionType.ARC_CCW) {
      const offsetI = evaluateAxisValue(parameters, 'I', evaluator) ?? 0;
      const offsetJ = evaluateAxisValue(parameters, 'J', evaluator) ?? 0;
      const arcPoints = generateArcPoints(
        this.currentPosition,
        newPosition,
        offsetI,
        offsetJ,
        motionType === MotionType.ARC_CW
      );
      this.pushSegment(motionType, arcPoints, context);
    } else {
      this.pushSegment(motionType, [this.currentPosition, newPosition], context);
    }

    this.currentPosition = newPosition;
  }

  private computeNewPosition(
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): PathPoint {
    let { x, y, z } = this.currentPosition;

    const xValue = evaluateAxisValue(parameters, 'X', evaluator);
    const yValue = evaluateAxisValue(parameters, 'Y', evaluator);
    const zValue = evaluateAxisValue(parameters, 'Z', evaluator);

    if (xValue !== null) {
      x = this.isAbsoluteMode ? xValue : x + xValue;
    }
    if (yValue !== null) {
      y = this.isAbsoluteMode ? yValue : y + yValue;
    }
    if (zValue !== null) {
      z = this.isAbsoluteMode ? zValue : z + zValue;
    }

    return { x, y, z };
  }

  /**
   * Updates the modal feed rate and spindle speed from the parameters list.
   * F and S are modal — once set, they persist across subsequent commands.
   */
  private updateModalFeedAndSpindle(
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): void {
    const feedRateValue = evaluateAxisValue(parameters, 'F', evaluator);
    if (feedRateValue !== null) this.modalFeedRate = feedRateValue;
    const spindleSpeedValue = evaluateAxisValue(parameters, 'S', evaluator);
    if (spindleSpeedValue !== null) this.modalSpindleSpeed = spindleSpeedValue;
  }

  /** Axes that are tracked separately and should not appear in extraParams. */
  private static readonly TRACKED_PARAMS = new Set(['X', 'Y', 'Z', 'F', 'S']);

  /**
   * Builds a {@link MotionContext} snapshot from the current modal state
   * and the source line of the first parameter in the list.
   */
  private buildMotionContext(
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): MotionContext {
    const extraParams: Record<string, number> = {};
    for (const param of parameters) {
      const axis = param.axis.toUpperCase();
      if (!GCodePathExtractor.TRACKED_PARAMS.has(axis)) {
        const value = evaluator.evaluate(param.value);
        if (value !== null) extraParams[axis] = value;
      }
    }

    return {
      sourceLine: parameters[0].getRange().start.line,
      feedRate: this.modalFeedRate,
      spindleSpeed: this.modalSpindleSpeed,
      ...(Object.keys(extraParams).length > 0 ? { extraParams } : {}),
    };
  }

  private pushSegment(type: MotionType, points: PathPoint[], context: MotionContext): void {
    if (points.length < 2) return;
    this.segments.push({ type, points, context });
  }
}
