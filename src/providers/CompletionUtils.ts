/**
 * Completion Utility Functions
 *
 * Shared utilities for completion context detection and analysis.
 */

import { GCodeSymbols } from '../constants';

/**
 * Completion utility methods for context detection
 */
export class CompletionUtils {
  /**
   * Regex pattern to match parameters on a line
   * Requires whitespace before parameter letter to avoid matching G/M codes
   */
  static readonly PARAMETER_PATTERN = /\s([A-Z])[\d.\-+#[]/gi;

  /**
   * Extract already-used parameters from a line of G-code
   * @param lineText - The line to analyze
   * @returns Set of parameter letters already used on the line
   */
  static extractUsedParameters(lineText: string): Set<string> {
    const usedParams = new Set<string>();
    const matches = lineText.matchAll(this.PARAMETER_PATTERN);

    for (const match of matches) {
      const param = match[1].toUpperCase();
      // Exclude G and M since those are commands, not parameters
      if (
        ![GCodeSymbols.GCODE_PREFIX.toString(), GCodeSymbols.MCODE_PREFIX.toString()].includes(
          param
        )
      ) {
        usedParams.add(param);
      }
    }

    return usedParams;
  }

  /**
   * Extract the prefix being typed (text before cursor matching pattern)
   * @param text - Text before cursor
   * @param pattern - Pattern to match
   * @returns The matched prefix or undefined if no match
   */
  static matchRegex(text: string, pattern: RegExp): string | undefined {
    const match = text.match(pattern);
    return match?.[0];
  }
}
