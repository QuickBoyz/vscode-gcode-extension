/**
 * VariableResolutionService
 *
 * Merges variable values from multiple sources into a single
 * {@link VariableEnvironment} suitable for the G-code interpreter.
 *
 * Sources and precedence (highest to lowest):
 *   1. Runtime overrides — set interactively in the visualizer panel;
 *      these are **pinned** and cannot be overwritten by program assignments
 *   2. Settings defaults — defined in `gcode.variables` in settings.json
 *   3. Program assignments — handled by the interpreter at execution time
 *   4. Default (null) — the evaluator returns null for unknown variables
 *
 * This service handles sources 1 and 2. Source 3 is handled by the
 * interpreter itself (variable assignments in the program take effect
 * during execution, unless the variable is pinned). Source 4 is the
 * evaluator's fallback.
 *
 * Variable key normalization:
 *   - `#100` or `100` → numeric key `100`
 *   - `#<name>` or `name` → lowercase string key `name`
 *   - Named variables are case-insensitive (stored lowercase)
 */

import { VariableDefinitions } from '../config/types';

// Re-export so existing imports from this module continue to work.
export type { VariableDefinitions } from '../config/types';

/**
 * Options for constructing a {@link VariableResolutionService}.
 */
export interface VariableResolutionOptions {
  /** Variables defined in VS Code settings (`gcode.variables`). */
  readonly settingsVariables?: VariableDefinitions;
  /** Runtime overrides set interactively in the visualizer panel. */
  readonly runtimeOverrides?: VariableDefinitions;
}

// ---------------------------------------------------------------------------
// VariableEnvironment — self-contained variable store
// ---------------------------------------------------------------------------

/**
 * Self-contained variable environment for the G-code interpreter.
 *
 * Encapsulates variable storage, pinning (runtime overrides that
 * program assignments cannot overwrite), and access tracking (which
 * variables were read during evaluation).
 *
 * Consumers use this single object instead of threading separate
 * Map + pinnedSet + accessedSet through the pipeline.
 */
export class VariableEnvironment {
  private readonly variables = new Map<string | number, number>();
  private readonly pinned = new Set<string | number>();
  private readonly accessed = new Set<string | number>();
  private readonly initialSnapshot = new Map<string | number, number>();

  /**
   * Creates a VariableEnvironment pre-seeded with the given variables.
   * Convenience factory for tests and simple use cases.
   */
  static fromEntries(entries: ReadonlyMap<string | number, number>): VariableEnvironment {
    const env = new VariableEnvironment();
    for (const [key, value] of entries) {
      env.seed(key, value, false);
    }
    return env;
  }

  /**
   * Sets a variable value. If the variable is pinned (from a runtime
   * override), the write is silently ignored.
   *
   * Used by the interpreter for program assignments (`#100 = 50`).
   */
  set(key: string | number, value: number): void {
    if (!this.pinned.has(key)) {
      this.variables.set(key, value);
    }
  }

  /**
   * Gets a variable value and records the access for tracking.
   *
   * Used by the expression evaluator for variable references.
   */
  get(key: string | number): number | undefined {
    this.accessed.add(key);
    return this.variables.get(key);
  }

  /**
   * Returns the value of a variable without tracking the access.
   * Returns `null` if the variable was never assigned.
   *
   * Used for building the referenced variables display list.
   */
  peek(key: string | number): number | null {
    return this.variables.get(key) ?? null;
  }

  /**
   * Returns all variable keys that were read via {@link get} during
   * interpretation.
   */
  get referencedKeys(): ReadonlySet<string | number> {
    return this.accessed;
  }

  /**
   * Seeds a variable with an initial value. If `pin` is true, the
   * variable cannot be overwritten by program assignments.
   *
   * Used by {@link VariableResolutionService} during construction.
   */
  seed(key: string | number, value: number, pin: boolean): void {
    this.variables.set(key, value);
    this.initialSnapshot.set(key, value);
    if (pin) {
      this.pinned.add(key);
    }
  }

  /**
   * Resets the environment for a new interpretation run. Restores
   * seeded values (settings + overrides) and clears access tracking,
   * but preserves pinning.
   *
   * Used by the interpreter when reusing the same instance for
   * multiple programs.
   */
  reset(): void {
    this.variables.clear();
    this.accessed.clear();

    for (const [key, value] of this.initialSnapshot) {
      this.variables.set(key, value);
    }
  }
}

// ---------------------------------------------------------------------------
// VariableResolutionService — merges variable sources
// ---------------------------------------------------------------------------

/**
 * Service that merges variable definitions from settings and runtime
 * overrides into a single {@link VariableEnvironment} for the interpreter.
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
   * Resolves all variable sources into a single {@link VariableEnvironment}.
   *
   * Settings variables are seeded first (lower precedence), then runtime
   * overrides are seeded on top and pinned so program assignments cannot
   * overwrite them.
   */
  resolve(): VariableEnvironment {
    const environment = new VariableEnvironment();

    // Seed settings first (lower precedence, not pinned)
    this.applyDefinitions(environment, this.settingsVariables, false);

    // Seed runtime overrides (higher precedence, pinned)
    this.applyDefinitions(environment, this.runtimeOverrides, true);

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
      if (typeof value !== 'number') {
        continue;
      }
      const normalizedKey = VariableResolutionService.normalizeVariableKey(rawKey);
      if (normalizedKey !== null) {
        environment.seed(normalizedKey, value, pin);
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
