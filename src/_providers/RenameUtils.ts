/**
 * Rename Utilities
 *
 * Shared utility functions for variable renaming, position/range conversion,
 * and validation.
 */
import { Position, Range } from "vscode-languageserver/node";
import { Range as AstRange } from "../_parser/nodes";
import { Position as AstPosition } from "../_parser/nodes/Position";
import { REGEX_PATTERNS } from "../constants";

/**
 * Convert AST Range to LSP Range
 * Both use 0-based line numbers, but different type systems
 */
export function astRangeToLspRange(astRange: AstRange): Range {
  return Range.create(
    astRange.start.line,
    astRange.start.character,
    astRange.end.line,
    astRange.end.character
  );
}

/**
 * Convert LSP Position to AST Position
 * Both use 0-based line numbers, but different type systems
 */
export function lspPositionToAstPosition(position: Position): AstPosition {
  return new AstPosition(position.line, position.character);
}

/**
 * Check if LSP position is within AST range
 */
export function isPositionInRange(
  position: Position,
  range: AstRange
): boolean {
  const start = range.start;
  const end = range.end;

  // Check if position is after start
  if (position.line < start.line) {
    return false;
  }
  if (position.line === start.line && position.character < start.character) {
    return false;
  }

  // Check if position is before end (exclusive at end)
  if (position.line > end.line) {
    return false;
  }
  if (position.line === end.line && position.character >= end.character) {
    return false;
  }

  return true;
}

/**
 * Format variable name for display/editing
 * Numeric: #1
 * Named: #<foo>
 */
export function formatVariableName(name: string | number): string {
  if (typeof name === "number") {
    return `#${name}`;
  }
  return `#<${name}>`;
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
  range: AstRange
): string | number | null {
  const lines = text.split(/\r?\n/);
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
  const numericMatch = variableText.match(/^#(\d+)$/);
  if (numericMatch) {
    const num = parseInt(numericMatch[1], 10);
    if (!isNaN(num)) {
      return num;
    }
  }

  // Try to extract named variable: #<foo>
  const namedMatch = variableText.match(/^#<([a-zA-Z_][a-zA-Z0-9_]*)>$/);
  if (namedMatch) {
    return namedMatch[1];
  }

  return null;
}

