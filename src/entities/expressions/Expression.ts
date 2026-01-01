import { ExpressionType } from "./types";
import { BaseNode } from "../BaseNode";
import { GCODE_SYMBOLS } from "../../constants";

/**
 * Base class for all expressions
 */
export abstract class Expression extends BaseNode<ExpressionType> {
  /**
   * Convert expression to string representation
   * Returns a simple string representation for debugging/logging
   */
  toString(): string {
    return GCODE_SYMBOLS.EMPTY_STRING;
  }
}
