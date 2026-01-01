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
import { BlockStatement } from "../entities/statements/BlockStatement";
import { CommandStatement } from "../entities/statements/CommandStatement";
import { BinaryExpression } from "../entities/expressions/BinaryExpression";
import { UnaryExpression } from "../entities/expressions/UnaryExpression";
import { RelationalExpression } from "../entities/expressions/RelationalExpression";
import { FuncCallExpression } from "../entities/expressions/FuncCallExpression";

/**
 * Find AST node at a specific position and return hover information
 */
export function getHoveredToken(
  program: Program,
  position: Position
): Statement | Expression | null {
  // Find the statement that contains this position
  const statement = findStatementAtPosition(program, position);
  if (!statement) {
    return null;
  }

  // Drill down to find the most specific token at the position
  return findMostSpecificToken(statement, position);
}

/**
 * Check if a position is within any parameter expression of a statement
 */
function isPositionInStatementParameters(
  statement: Statement,
  position: Position
): boolean {
  if (
    statement instanceof CommandStatement ||
    statement instanceof BlockStatement
  ) {
    const paramsBlock = statement.getParamsBlock();
    if (!paramsBlock) {
      return false;
    }

    // First check if position is within the ParamsBlock range
    if (!paramsBlock.isPositionInRange(position)) {
      return false;
    }

    // Then check if position is within any parameter expression
    for (const paramValue of Object.values(paramsBlock.getParams())) {
      if (paramValue instanceof Expression) {
        if (paramValue.isPositionInRange(position)) {
          return true;
        }
      }
    }

    // Position is in ParamsBlock range but not in any expression
    // (e.g., in whitespace between parameters) - still return true
    // so we can check children
    return true;
  }

  return false;
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
    // Check if position is in the statement itself
    if (statement.isPositionInRange(position)) {
      return statement;
    }

    // Also check if position is in any of the statement's parameters
    // This handles cases where the statement range only covers the command code
    // but the position is in the parameters (e.g., hovering over "SIN" in "G0 X[SIN[30]]")
    if (isPositionInStatementParameters(statement, position)) {
      return statement;
    }
  }

  return null;
}

/**
 * Get all child nodes (expressions/statements) from a node
 */
function getChildNodes(
  node: Statement | Expression
): Array<Statement | Expression> {
  const children: Array<Statement | Expression> = [];

  // Handle Block statements
  if (node instanceof BlockStatement) {
    children.push(...node.getCommands());
    // Add expressions from parameters
    const paramsBlock = node.getParamsBlock();
    if (!paramsBlock) {
      return children;
    }
    for (const paramValue of Object.values(paramsBlock.getParams())) {
      if (paramValue instanceof Expression) {
        children.push(paramValue);
      }
    }
    return children;
  }

  // Handle Command statements
  if (node instanceof CommandStatement) {
    // Add expressions from parameters
    const paramsBlock = node.getParamsBlock();
    if (!paramsBlock) {
      return children;
    }
    for (const paramValue of Object.values(paramsBlock.getParams())) {
      if (paramValue instanceof Expression) {
        children.push(paramValue);
      }
    }
    return children;
  }

  // Handle Expressions - get their child expressions
  if (
    node instanceof BinaryExpression ||
    node instanceof RelationalExpression
  ) {
    children.push(node.getLeft(), node.getRight());
  } else if (node instanceof UnaryExpression) {
    children.push(node.getOperand());
  } else if (node instanceof FuncCallExpression) {
    children.push(...node.getArgs());
  }

  return children;
}

/**
 * Calculate the area (range size) of a node for comparison
 */
function getRangeSize(node: Statement | Expression): number {
  const range = node.getRange();
  const lineDiff = range.end.line - range.start.line;
  const charDiff = range.end.character - range.start.character;
  // Use a large multiplier for lines to prioritize smaller ranges
  return lineDiff * 10000 + charDiff;
}

/**
 * Find the most specific token (Statement or Expression) at the given position
 * Recursively checks all child nodes to find the smallest containing node
 */
function findMostSpecificToken(
  statement: Statement | Expression,
  position: Position
): Statement | Expression | null {
  // Check if position is in the statement/expression itself
  const isInStatement = statement.isPositionInRange(position);

  // For CommandStatement and BlockStatement, also check if position is in parameters
  // even if it's not in the statement range itself
  let shouldCheckChildren = isInStatement;
  if (
    !isInStatement &&
    (statement instanceof CommandStatement ||
      statement instanceof BlockStatement)
  ) {
    shouldCheckChildren = isPositionInStatementParameters(
      statement,
      position
    );
  }

  if (!shouldCheckChildren) {
    return null;
  }

  // Get all child nodes and check if position is in any of them
  const children = getChildNodes(statement);
  const matchingChildren: Array<{
    node: Statement | Expression;
    result: Statement | Expression;
    size: number;
  }> = [];

  // Find all children that contain the position and their recursive results
  for (const child of children) {
    const childResult = findMostSpecificToken(child, position);
    if (childResult) {
      matchingChildren.push({
        node: child,
        result: childResult,
        size: getRangeSize(childResult),
      });
    }
  }

  // If we found matching children, return the one with the smallest range (most specific)
  if (matchingChildren.length > 0) {
    // Sort by size (smallest first) and return the most specific
    matchingChildren.sort((a, b) => a.size - b.size);
    return matchingChildren[0].result;
  }

  // Position is in this node but not in any child
  // For CommandStatement and BlockStatement, only return the statement if the position
  // is actually on the command code itself (not in parameters or whitespace)
  if (isInStatement) {
    // For CommandStatement, check if position is on the command code
    if (statement instanceof CommandStatement) {
      const statementRange = statement.getRange();
      // The command code is typically at the start of the range
      // Estimate the command code length (e.g., "G0" is 2 characters, "G00" is 3)
      // We'll check if the position is within the first few characters
      const codeLength =
        statement.getCodeLetter().length +
        (statement.getCode() < 10
          ? 1
          : statement.getCode() < 100
          ? 2
          : 3);
      const codeEndChar = statementRange.start.character + codeLength;

      // Only return the statement if position is on the code itself
      if (
        position.character >= statementRange.start.character &&
        position.character < codeEndChar
      ) {
        return statement;
      }
      // Position is in statement range but not on the code - return null
      return null;
    }

    // For other statements, return the statement itself
    return statement;
  }

  // If we got here, the position is in parameters but not in any child expression
  // This shouldn't happen, but return null to be safe
  return null;
}
