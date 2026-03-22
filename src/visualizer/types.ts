/**
 * Types for the G-code 3D path visualizer.
 *
 * Parser-free data types live in `../shared/visualizerTypes` and are
 * re-exported here to preserve the public API of this module.
 * Only types that depend on the parser layer are defined below.
 */

export { MotionType, ProjectionMode, DEFAULT_VISUALIZER_SETTINGS } from '../shared/visualizerTypes';
export type {
  PathPoint,
  PathSegment,
  PathBounds,
  ToolPathData,
  VisualizerSettings,
  VisualizerSuccess,
  VisualizerFailure,
  VisualizerResult,
  WorkerRequest,
  WorkerResponse,
  WorkerErrorResponse,
} from '../shared/visualizerTypes';

import { AxisParameterNode } from '../parser/nodes/AxisParameterNode';
import { GCodeExpressionEvaluator } from './GCodeExpressionEvaluator';

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
