/**
 * Rename Utilities
 *
 * Shared utility functions for variable formatting, normalization,
 * renaming, position/range conversion, and validation.
 */
import { GCodeSymbols, REGEX_PATTERNS } from '../constants';
import { Range, VariableAssignmentNode, VariableReferenceNode } from '../parser/nodes';

// ---------------------------------------------------------------------------
// Formatting & normalization
// ---------------------------------------------------------------------------

/**
 * Formats an internal variable key (number or string) to its display form.
 *
 *   - Numeric: `100` → `#100`
 *   - Named:   `"foo"` → `#<foo>`
 */
export function formatVariableName(name: string | number): string {
  if (typeof name === 'number' || /^\d+$/.test(String(name))) {
    return `${GCodeSymbols.VARIABLE_PREFIX}${name}`;
  }
  return `${GCodeSymbols.NAMED_VAR_OPEN}${name}${GCodeSymbols.NAMED_VAR_CLOSE}`;
}

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
export function normalizeVariableKey(key: string | number): string | number | null {
  if (typeof key === 'number') {
    return key;
  }

  const numericMatch = NUMERIC_VARIABLE_PATTERN.exec(key);
  if (numericMatch) {
    return parseInt(numericMatch[1], 10);
  }

  const namedMatch = NAMED_VARIABLE_PATTERN.exec(key);
  if (namedMatch) {
    return namedMatch[1].toLowerCase();
  }

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
  return formatVariableName(normalized);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a new variable name
 * @param name - The new name to validate
 * @param isNumeric - Whether the original variable was numeric
 * @returns true if valid, false otherwise
 */
export function validateVariableName(name: string, isNumeric: boolean): boolean {
  if (isNumeric) {
    // Numeric variables must be a positive integer
    const num = parseInt(name, 10);
    if (isNaN(num) || num < 1 || num.toString() !== name) {
      return false;
    }
    // Typically G-code variables are in range 1-10000, but we'll allow any positive integer
    return true;
  }
  // Named variables must match the pattern [a-zA-Z_][a-zA-Z0-9_]*
  return REGEX_PATTERNS.VALID_NAMED_VARIABLE.test(name);
}

// ---------------------------------------------------------------------------
// Range & extraction
// ---------------------------------------------------------------------------

/**
 * Extract variable name from document text at a given range
 * Returns the variable name (string or number) or null if extraction fails
 */
export function extractVariableNameFromText(text: string, range: Range): string | number | null {
  const lines = text.split(REGEX_PATTERNS.NEWLINE);
  if (range.start.line >= lines.length) {
    return null;
  }

  const line = lines[range.start.line],
    startChar = range.start.character,
    endChar = range.end.character;

  if (startChar < 0 || endChar > line.length) {
    return null;
  }

  const variableText = line.substring(startChar, endChar),
    // Try to extract numeric variable: #123
    numericMatch = variableText.match(REGEX_PATTERNS.NUMERIC_VARIABLE);
  if (numericMatch) {
    const num = parseInt(numericMatch[1], 10);
    if (!isNaN(num)) {
      return num;
    }
  }

  // Try to extract named variable: #<foo>
  const namedMatch = variableText.match(REGEX_PATTERNS.NAMED_VARIABLE);
  if (namedMatch) {
    return namedMatch[1];
  }

  return null;
}

/**
 * Get the range of just the variable name (not the entire assignment)
 */
export function getVariableNameRange(
  symbol: VariableAssignmentNode | VariableReferenceNode
): Range | null {
  const fullRange = symbol.getRange();

  // For VariableReferenceNode, the range is already just the variable
  if (symbol instanceof VariableReferenceNode) {
    return fullRange;
  }

  // For VariableAssignmentNode, we need to extract just the variable name part
  // The variable name starts at the beginning of the range
  const formattedName = formatVariableName(symbol.name);
  return Range.create(
    fullRange.start.line,
    fullRange.start.character,
    fullRange.start.line,
    fullRange.start.character + formattedName.length
  );
}
