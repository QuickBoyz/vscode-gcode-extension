/**
 * Shared configuration types for the G-code extension.
 *
 * These types define the canonical shape of extension settings,
 * replacing the scattered per-module interfaces with a single
 * source of truth.
 */

import { DialectType } from '../constants';
import { ProjectionMode } from '../shared/visualizerTypes';

/**
 * Machine home position coordinates used by the G28 return-to-home command.
 */
export interface MachineHomePosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Formatter configuration options.
 *
 * Structurally identical to {@link import('../formatter/types').FormatterSettings}.
 */
export interface FormatterConfig {
  /** Add N-block line numbers to each line. */
  readonly addLineNumbers: boolean;
  /** Starting line number when addLineNumbers is true. */
  readonly lineNumberStart: number;
  /** Line number increment when addLineNumbers is true. */
  readonly lineNumberIncrement: number;
  /** Pretty-print G and M codes with two digits (G1 -> G01, M3 -> M03). */
  readonly prettyPrintCommands: boolean;
  /** Pretty-print parameter numbers to always have at least one decimal point (X2 -> X2.0). */
  readonly prettyPrintNumbers: boolean;
  /** Indentation size (number of spaces per indent level). */
  readonly indentSize: number;
  /** Use tabs instead of spaces for indentation. */
  readonly useTabs: boolean;
  /** Enable indentation for control structures (WHILE, IF, etc.). */
  readonly indent: boolean;
  /** Compact output mode - removes all empty lines. */
  readonly compactOutput: boolean;
  /** Add program delimiters (%) at the beginning and end of the program if not present. */
  readonly addProgramDelimiters: boolean;
}

/**
 * Visualizer configuration for the 3D tool-path viewer.
 *
 * Structurally identical to {@link import('../shared/visualizerTypes').VisualizerSettings}.
 */
export interface VisualizerConfig {
  /** Hex colour string for rapid (G0) moves. */
  readonly rapidColor: string;
  /** Hex colour string for feed (G1) moves. */
  readonly feedColor: string;
  /** Hex colour string for arc (G2/G3) moves. */
  readonly arcColor: string;
  /** Line width in canvas pixels (1 - 5). */
  readonly lineThickness: number;
  /** Whether to show the reference grid on the XY plane. */
  readonly showGrid: boolean;
  /** Grid line spacing in work units (mm or inches). */
  readonly gridSpacing: number;
  /** Whether to render rapid (G0) moves. */
  readonly showRapidMoves: boolean;
  /** Projection mode (perspective or orthographic). */
  readonly projection: ProjectionMode;
}

/**
 * Configuration for the G-code path extractor / interpreter.
 */
export interface ExtractorConfig {
  /** Machine home position for G28 return-to-home. */
  readonly machineHome: MachineHomePosition;
  /** Maximum total loop iterations before the interpreter stops. */
  readonly maxIterations: number;
}

/**
 * Root configuration for the entire G-code extension.
 */
export interface GCodeConfig {
  /** Active G-code dialect. */
  readonly dialect: DialectType;
  /** Formatter settings. */
  readonly formatter: FormatterConfig;
  /** 3D visualizer settings. */
  readonly visualizer: VisualizerConfig;
  /** Path extractor / interpreter settings. */
  readonly extractor: ExtractorConfig;
}

/**
 * Recursive partial type for deep-merging configuration overrides.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
