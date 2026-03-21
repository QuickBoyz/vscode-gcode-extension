/**
 * Types for the G-code 3D path visualizer.
 *
 * These types are intentionally free of VS Code or parser dependencies
 * so they can be used on both the extension host and in tests.
 */

import { AxisParameterNode } from '../parser/nodes/AxisParameterNode';
import { GCodeExpressionEvaluator } from './GCodeExpressionEvaluator';

/**
 * G-code motion type used to colour-code path segments in the viewer.
 */
export enum MotionType {
  /** Rapid positioning (G0) – shown thin/dashed */
  RAPID = 'rapid',
  /** Linear feed interpolation (G1) */
  FEED = 'feed',
  /** Clockwise arc interpolation (G2) */
  ARC_CW = 'arc_cw',
  /** Counter-clockwise arc interpolation (G3) */
  ARC_CCW = 'arc_ccw',
}

/**
 * An immutable 3D point in G-code coordinate space (mm or inches).
 */
export interface PathPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * A single motion segment.
 *
 * For linear moves (RAPID / FEED) `points` has exactly two entries.
 * For arcs the extractor pre-computes intermediate points so the renderer
 * only needs to connect consecutive points with straight lines.
 */
export interface PathSegment {
  readonly type: MotionType;
  /** Ordered points, at minimum [start, end]. */
  readonly points: readonly PathPoint[];
}

/**
 * Axis-aligned bounding box of the complete tool path.
 */
export interface PathBounds {
  readonly min: PathPoint;
  readonly max: PathPoint;
}

/**
 * The full result returned by {@link GCodePathExtractor}.
 */
export interface ToolPathData {
  readonly segments: readonly PathSegment[];
  readonly bounds: PathBounds;
}

/**
 * User-configurable visual appearance for the 3D viewer.
 */
export interface VisualizerSettings {
  /** Hex colour string for rapid (G0) moves, e.g. "#ff6b6b" */
  readonly rapidColor: string;
  /** Hex colour string for feed (G1) moves */
  readonly feedColor: string;
  /** Hex colour string for arc (G2/G3) moves */
  readonly arcColor: string;
  /** Line width in canvas pixels (1 – 5) */
  readonly lineThickness: number;
}

/**
 * Sensible defaults that are also reflected in `package.json` configuration.
 */
export const DEFAULT_VISUALIZER_SETTINGS: VisualizerSettings = {
  rapidColor: '#ff6b6b',
  feedColor: '#4ecdc4',
  arcColor: '#45b7d1',
  lineThickness: 1,
};

// ---------------------------------------------------------------------------
// Interpreter types
// ---------------------------------------------------------------------------

/**
 * Configuration options for the G-code interpreter.
 */
export interface InterpreterOptions {
  /** Maximum total loop iterations before the interpreter stops. */
  readonly maxIterations: number;
}

/**
 * Sensible defaults for the interpreter.
 */
export const DEFAULT_INTERPRETER_OPTIONS: InterpreterOptions = {
  maxIterations: 10_000,
};

/**
 * Callback interface for motion commands encountered during interpretation.
 * Decouples the interpreter from path extraction so the same interpreter
 * can drive different consumers (path extraction, simulation, etc.).
 */
export interface MotionHandler {
  onMotionCommand(
    command: string,
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): void;
}
