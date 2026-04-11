/**
 * Pure utility functions for normalizing and canonicalizing G-code
 * variable keys. Shared between the visualizer layer and the webview.
 *
 * Key formats:
 *   - `#100` or `100` → numeric key `100`
 *   - `#<name>` or `name` → lowercase string key `"name"`
 *   - Named variables are case-insensitive (stored lowercase)
 */

/** Pattern matching a numeric variable key: #123 or just 123 */
const NUMERIC_VARIABLE_PATTERN = /^#?(\d+)$/;

/** Pattern matching a named variable key: #<name> */
const NAMED_VARIABLE_PATTERN = /^#<([a-zA-Z_][a-zA-Z0-9_]*)>$/;

/** Pattern matching a bare named variable key (no delimiters): name */
const BARE_NAMED_VARIABLE_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Normalizes a user-provided variable key to the internal format
 * used by the interpreter's variable environment.
 *
 * @returns A numeric key for numbered variables, a lowercase string
 *          key for named variables, or `null` if the key is invalid.
 */
export function normalizeVariableKey(key: string): string | number | null {
  // Try numeric pattern: #123 or 123
  const numericMatch = NUMERIC_VARIABLE_PATTERN.exec(key);
  if (numericMatch) {
    return parseInt(numericMatch[1], 10);
  }

  // Try named pattern: #<name>
  const namedMatch = NAMED_VARIABLE_PATTERN.exec(key);
  if (namedMatch) {
    return namedMatch[1].toLowerCase();
  }

  // Try bare named pattern: name
  if (BARE_NAMED_VARIABLE_PATTERN.test(key)) {
    return key.toLowerCase();
  }

  return null;
}

/**
 * Converts a user-provided variable key to its canonical display form.
 * Combines normalization with formatting: numeric keys become `#123`,
 * named keys become `#<name>` (lowercase).
 *
 * @returns The canonical display key, or `null` if the input is invalid.
 */
export function canonicalizeVariableKey(key: string): string | null {
  const normalized = normalizeVariableKey(key);
  if (normalized === null) return null;
  if (typeof normalized === 'number') return `#${normalized}`;
  return `#<${normalized}>`;
}
