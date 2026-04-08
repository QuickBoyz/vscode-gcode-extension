/**
 * Shared configuration types for the G-code extension.
 *
 * These types define the canonical shape of extension settings,
 * replacing the scattered per-module interfaces with a single
 * source of truth.
 */

import { DialectType } from '../constants';
import { FormatterConfig } from '../formatter/types';
import {
  ExtractorConfig,
  InterpreterConfig,
  VariableDefinitions,
  VisualizerConfig,
} from '../visualizer/types';

/**
 * Workspace-level configuration for symbol indexing.
 */
export interface WorkspaceConfig {
  /** Whether workspace-wide symbol indexing is enabled. */
  readonly indexingEnabled: boolean;
  /** Maximum number of symbols to index across all workspace files. */
  readonly maxSymbols: number;
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
  /** Path extractor settings. */
  readonly extractor: ExtractorConfig;
  /** Interpreter settings (loop limits, execution behaviour). */
  readonly interpreter: InterpreterConfig;
  /** User-defined global variable values. */
  readonly variables: VariableDefinitions;
  /** Workspace settings (symbol indexing). */
  readonly workspace: WorkspaceConfig;
}

/**
 * Recursive partial type for deep-merging configuration overrides.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
