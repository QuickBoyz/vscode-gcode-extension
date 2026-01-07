/**
 * Rename Utilities
 *
 * Shared utility functions for variable renaming, position/range conversion,
 * and validation.
 */
import {
  Range,
  VariableAssignmentNode,
  VariableReferenceNode,
} from "../parser/nodes";
import { GCodeSymbols, REGEX_PATTERNS } from "../constants";

/**
 * Format variable name for display/editing
 * Numeric: #1
 * Named: #<foo>
 */
export function formatVariableName(name: string | number): string {
  if (typeof name === "number") {
    return `${GCodeSymbols.VARIABLE_PREFIX}${name}`;
  }
  return `${GCodeSymbols.NAMED_VAR_OPEN}${name}${GCodeSymbols.NAMED_VAR_CLOSE}`;
}

/**
 * Validate a new variable name
 * @param name - The new name to validate
 * @param isNumeric - Whether the original variable was numeric
 * @returns true if valid, false otherwise
 */
export function validateVariableName(
  name: string,
  isNumeric: boolean
): boolean {
  if (isNumeric) {
    // Numeric variables must be a positive integer
    const num = parseInt(name, 10);
    if (isNaN(num) || num < 1 || num.toString() !== name) {
      return false;
    }
    // Typically G-code variables are in range 1-10000, but we'll allow any positive integer
    return true;
  } else {
    // Named variables must match the pattern [a-zA-Z_][a-zA-Z0-9_]*
    return REGEX_PATTERNS.VALID_NAMED_VARIABLE.test(name);
  }
}

/**
 * Extract variable name from document text at a given range
 * Returns the variable name (string or number) or null if extraction fails
 */
export function extractVariableNameFromText(
  text: string,
  range: Range
): string | number | null {
  const lines = text.split(REGEX_PATTERNS.NEWLINE);
  if (range.start.line >= lines.length) {
    return null;
  }

  const line = lines[range.start.line];
  const startChar = range.start.character;
  const endChar = range.end.character;

  if (startChar < 0 || endChar > line.length) {
    return null;
  }

  const variableText = line.substring(startChar, endChar);

  // Try to extract numeric variable: #123
  const numericMatch = variableText.match(
    REGEX_PATTERNS.NUMERIC_VARIABLE
  );
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
