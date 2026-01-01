/**
 * AST Traverser
 *
 * Base class for traversing AST nodes and performing operations on them.
 * Provides common traversal logic used by hover, semantic tokens, and other providers.
 */

import { TextDocument } from "vscode-languageserver-textdocument";
import { Program, ParamsBlock } from "../entities";
import {
  AssignmentStatement,
  BlockStatement,
  CommandStatement,
  Statement,
} from "../entities/statements";
import {
  BinaryExpression,
  Expression,
  FuncCallExpression,
  RelationalExpression,
  UnaryExpression,
} from "../entities/expressions";
import {} from "../entities/statements";
import {} from "../entities/expressions";
import { ConditionalStatement } from "../entities/conditionals";
import { VariableTracker } from "./variableTracker";

/**
 * Base class for AST traversal operations
 */
export abstract class ASTTraverser<Context extends unknown = unknown> {
  protected variableTracker: VariableTracker;

  constructor(variableTracker: VariableTracker) {
    this.variableTracker = variableTracker;
  }

  /**
   * Traverse the entire program
   */
  public traverseProgram(
    program: Program,
    document: TextDocument,
    context?: Context
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
    context?: Context
  ): void {
    // Call the abstract method for statement processing
    this.processStatement(statement, document, context);

    // Handle nested structures based on statement type
    this.handleStatementNesting(statement, document, context);
  }

  /**
   * Abstract method to be implemented by subclasses for statement processing
   */
  protected processStatement(
    statement: Statement,
    document: TextDocument,
    context?: Context
  ): void {}

  /**
   * Handle nested structures within statements
   */
  protected handleStatementNesting(
    statement: Statement,
    document: TextDocument,
    context?: Context
  ): void {
    // Handle control flow statements with conditions
    if (statement instanceof ConditionalStatement) {
      this.traverseExpression(
        statement.getCondition(),
        document,
        context
      );
    }

    // Handle blocks and commands with parameters
    if (statement instanceof BlockStatement) {
      for (const command of statement.getCommands()) {
        this.traverseStatement(command, document, context);
      }
      const paramsBlock = statement.getParamsBlock();
      if (!paramsBlock) {
        return;
      }
      this.traverseParamsBlock(
        paramsBlock.getParams(),
        document,
        context
      );
    } else if (statement instanceof CommandStatement) {
      const paramsBlock = statement.getParamsBlock();
      if (!paramsBlock) {
        return;
      }
      this.traverseParamsBlock(
        paramsBlock.getParams(),
        document,
        context
      );
    }

    // Handle assignments
    if (statement instanceof AssignmentStatement) {
      this.traverseExpression(statement.getValue(), document, context);
    }
  }

  /**
   * Traverse an expression
   */
  protected traverseExpression(
    expression: Expression,
    document: TextDocument,
    context?: Context
  ): void {
    // Call the abstract method for expression processing
    this.processExpression(expression, document, context);

    // Handle nested expressions
    this.handleExpressionNesting(expression, document, context);
  }

  /**
   * Abstract method to be implemented by subclasses for expression processing
   */
  protected processExpression(
    expression: Expression,
    document: TextDocument,
    context?: Context
  ): void {}

  /**
   * Handle nested structures within expressions
   */
  protected handleExpressionNesting(
    expression: Expression,
    document: TextDocument,
    context?: Context
  ): void {
    if (expression instanceof BinaryExpression) {
      this.traverseExpression(expression.getLeft(), document, context);
      this.traverseExpression(expression.getRight(), document, context);
    } else if (expression instanceof RelationalExpression) {
      this.traverseExpression(expression.getLeft(), document, context);
      this.traverseExpression(expression.getRight(), document, context);
    } else if (expression instanceof UnaryExpression) {
      this.traverseExpression(
        expression.getOperand(),
        document,
        context
      );
    } else if (expression instanceof FuncCallExpression) {
      for (const arg of expression.getArgs()) {
        this.traverseExpression(arg, document, context);
      }
    }
  }

  /**
   * Traverse parameter block
   */
  protected traverseParamsBlock(
    params: ParamsBlock["params"],
    document: TextDocument,
    context?: Context
  ): void {
    for (const [, value] of Object.entries(params)) {
      if (value instanceof Expression) {
        // It's an Expression
        this.traverseExpression(value, document, context);
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
