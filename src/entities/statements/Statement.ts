import { StatementType } from "./types";
import { BaseNode } from "../BaseNode";
import { GCODE_SYMBOLS } from "../../constants";

/**
 * Base class for all statements
 */
export abstract class Statement extends BaseNode<StatementType> {
  /**
   * Convert statement to string representation
   * Returns a simple string representation for debugging/logging
   */
  toString(): string {
    // Default implementation - should be overridden by subclasses
    return GCODE_SYMBOLS.EMPTY_STRING;
  }
}
