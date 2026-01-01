/**
 * AST Traverser
 *
 * Base class for traversing AST nodes and performing operations on them.
 * Provides common traversal logic used by hover, semantic tokens, and other providers.
 */

import { TextDocument } from "vscode-languageserver-textdocument";
import { Program } from "../entities";
import { Statement } from "../entities/statements";
import { Expression } from "../entities/expressions";
import {
  Block,
  Command,
  IfStart,
  WhileStart,
  ElseIf,
  Assignment,
} from "../entities/statements";
import {
  Binary,
  Relational,
  FuncCall,
  Unary,
} from "../entities/expressions";

/**
 * Base class for AST traversal operations
 */
export abstract class ASTTraverser {
  protected variableTracker: any; // Will be typed properly when imported

  constructor(variableTracker: any) {
    this.variableTracker = variableTracker;
  }

  /**
   * Traverse the entire program
   */
  public traverseProgram(
    program: Program,
    document: TextDocument,
    context?: any
  ): void {
    for (const statement of program.getBody()) {
      this.traverseStatement(statement, document, context);
    }
  }

  /**
   * Traverse a single statement
   */
  protected traverseStatement(
    statement: Statement,
    document: TextDocument,
    context?: any
  ): void {
    // Call the abstract method for statement processing
    this.processStatement(statement, document, context);

    // Handle nested structures based on statement type
    this.handleStatementNesting(statement, document, context);
  }

  /**
   * Abstract method to be implemented by subclasses for statement processing
   */
  protected abstract processStatement(
    statement: Statement,
    document: TextDocument,
    context?: any
  ): void;

  /**
   * Handle nested structures within statements
   */
  private handleStatementNesting(
    statement: Statement,
    document: TextDocument,
    context?: any
  ): void {
    // Handle control flow statements with conditions
    if (
      statement instanceof IfStart ||
      statement instanceof WhileStart ||
      statement instanceof ElseIf
    ) {
      this.traverseExpression(statement.getCondition(), document, context);
    }

    // Handle blocks and commands with parameters
    if (statement instanceof Block) {
      for (const command of statement.getCodes()) {
        this.traverseStatement(command, document, context);
      }
      this.traverseParamBlock(statement.getParams(), document, context);
    } else if (statement instanceof Command) {
      this.traverseParamBlock(statement.getParams(), document, context);
    }

    // Handle assignments
    if (statement instanceof Assignment) {
      this.traverseExpression(statement.getValue(), document, context);
    }
  }

  /**
   * Traverse an expression
   */
  protected traverseExpression(
    expression: Expression,
    document: TextDocument,
    context?: any
  ): void {
    // Call the abstract method for expression processing
    this.processExpression(expression, document, context);

    // Handle nested expressions
    this.handleExpressionNesting(expression, document, context);
  }

  /**
   * Abstract method to be implemented by subclasses for expression processing
   */
  protected abstract processExpression(
    expression: Expression,
    document: TextDocument,
    context?: any
  ): void;

  /**
   * Handle nested structures within expressions
   */
  private handleExpressionNesting(
    expression: Expression,
    document: TextDocument,
    context?: any
  ): void {
    if (expression instanceof Binary) {
      this.traverseExpression(expression.getLeft(), document, context);
      this.traverseExpression(expression.getRight(), document, context);
    } else if (expression instanceof Relational) {
      this.traverseExpression(expression.getLeft(), document, context);
      this.traverseExpression(expression.getRight(), document, context);
    } else if (expression instanceof Unary) {
      this.traverseExpression(expression.getOperand(), document, context);
    } else if (expression instanceof FuncCall) {
      for (const arg of expression.getArgs()) {
        this.traverseExpression(arg, document, context);
      }
    }
  }

  /**
   * Traverse parameter block
   */
  protected traverseParamBlock(
    params: any,
    document: TextDocument,
    context?: any
  ): void {
    for (const [, value] of Object.entries(params)) {
      if (
        typeof value === "object" &&
        value !== null &&
        "getType" in value
      ) {
        // It's an Expression
        this.traverseExpression(value as Expression, document, context);
      }
    }
  }

  /**
   * Get the text content for a specific range in the document
   */
  protected getRangeText(
    document: TextDocument,
    startLine: number,
    startChar: number,
    endLine: number,
    endChar: number
  ): string {
    const lines = document.getText().split(/\r?\n/);

    if (startLine === endLine) {
      return lines[startLine]?.slice(startChar, endChar) || "";
    }

    let result = lines[startLine]?.slice(startChar) || "";
    for (let i = startLine + 1; i < endLine; i++) {
      result += "\n" + (lines[i] || "");
    }
    if (endLine < lines.length) {
      result += "\n" + (lines[endLine]?.slice(0, endChar) || "");
    }

    return result;
  }

  /**
   * Get the text for a specific line
   */
  protected getLineText(document: TextDocument, line: number): string {
    const lines = document.getText().split(/\r?\n/);
    return lines[line] || "";
  }
}
