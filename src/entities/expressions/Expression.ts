import { ExpressionType } from "./types";
import { gcodeFormatter } from "../../formatter";
import { BaseToken } from "../BaseToken";

/**
 * Base class for all expressions
 */
export abstract class Expression extends BaseToken<ExpressionType> {
  /**
   * Convert expression to string representation
   * Returns a simple string representation for debugging/logging
   */
  toString(): string {
    return gcodeFormatter.formatExpression(this);
  }

  getDescription(): string {
    return "";
  }
}
