/**
 * VariableResolutionService
 *
 * Merges variable values from multiple sources into a single
 * {@link Map} environment suitable for the G-code interpreter.
 *
 * Sources and precedence (highest to lowest):
 *   1. Runtime overrides — set interactively in the visualizer panel
 *   2. Settings defaults — defined in `gcode.variables` in settings.json
 *   3. Program assignments — handled by the interpreter at execution time
 *   4. Default (0) — the interpreter returns null for unknown variables
 *
 * This service handles sources 1 and 2. Source 3 is handled by the
 * interpreter itself (variable assignments in the program take effect
 * during execution). Source 4 is the evaluator's fallback.
 *
 * Variable key normalization:
 *   - `#100` or `100` → numeric key `100`
 *   - `#<name>` or `name` → lowercase string key `name`
 *   - Named variables are case-insensitive (stored lowercase)
 */

/** Map of user-provided variable names (as typed in settings) to values. */
export type VariableDefinitions = Readonly<Record<string, number>>;

/** The resolved variable environment type used by the interpreter. */
export type VariableEnvironment = ReadonlyMap<string | number, number>;

/**
 * Options for constructing a {@link VariableResolutionService}.
 */
export interface VariableResolutionOptions {
  /** Variables defined in VS Code settings (`gcode.variables`). */
  readonly settingsVariables?: VariableDefinitions;
  /** Runtime overrides set interactively in the visualizer panel. */
  readonly runtimeOverrides?: VariableDefinitions;
}

/**
 * Service that merges variable definitions from settings and runtime
 * overrides into a single variable environment for the interpreter.
 */
export class VariableResolutionService {
  /** Pattern matching a numeric variable key: #123 or just 123 */
  private static readonly NUMERIC_VARIABLE_PATTERN = /^#?(\d+)$/;

  /** Pattern matching a named variable key: #<name> */
  private static readonly NAMED_VARIABLE_PATTERN = /^#<([a-zA-Z_][a-zA-Z0-9_]*)>$/;

  /** Pattern matching a bare named variable key (no delimiters): name */
  private static readonly BARE_NAMED_VARIABLE_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  private readonly settingsVariables: VariableDefinitions;
  private readonly runtimeOverrides: VariableDefinitions;

  constructor(options?: VariableResolutionOptions) {
    this.settingsVariables = options?.settingsVariables ?? {};
    this.runtimeOverrides = options?.runtimeOverrides ?? {};
  }

  /**
   * Resolves all variable sources into a single environment map.
   *
   * Precedence: runtime overrides > settings defaults.
   * Program assignments are handled separately by the interpreter.
   */
  resolve(): VariableEnvironment {
    const environment = new Map<string | number, number>();

    // Apply settings first (lower precedence)
    this.applyDefinitions(environment, this.settingsVariables);

    // Apply runtime overrides (higher precedence — overwrites settings)
    this.applyDefinitions(environment, this.runtimeOverrides);

    return environment;
  }

  /**
   * Returns the normalized keys from runtime overrides. These variables
   * are "pinned" and should not be overwritten by program assignments.
   */
  pinnedKeys(): ReadonlySet<string | number> {
    const keys = new Set<string | number>();
    for (const rawKey of Object.keys(this.runtimeOverrides)) {
      const normalized = VariableResolutionService.normalizeVariableKey(rawKey);
      if (normalized !== null) {
        keys.add(normalized);
      }
    }
    return keys;
  }

  /**
   * Applies a set of variable definitions to the environment map,
   * normalizing keys and skipping invalid ones.
   *
   * Non-numeric values are silently skipped to guard against
   * manually-edited settings.json with string values.
   */
  private applyDefinitions(
    environment: Map<string | number, number>,
    definitions: VariableDefinitions
  ): void {
    for (const [rawKey, value] of Object.entries(definitions)) {
      if (typeof value !== 'number') {
        continue;
      }
      const normalizedKey = VariableResolutionService.normalizeVariableKey(rawKey);
      if (normalizedKey !== null) {
        environment.set(normalizedKey, value);
      }
    }
  }

  /**
   * Normalizes a user-provided variable key to the internal format
   * used by the interpreter's variable environment.
   *
   * @returns A numeric key for numbered variables, a lowercase string
   *          key for named variables, or `null` if the key is invalid.
   */
  private static normalizeVariableKey(key: string): string | number | null {
    // Try numeric pattern: #123 or 123
    const numericMatch = VariableResolutionService.NUMERIC_VARIABLE_PATTERN.exec(key);
    if (numericMatch) {
      return parseInt(numericMatch[1], 10);
    }

    // Try named pattern: #<name>
    const namedMatch = VariableResolutionService.NAMED_VARIABLE_PATTERN.exec(key);
    if (namedMatch) {
      return namedMatch[1].toLowerCase();
    }

    // Try bare named pattern: name
    if (VariableResolutionService.BARE_NAMED_VARIABLE_PATTERN.test(key)) {
      return key.toLowerCase();
    }

    return null;
  }
}
