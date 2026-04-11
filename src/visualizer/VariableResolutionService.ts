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

import { VariableDefinitions } from '../config/types';
import { normalizeVariableKey } from './variableKeyUtils';

/**
 * Options for constructing a {@link VariableResolutionService}.
 */
export interface VariableResolutionOptions {
  /** Variables defined in VS Code settings (`gcode.variables`). */
  readonly settingsVariables?: VariableDefinitions;
}

// ---------------------------------------------------------------------------
// VariableEnvironment — self-contained variable store
// ---------------------------------------------------------------------------

/**
 * Self-contained variable environment for the G-code interpreter.
 *
 * Encapsulates variable storage, pinning (settings variables that
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
   * Normalizes a variable key so that string keys are always lowercase.
   * This ensures case-insensitive matching for named variables regardless
   * of whether the key originates from settings or from the AST.
   */
  private normalizeKey(key: string | number): string | number {
    return typeof key === 'string' ? key.toLowerCase() : key;
  }

  /**
   * Creates a VariableEnvironment pre-seeded with the given variables.
   * Convenience factory for tests and simple use cases.
   */
  static fromEntries(entries: ReadonlyMap<string | number, number>): VariableEnvironment {
    const env = new VariableEnvironment();
    for (const [key, value] of entries) {
      env.seed(key, value);
    }
    return env;
  }

  /**
   * Sets a variable value. If the variable is pinned (from settings),
   * the write is silently ignored.
   *
   * Used by the interpreter for program assignments (`#100 = 50`).
   */
  set(key: string | number, value: number): void {
    const normalized = this.normalizeKey(key);
    if (!this.pinned.has(normalized)) {
      this.variables.set(normalized, value);
    }
  }

  /**
   * Gets a variable value and records the access for tracking.
   *
   * Used by the expression evaluator for variable references.
   */
  get(key: string | number): number | undefined {
    const normalized = this.normalizeKey(key);
    this.accessed.add(normalized);
    return this.variables.get(normalized);
  }

  /**
   * Returns the value of a variable without tracking the access.
   * Returns `null` if the variable was never assigned.
   *
   * Used for building the referenced variables display list.
   */
  peek(key: string | number): number | null {
    const normalized = this.normalizeKey(key);
    return this.variables.get(normalized) ?? null;
  }

  /**
   * Returns all variable keys that were read via {@link get} during
   * interpretation.
   */
  get referencedKeys(): ReadonlySet<string | number> {
    return this.accessed;
  }

  /**
   * Seeds a variable with an initial value and snapshots it for
   * {@link reset}. Pinned variables cannot be overwritten by program
   * assignments via {@link set}.
   *
   * Used by {@link VariableResolutionService} during construction.
   */
  seed(key: string | number, value: number, pin = false): void {
    const normalized = this.normalizeKey(key);
    this.variables.set(normalized, value);
    this.initialSnapshot.set(normalized, value);
    if (pin) {
      this.pinned.add(normalized);
    }
  }

  /**
   * Resets the environment for a new interpretation run. Restores
   * seeded values and clears access tracking.
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
