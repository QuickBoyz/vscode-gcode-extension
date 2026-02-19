/**
 * Variable Analysis Service
 *
 * Centralizes variable-related operations for rename and highlight providers.
 * Provides symbol search, name formatting, validation, and range extraction.
 */
import { GCodeSymbols, REGEX_PATTERNS } from '../constants';
import { Position, Range, VariableAssignmentNode, VariableReferenceNode } from '../parser/nodes';
import { AnalysisResults } from './AnalysisResults';
import { NodeFinder } from './NodeFinder';

/**
 * Symbol information returned by findSymbolAtPosition
 */
export interface VariableSymbolInfo {
  readonly name: string | number;
  readonly node: VariableAssignmentNode | VariableReferenceNode;
}

/**
 * Variable Analysis Service
 *
 * Handles variable name formatting, validation, range extraction, and symbol search.
 */
export class VariableAnalysisService {
  /**
   * Find symbol at position from analysis results
   *
   * Uses best-match algorithm to find the smallest containing range
   * when multiple symbols overlap at a position.
   *
   * @param analysis - Analysis results containing variable symbols
   * @param position - Position to search at
   * @returns Symbol information (name + node) or null if not found
   */
  findSymbolAtPosition(analysis: AnalysisResults, position: Position): VariableSymbolInfo | null {
    let bestMatch: VariableSymbolInfo | null = null;
    let smallestRangeSize = Infinity;

    for (const [name, symbol] of analysis.variables) {
      // Check all definitions and references
      for (const node of [...symbol.definitions, ...symbol.references]) {
        const range = node.getRange();
        if (Range.isPositionInRange(position, range)) {
          const rangeSize = NodeFinder.calculateRangeSize(range);
          if (rangeSize < smallestRangeSize) {
            smallestRangeSize = rangeSize;
            bestMatch = { name, node };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Get the range of just the variable name (not the entire assignment)
   *
   * - For VariableReferenceNode: returns the full node range
   * - For VariableAssignmentNode: returns only the variable name portion
   *
   * @param node - Variable assignment or reference node
   * @returns Range of the variable name or null
   */
  getVariableNameRange(node: VariableAssignmentNode | VariableReferenceNode): Range | null {
    const fullRange = node.getRange();

    // For VariableReferenceNode, the range is already just the variable
    if (node instanceof VariableReferenceNode) {
      return fullRange;
    }

    // For VariableAssignmentNode, extract just the variable name part
    const formattedName = this.formatVariableName(node.name);
    return Range.create(
      fullRange.start.line,
      fullRange.start.character,
      fullRange.start.line,
      fullRange.start.character + formattedName.length
    );
  }

  /**
   * Format variable name for display/editing
   *
   * - Numeric: #1
   * - Named: #<foo>
   *
   * @param name - Variable name (string or number)
   * @returns Formatted variable name
   */
  formatVariableName(name: string | number): string {
    if (typeof name === 'number') {
      return `${GCodeSymbols.VARIABLE_PREFIX}${name}`;
    }
    return `${GCodeSymbols.NAMED_VAR_OPEN}${name}${GCodeSymbols.NAMED_VAR_CLOSE}`;
  }

  /**
   * Validate a variable name
   *
   * - Numeric: must be a positive integer (typically 1-10000)
   * - Named: must match pattern [a-zA-Z_][a-zA-Z0-9_]*
   *
   * @param name - The name to validate
   * @param isNumeric - Whether the variable is numeric
   * @returns true if valid, false otherwise
   */
  validateVariableName(name: string, isNumeric: boolean): boolean {
    if (isNumeric) {
      // Numeric variables must be a positive integer
      const num = parseInt(name, 10);
      if (isNaN(num) || num < 1 || num.toString() !== name) {
        return false;
      }
      return true;
    }
    // Named variables must match the pattern [a-zA-Z_][a-zA-Z0-9_]*
    return REGEX_PATTERNS.VALID_NAMED_VARIABLE.test(name);
  }

  /**
   * Extract variable name from document text at a given range
   *
   * Parses the text at the specified range and extracts:
   * - Numeric variables: #123 → 123
   * - Named variables: #<foo> → "foo"
   *
   * @param text - Full document text
   * @param range - Range to extract from
   * @returns Variable name (string or number) or null if extraction fails
   */
  extractVariableNameFromText(text: string, range: Range): string | number | null {
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

    const variableText = line.substring(startChar, endChar);

    // Try to extract numeric variable: #123
    const numericMatch = variableText.match(REGEX_PATTERNS.NUMERIC_VARIABLE);
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
}
