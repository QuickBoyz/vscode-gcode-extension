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

import { normalizeVariableKey } from '../providers/RenameUtils';

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
    const normalized = normalizeVariableKey(key);
    if (normalized !== null && !this.pinned.has(normalized)) {
      this.variables.set(normalized, value);
    }
  }

  /**
   * Gets a variable value and records the access for tracking.
   *
   * Used by the expression evaluator for variable references.
   */
  get(key: string | number): number | undefined {
    const normalized = normalizeVariableKey(key);
    if (normalized !== null) {
      this.accessed.add(normalized);
      return this.variables.get(normalized);
    }
    return undefined;
  }

  /**
   * Returns the value of a variable without tracking the access.
   * Returns `null` if the variable was never assigned.
   *
   * Used for building the referenced variables display list.
   */
  peek(key: string | number): number | null {
    const normalized = normalizeVariableKey(key);
    if (normalized !== null) {
      return this.variables.get(normalized) ?? null;
    }
    return null;
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
    const normalized = normalizeVariableKey(key);
    if (normalized !== null) {
      this.variables.set(normalized, value);
      this.initialSnapshot.set(normalized, value);
      if (pin) {
        this.pinned.add(normalized);
      }
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
