/**
 * Shared types for the G-code 3D path visualizer.
 *
 * These types are intentionally free of VS Code, Node.js, and parser
 * dependencies so they can be used on both the extension host and in
 * the webview bundle.
 */

/**
 * Projection mode for the 3D visualizer camera.
 */
export enum ProjectionMode {
  /** Standard perspective projection — distant objects appear smaller. */
  PERSPECTIVE = 'perspective',
  /** Orthographic projection — scale is constant regardless of depth. */
  ORTHOGRAPHIC = 'orthographic',
}

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
 * Per-segment metadata linking a path segment back to its G-code source.
 * Built by the extractor from modal interpreter state.
 */
export interface MotionContext {
  /** 0-based line number in the source file that produced this segment. */
  readonly sourceLine: number;
  /** Active F (feed rate) value at the time of the move, null if not yet set. */
  readonly feedRate: number | null;
  /** Active S (spindle speed) value at the time of the move, null if not yet set. */
  readonly spindleSpeed: number | null;
  /** Extra axis parameters (I, J, K, etc.) present on this command. */
  readonly extraParams?: Readonly<Record<string, number>>;
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
  /** Source context (line number, feed rate, spindle speed). */
  readonly context?: MotionContext;
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
 *
 * @deprecated Use `VisualizerConfig` from `src/config/types` instead.
 * This type is retained because the webview imports it directly.
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
  /** Whether to show the reference grid on the XY plane */
  readonly showGrid: boolean;
  /** Grid line spacing in work units (mm or inches) */
  readonly gridSpacing: number;
  /** Whether to render rapid (G0) moves */
  readonly showRapidMoves: boolean;
  /** Projection mode (perspective or orthographic) */
  readonly projection: ProjectionMode;
}

/**
 * Sensible defaults that are also reflected in `package.json` configuration.
 *
 * @deprecated Use `DEFAULT_GCODE_CONFIG.visualizer` from `src/config/defaults` instead.
 */
export const DEFAULT_VISUALIZER_SETTINGS: VisualizerSettings = {
  rapidColor: '#ff6b6b',
  feedColor: '#4ecdc4',
  arcColor: '#45b7d1',
  lineThickness: 1,
  showGrid: true,
  gridSpacing: 10,
  showRapidMoves: true,
  projection: ProjectionMode.PERSPECTIVE,
};

// ---------------------------------------------------------------------------
// Visualizer result types
// ---------------------------------------------------------------------------

/**
 * Successful result from the visualizer pipeline.
 */
export interface VisualizerSuccess {
  readonly success: true;
  readonly data: ToolPathData;
}

/**
 * Failed result from the visualizer pipeline.
 */
export interface VisualizerFailure {
  readonly success: false;
  readonly errorMessage: string;
}

/**
 * Discriminated union returned by {@link VisualizerService.extractToolPath}
 * so callers can handle errors without try/catch.
 */
export type VisualizerResult = VisualizerSuccess | VisualizerFailure;

// ---------------------------------------------------------------------------
// Worker thread message protocol
// ---------------------------------------------------------------------------

/**
 * Extractor configuration embedded in worker requests.
 *
 * Re-declared here (instead of importing from `config/types`) because
 * `shared/visualizerTypes` must remain free of VS Code, Node.js, and
 * extension-host dependencies so the webview can import it.
 */
export interface WorkerExtractorConfig {
  readonly machineHome: { readonly x: number; readonly y: number; readonly z: number };
  readonly maxIterations: number;
}

/**
 * Message sent from the main thread to the visualizer worker.
 */
export interface WorkerRequest {
  readonly type: 'parse';
  readonly id: number;
  readonly text: string;
  readonly extractor: WorkerExtractorConfig;
}

/**
 * Success response sent from the worker back to the main thread.
 */
export interface WorkerResponse {
  readonly type: 'result';
  readonly id: number;
  readonly result: VisualizerResult;
  readonly durationMs: number;
}

/**
 * Error response sent from the worker when an unrecoverable error occurs.
 */
export interface WorkerErrorResponse {
  readonly type: 'error';
  readonly id: number;
  readonly errorMessage: string;
}
