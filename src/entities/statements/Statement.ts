import { StatementType } from "./types";
import { Expression } from "../expressions";
import { BaseToken } from "../BaseToken";

/**
 * Lazy getter for gcodeFormatter to avoid circular dependency
 * Statement -> formatter -> Statement creates a circular dependency
 * By loading the formatter lazily, we break the cycle
 */
function getFormatter() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { gcodeFormatter } = require("../../formatter");
  return gcodeFormatter;
}

/**
 * Base class for all statements
 */
export abstract class Statement extends BaseToken<StatementType> {
  /**
   * Get the O-block label if this statement has one
   * Returns null if the statement doesn't have a label
   */
  getLabel(): number | null {
    return null;
  }

  /**
   * Get the description of the statement
   * Returns undefined by default
   */
  getDescription(): string {
    return "";
  }

  /**
   * Convert statement to string representation
   * Returns a simple string representation for debugging/logging
   */
  toString(): string {
    // Default implementation - should be overridden by subclasses
    return getFormatter().formatStatementContent(this);
  }

  /**
   * Helper method to format an expression for toString()
   * Delegates to GCodeFormatter to avoid code duplication
   */
  protected formatExpression(expr: Expression): string {
    return getFormatter().formatExpression(expr);
  }
}
