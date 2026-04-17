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
 *   G2 / G02  -- clockwise arc
 *   G3 / G03  -- counter-clockwise arc
 *   G17       -- select XY arc plane (default)
 *   G18       -- select XZ arc plane
 *   G19       -- select YZ arc plane
 *   G28       -- return to machine home via optional intermediate point
 *   G90       -- absolute positioning mode (default)
 *   G91       -- incremental positioning mode
 */
import { AxisParameterNode } from '../parser/nodes/AxisParameterNode';
import { ProgramNode } from '../parser/nodes/ProgramNode';
import { normalizeCommand } from '../utils/GCodeNormalizer';
import { formatVariableName } from '../providers/RenameUtils';
import {
  RAPID_COMMANDS,
  FEED_COMMANDS,
  ARC_CW_COMMANDS,
  ARC_CCW_COMMANDS,
  ABSOLUTE_COMMANDS,
  INCREMENTAL_COMMANDS,
  HOME_RETURN_COMMANDS,
} from '../constants/GCodeCommands';
import { ARC_PLANE_CONFIGS, ArcPlane, ArcPlaneConfig } from './ArcPlane';
import { GCodeExpressionEvaluator } from './GCodeExpressionEvaluator';
import {
  MotionContext,
  MotionHandler,
  MotionType,
  PathBounds,
  PathPoint,
  PathSegment,
  ProgramInterpreter,
  ReferencedVariable,
  ToolPathData,
  VisualizerPhase,
} from './types';

/** Minimum wall-clock interval between intra-phase progress notifications. */
const PROGRESS_INTERVAL_MS = 100;

/** Callback shape for intra-phase progress updates from the extractor. */
export type ExtractorProgressCallback = (update: {
  phase: VisualizerPhase;
  message?: string;
}) => void;

/** Number of interpolation segments used to approximate a full circle. */
const ARC_SEGMENTS_PER_FULL_CIRCLE = 72;

/** Minimum arc segments (for very small arcs). */
const ARC_MIN_SEGMENTS = 4;

/** Epsilon used for floating-point position comparisons. */
const POSITION_EPSILON = 1e-6;

/**
 * Mutable version of {@link PathPoint}, used internally to build
 * arc points via dynamic axis assignment.
 */
type MutablePathPoint = { -readonly [K in keyof PathPoint]: PathPoint[K] };

/** Maps arc plane selection commands to their corresponding plane. */
const ARC_PLANE_COMMANDS = new Map<string, ArcPlane>([
  ['G17', ArcPlane.XY],
  ['G18', ArcPlane.XZ],
  ['G19', ArcPlane.YZ],
]);

/** Machine home position (origin). */
const MACHINE_HOME_POSITION: PathPoint = { x: 0, y: 0, z: 0 };

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
 * Generates intermediate 3D points for a circular arc in an arbitrary plane.
 *
 * The arc math is fully plane-agnostic: all coordinate mapping is driven
 * by the {@link ArcPlaneConfig} so the same code handles G17/G18/G19
 * without conditionals.
 *
 * @param start        - Arc start point
 * @param end          - Arc end point
 * @param offsetFirst  - Offset from start to centre along the first in-plane axis
 * @param offsetSecond - Offset from start to centre along the second in-plane axis
 * @param isCW         - true for G2 (clockwise), false for G3 (CCW)
 * @param planeConfig  - Active arc plane configuration
 */
function generateArcPoints(
  start: PathPoint,
  end: PathPoint,
  offsetFirst: number,
  offsetSecond: number,
  isCW: boolean,
  planeConfig: ArcPlaneConfig
): PathPoint[] {
  const startFirst = start[planeConfig.inPlaneFirst];
  const startSecond = start[planeConfig.inPlaneSecond];
  const startNormal = start[planeConfig.normal];

  const endFirst = end[planeConfig.inPlaneFirst];
  const endSecond = end[planeConfig.inPlaneSecond];
  const endNormal = end[planeConfig.normal];

  const centerFirst = startFirst + offsetFirst;
  const centerSecond = startSecond + offsetSecond;
  const radius = Math.hypot(offsetFirst, offsetSecond);

  if (radius < POSITION_EPSILON) {
    return [start, end];
  }

  const startAngle = Math.atan2(startSecond - centerSecond, startFirst - centerFirst);
  let endAngle = Math.atan2(endSecond - centerSecond, endFirst - centerFirst);

  // Full-circle special case: start and end are the same point.
  const isFullCircle =
    Math.abs(startFirst - endFirst) < POSITION_EPSILON &&
    Math.abs(startSecond - endSecond) < POSITION_EPSILON &&
    Math.abs(startNormal - endNormal) < POSITION_EPSILON;

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
  const normalStep = (endNormal - startNormal) / numSegments;

  for (let i = 1; i < numSegments; i++) {
    const fraction = i / numSegments;
    const angle = startAngle + sweep * fraction;

    const point: MutablePathPoint = { x: 0, y: 0, z: 0 };
    point[planeConfig.inPlaneFirst] = centerFirst + radius * Math.cos(angle);
    point[planeConfig.inPlaneSecond] = centerSecond + radius * Math.sin(angle);
    point[planeConfig.normal] = startNormal + normalStep * i;

    points.push(point);
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
  private currentArcPlane: ArcPlane = ArcPlane.XY;
  private segments: PathSegment[] = [];

  /** Modal feed rate (F value), updated when F appears on any motion line. */
  private modalFeedRate: number | null = null;

  /** Modal spindle speed (S value), updated when S appears on any motion line. */
  private modalSpindleSpeed: number | null = null;

  /** Intra-phase progress callback, active only during extraction. */
  private extractorOnProgress: ExtractorProgressCallback | undefined;
  /** Wall-clock timestamp of last intra-phase progress notification. */
  private lastProgressAt = 0;

  /**
   * Entry point: interpret the program AST and return extracted path data.
   * Resets all internal state before each extraction so the same instance
   * can be reused across multiple documents.
   *
   * @param program     - Parsed G-code program AST
   * @param interpreter - Program interpreter that will walk the AST and
   *                      dispatch motion commands back to this extractor
   * @param onProgress  - Optional callback fired during extraction with a
   *                      live segment count, throttled to ~100ms intervals.
   */
  extract(
    program: ProgramNode,
    interpreter: ProgramInterpreter,
    onProgress?: ExtractorProgressCallback
  ): ToolPathData {
    this.segments = [];
    this.currentPosition = { x: 0, y: 0, z: 0 };
    this.isAbsoluteMode = true;
    this.currentArcPlane = ArcPlane.XY;
    this.modalFeedRate = null;
    this.modalSpindleSpeed = null;
    this.extractorOnProgress = onProgress;
    this.lastProgressAt = 0;

    interpreter.interpret(program);
    const bounds = computeBounds(this.segments);
    const referencedVariables = this.buildReferencedVariables(interpreter);
    return { segments: this.segments, bounds, referencedVariables };
  }

  /**
   * Builds the list of referenced variables from the interpreter's
   * tracking data, including their final resolved values after execution.
   */
  private buildReferencedVariables(interpreter: ProgramInterpreter): readonly ReferencedVariable[] {
    const named: ReferencedVariable[] = [];

    for (const key of interpreter.referencedVariables) {
      const value = interpreter.getVariableValue(key);
      const displayKey = formatVariableName(key);
      named.push({ key: displayKey, value });
    }

    return named.sort((a, b) => a.key.localeCompare(b.key));
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

    // Arc plane selection — these do NOT affect modal motion command.
    const arcPlane = ARC_PLANE_COMMANDS.get(normalisedCommand);
    if (arcPlane !== undefined) {
      this.currentArcPlane = arcPlane;
      return;
    }

    // Home return — does NOT affect arc plane or modal motion command.
    if (HOME_RETURN_COMMANDS.has(normalisedCommand)) {
      this.processHomeReturn(parameters, evaluator);
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
      const planeConfig = ARC_PLANE_CONFIGS[this.currentArcPlane];
      const offsetFirst =
        evaluateAxisValue(parameters, planeConfig.offsetFirst.toUpperCase(), evaluator) ?? 0;
      const offsetSecond =
        evaluateAxisValue(parameters, planeConfig.offsetSecond.toUpperCase(), evaluator) ?? 0;
      const arcPoints = generateArcPoints(
        this.currentPosition,
        newPosition,
        offsetFirst,
        offsetSecond,
        motionType === MotionType.ARC_CW,
        planeConfig
      );
      this.pushSegment(motionType, arcPoints, context);
    } else {
      this.pushSegment(motionType, [this.currentPosition, newPosition], context);
    }

    this.currentPosition = newPosition;
  }

  /**
   * Handles G28: return to machine home position via an optional
   * intermediate point.
   *
   * When axis parameters are provided, the tool first rapids to the
   * specified intermediate position (in the current positioning mode),
   * then rapids to the machine home position — but only the axes that
   * were specified move to zero.
   *
   * When no axis parameters are provided, the tool rapids directly to
   * the machine home position (all axes to 0).
   */
  private processHomeReturn(
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): void {
    const context = this.buildMotionContext(parameters, evaluator);
    const hasAxisParameters = parameters.some((param) =>
      ['X', 'Y', 'Z'].includes(param.axis.toUpperCase())
    );

    if (!hasAxisParameters) {
      // No parameters: rapid directly to machine home.
      this.pushSegment(MotionType.RAPID, [this.currentPosition, MACHINE_HOME_POSITION], context);
      this.currentPosition = MACHINE_HOME_POSITION;
      return;
    }

    // Compute the intermediate position (respects absolute/incremental mode).
    const intermediatePosition = this.computeNewPosition(parameters, evaluator);
    this.pushSegment(MotionType.RAPID, [this.currentPosition, intermediatePosition], context);
    this.currentPosition = intermediatePosition;

    // Compute home target: only axes mentioned in the parameters go to zero.
    const homeTarget = this.computeHomeTarget(parameters);
    this.pushSegment(MotionType.RAPID, [this.currentPosition, homeTarget], context);
    this.currentPosition = homeTarget;
  }

  /**
   * Computes the home target position for G28. Only axes that were
   * explicitly specified in the parameters move to zero; the others
   * retain their current value.
   */
  private computeHomeTarget(parameters: readonly AxisParameterNode[]): PathPoint {
    const specifiedAxes = new Set(
      parameters
        .map((param) => param.axis.toUpperCase())
        .filter((axis) => ['X', 'Y', 'Z'].includes(axis))
    );

    return {
      x: specifiedAxes.has('X') ? MACHINE_HOME_POSITION.x : this.currentPosition.x,
      y: specifiedAxes.has('Y') ? MACHINE_HOME_POSITION.y : this.currentPosition.y,
      z: specifiedAxes.has('Z') ? MACHINE_HOME_POSITION.z : this.currentPosition.z,
    };
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
      sourceLine: parameters.length > 0 ? parameters[0].getRange().start.line : 0,
      feedRate: this.modalFeedRate,
      spindleSpeed: this.modalSpindleSpeed,
      ...(Object.keys(extraParams).length > 0 ? { extraParams } : {}),
    };
  }

  private pushSegment(type: MotionType, points: PathPoint[], context: MotionContext): void {
    if (points.length < 2) return;
    this.segments.push({ type, points, context });

    if (this.extractorOnProgress) {
      const now = Date.now();
      if (now - this.lastProgressAt >= PROGRESS_INTERVAL_MS) {
        this.extractorOnProgress({
          phase: VisualizerPhase.EXTRACTING,
          message: `Extracted ${this.segments.length} segments`,
        });
        this.lastProgressAt = now;
      }
    }
  }
}
