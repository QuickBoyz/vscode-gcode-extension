/**
 * AST Position Finder
 *
 * Utility to find AST nodes at specific positions in a document.
 * Uses the parser to get structured information instead of token-level logic.
 */

import { Program } from "../entities";
import { Statement } from "../entities/statements";
import { Expression } from "../entities/expressions";
import { Position } from "vscode-languageserver";
/**
 * Find AST node at a specific position and return hover information
 */
export function getHoveredToken(
  program: Program,
  position: Position
): Statement | Expression | null {
  // Find the statement that contains this position using stored position info
  return findStatementAtPosition(program, position);
}

/**
 * Find statement at a specific position using stored position information
 */
function findStatementAtPosition(
  program: Program,
  position: Position
): Statement | null {
  // Use stored position information to quickly find the statement
  for (const statement of program.getBody()) {
    if (!statement.getRange()) {
      continue;
    }

    const range = statement.getRange();
    if (
      !range ||
      range.end.line === undefined ||
      range.end.character === undefined
    ) {
      continue;
    }
    // Check if position is within statement's range
    if (
      range.start.line >= position.line &&
      range.start.line <= range.end.line &&
      (range.start.line > position.line ||
        range.start.character >= position.character) &&
      (range.start.line < range.end.line ||
        range.start.character <= range.end.character)
    ) {
      return statement;
    }
  }

  return null;
}

/**
 * Find hover info for G-code or M-code statement
 */
