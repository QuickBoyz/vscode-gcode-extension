import { TextDocument } from "vscode-languageserver-textdocument";
import { Range } from "vscode-languageserver/node";

import { GCodeFormatter } from "../../formatter";
import { StatementType, CommentStyle } from "./types";
import { Expression } from "../expressions";

/**
 * Base class for all statements
 */
export abstract class Statement {
  lineNumber?: number;
  comment?: string;
  commentStyle?: CommentStyle;

  /**
   * Get the statement type
   */
  abstract getType(): StatementType;

  /**
   * Get the O-block label if this statement has one
   * Returns null if the statement doesn't have a label
   */
  abstract getLabel(): number | null;

  /**
   * Get the range of this statement in the document
   * Returns null if position information is not available
   */
  getRange(_document: TextDocument): Range | null {
    // Default implementation - can be overridden by subclasses
    return null;
  }

  /**
   * Convert statement to string representation
   * Returns a simple string representation for debugging/logging
   */
  toString(): string {
    // Default implementation - should be overridden by subclasses
    return `${this.getType()}`;
  }

  /**
   * Helper method to format an expression for toString()
   * Delegates to GCodeFormatter to avoid code duplication
   */
  protected formatExpression(expr: Expression): string {
    return GCodeFormatter.formatExpression(expr);
  }
}
