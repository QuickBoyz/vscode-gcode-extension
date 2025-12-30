import { ExpressionType } from "./types";
import { GCodeFormatter } from "../../formatter";

/**
 * Base class for all expressions
 */
export abstract class Expression {
  /**
   * Get the expression type
   */
  abstract getType(): ExpressionType;

  /**
   * Convert expression to string representation
   * Returns a simple string representation for debugging/logging
   */
  toString(): string {
    // Default implementation - delegates to GCodeFormatter
    return GCodeFormatter.formatExpression(this);
  }
}
