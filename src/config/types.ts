/**
 * Shared configuration types for the G-code extension.
 *
 * These types define the canonical shape of extension settings,
 * replacing the scattered per-module interfaces with a single
 * source of truth.
 */

import { DialectType } from '../constants';
import { FormatterConfig } from '../formatter/types';
import { ExtractorConfig, InterpreterConfig, VisualizerConfig } from '../visualizer/types';

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
}

/**
 * Recursive partial type for deep-merging configuration overrides.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
