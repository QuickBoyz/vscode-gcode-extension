/**
 * VariableResolutionService
 *
 * Merges variable values from settings into a single
 * {@link VariableEnvironment} suitable for the G-code interpreter.
 *
 * Precedence (highest to lowest):
 *   1. Settings variables — defined in `gcode.variables` in settings.json;
 *      these are **pinned** and cannot be overwritten by program assignments
 *   2. Program assignments — handled by the interpreter at execution time
 *   3. Default (null) — the evaluator returns null for unknown variables
 *
 * This service handles source 1. Source 2 is handled by the interpreter
 * itself (variable assignments in the program take effect during
 * execution, unless the variable is pinned). Source 3 is the evaluator's
 * fallback.
 *
 * Variable key normalization:
 *   - `#100` or `100` → numeric key `100`
 *   - `#<name>` or `name` → lowercase string key `name`
 *   - Named variables are case-insensitive (stored lowercase)
 */

import { normalizeVariableKey } from '../providers/RenameUtils';
import { VariableDefinitions } from './types';
import { VariableEnvironment } from './VariableEnvironment';

/**
 * Options for constructing a {@link VariableResolutionService}.
 */
export interface VariableResolutionOptions {
  /** Variables defined in VS Code settings (`gcode.variables`). */
  readonly settingsVariables?: VariableDefinitions;
}

// ---------------------------------------------------------------------------
// VariableResolutionService — merges variable sources
// ---------------------------------------------------------------------------

/**
 * Service that resolves variable definitions from settings into a
 * single {@link VariableEnvironment} for the interpreter.
 */
export class VariableResolutionService {
  private readonly settingsVariables: VariableDefinitions;

  constructor(options?: VariableResolutionOptions) {
    this.settingsVariables = options?.settingsVariables ?? {};
  }

  /**
   * Resolves settings variables into a single {@link VariableEnvironment}.
   *
   * Settings variables are pinned so program assignments cannot
   * overwrite values the user explicitly configured.
   */
  resolve(): VariableEnvironment {
    const environment = new VariableEnvironment();
    this.applyDefinitions(environment, this.settingsVariables, true);
    return environment;
  }

  /**
   * Applies a set of variable definitions to the environment,
   * normalizing keys and skipping invalid ones.
   *
   * Non-numeric values are silently skipped to guard against
   * manually-edited settings.json with string values.
   */
  private applyDefinitions(
    environment: VariableEnvironment,
    definitions: VariableDefinitions,
    pin: boolean
  ): void {
    for (const [rawKey, value] of Object.entries(definitions)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue;
      }
      const normalizedKey = normalizeVariableKey(rawKey);
      if (normalizedKey !== null) {
        environment.seed(normalizedKey, value, pin);
      }
    }
  }
}
