/**
 * Statement classes for G-code AST
 *
 * This file contains class-based implementations of AST nodes.
 * Classes provide methods and properties that can be reused across the codebase.
 */

import { StatementType, Expression, CommentStyle, ExpressionType } from "./types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Range } from "vscode-languageserver/node";
import { GCODE_SYMBOLS, GCODE_KEYWORDS } from "../constants";

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
   */
  protected formatExpression(expr: Expression): string {
    switch (expr.type) {
      case ExpressionType.Number:
        return expr.value.toString();
      case ExpressionType.Variable:
        if (expr.id !== undefined) {
          return `${GCODE_SYMBOLS.VARIABLE_PREFIX}${expr.id}`;
        }
        if (expr.name !== undefined) {
          return `${GCODE_SYMBOLS.NAMED_VAR_OPEN}${expr.name}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`;
        }
        return "?";
      case ExpressionType.Binary:
        return `${this.formatExpression(expr.left)} ${expr.operator} ${this.formatExpression(expr.right)}`;
      case ExpressionType.Unary:
        return `${expr.operator}${this.formatExpression(expr.operand)}`;
      case ExpressionType.Relational:
        return `${this.formatExpression(expr.left)} ${expr.operator} ${this.formatExpression(expr.right)}`;
      case ExpressionType.FuncCall:
        return `${expr.name}(${expr.args.map((arg) => this.formatExpression(arg)).join(", ")})`;
      default:
        return "?";
    }
  }
}

/**
 * O-block statement
 */
export class OBlockStatement extends Statement {
  type: StatementType.OBlock = StatementType.OBlock;
  id: number;

  constructor(
    id: number,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.id = id;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.OBlock;
  }

  getLabel(): number | null {
    return this.id;
  }

  toString(): string {
    return `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.id}`;
  }
}

/**
 * WHILE start statement
 */
export class WhileStartStatement extends Statement {
  type: StatementType.WhileStart = StatementType.WhileStart;
  label: number | null;
  condition: Expression;

  constructor(
    condition: Expression,
    label: number | null = null,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.label = label;
    this.condition = condition;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.WhileStart;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText = this.label !== null ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} ` : "";
    return `${labelText}${GCODE_KEYWORDS.WHILE} ${GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN}${this.formatExpression(this.condition)}${GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE} ${GCODE_KEYWORDS.DO}`;
  }
}

/**
 * WHILE end statement
 */
export class WhileEndStatement extends Statement {
  type: StatementType.WhileEnd = StatementType.WhileEnd;
  label: number | null;

  constructor(
    label: number | null = null,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.label = label;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.WhileEnd;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText = this.label !== null ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} ` : "";
    return `${labelText}${GCODE_KEYWORDS.END}`;
  }
}

/**
 * IF start statement
 */
export class IfStartStatement extends Statement {
  type: StatementType.IfStart = StatementType.IfStart;
  label: number | null;
  condition: Expression;

  constructor(
    condition: Expression,
    label: number | null = null,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.label = label;
    this.condition = condition;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.IfStart;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText = this.label !== null ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} ` : "";
    return `${labelText}${GCODE_KEYWORDS.IF} ${GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN}${this.formatExpression(this.condition)}${GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE} ${GCODE_KEYWORDS.THEN}`;
  }
}

/**
 * ELSEIF statement
 */
export class ElseIfStatement extends Statement {
  type: StatementType.ElseIf = StatementType.ElseIf;
  label: number | null;
  condition: Expression;

  constructor(
    condition: Expression,
    label: number | null = null,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.label = label;
    this.condition = condition;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.ElseIf;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText = this.label !== null ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} ` : "";
    return `${labelText}${GCODE_KEYWORDS.ELSEIF} ${GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN}${this.formatExpression(this.condition)}${GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE} ${GCODE_KEYWORDS.THEN}`;
  }
}

/**
 * ELSE statement
 */
export class ElseStatement extends Statement {
  type: StatementType.Else = StatementType.Else;
  label: number | null;

  constructor(
    label: number | null = null,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.label = label;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.Else;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText = this.label !== null ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} ` : "";
    return `${labelText}${GCODE_KEYWORDS.ELSE}`;
  }
}

/**
 * ENDIF statement
 */
export class EndIfStatement extends Statement {
  type: StatementType.EndIf = StatementType.EndIf;
  label: number | null;

  constructor(
    label: number | null = null,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.label = label;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.EndIf;
  }

  getLabel(): number | null {
    return this.label;
  }

  toString(): string {
    const labelText = this.label !== null ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${this.label} ` : "";
    return `${labelText}${GCODE_KEYWORDS.ENDIF}`;
  }
}

/**
 * Variable assignment statement
 */
export class AssignStatement extends Statement {
  type: StatementType.Assign = StatementType.Assign;
  variable: number | string;
  value: Expression;

  constructor(
    variable: number | string,
    value: Expression,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.variable = variable;
    this.value = value;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.Assign;
  }

  getLabel(): number | null {
    return null;
  }

  /**
   * Get the variable identifier
   */
  getVariable(): number | string {
    return this.variable;
  }

  toString(): string {
    const varText =
      typeof this.variable === "string"
        ? `${GCODE_SYMBOLS.NAMED_VAR_OPEN}${this.variable}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`
        : `${GCODE_SYMBOLS.VARIABLE_PREFIX}${this.variable}`;
    return `${varText}${GCODE_SYMBOLS.ASSIGNMENT_OPERATOR}${this.formatExpression(this.value)}`;
  }
}
