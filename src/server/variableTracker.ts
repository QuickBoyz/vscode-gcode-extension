/**
 * Variable Tracker
 *
 * Tracks variable assignments and usages in G-code programs.
 * Uses AST features to efficiently find variable assignments and usages.
 */
import { Position } from "vscode-languageserver";
import { Program } from "../entities";
import {
  ElseIfConditional,
  IfStartConditional,
  WhileStartConditional,
} from "../entities/conditionals";
import {
  BinaryExpression,
  Expression,
  FuncCallExpression,
  RelationalExpression,
  UnaryExpression,
  VariableExpression,
  VariableReference,
} from "../entities/expressions";
import {
  AssignmentStatement,
  BlockStatement,
  CommandStatement,
  Statement,
} from "../entities/statements";
import { BaseVariable } from "../entities/expressions/variables/BaseVariable";

/**
 * Variable tracker that analyzes G-code programs to find variable assignments
 */
export class VariableTracker {
  public getProgramVariables(program: Program): VariableExpression[] {
    return program.getVariables();
  }

  public getProgramVariableReferences(
    program: Program
  ): VariableReference[] {
    return program.getVariableReferences();
  }

  public getProgramVariableAtPosition(
    program: Program,
    position: Position
  ): VariableExpression | null {
    return (
      program
        .getVariables()
        .find((v) => v.isPositionInRange(position)) ?? null
    );
  }

  public getProgramVariableReferenceAtPosition(
    program: Program,
    position: Position
  ): VariableReference | null {
    return (
      program
        .getVariableReferences()
        .find((v) => v.isPositionInRange(position)) ?? null
    );
  }

  /**
   * Find all variable assignments in a program
   */
  public findAssignments(program: Program): AssignmentStatement[] {
    const assignments: AssignmentStatement[] = [];

    // Extract all assignment statements directly from the AST
    for (const statement of program.getBody()) {
      if (statement instanceof AssignmentStatement) {
        assignments.push(statement);
      }
    }

    return assignments;
  }

  /**
   * Find all usages of a variable in a program using AST traversal
   * Traverses the entire AST to find all VariableReference instances
   */
  public findVariableUsages(
    program: Program,
    variable: BaseVariable
  ): Array<{ line: number; character: number; length: number }> {
    const usages: Array<{
      line: number;
      character: number;
      length: number;
    }> = [];

    const variableId = variable.getId();

    // Traverse AST to find all variable references
    this.traverseForVariableUsages(program, variableId, usages);

    return usages;
  }

  /**
   * Traverse AST to collect all usages of a variable
   */
  private traverseForVariableUsages(
    program: Program,
    variableId: number | string,
    usages: Array<{ line: number; character: number; length: number }>
  ): void {
    for (const statement of program.getBody()) {
      this.traverseStatementForVariable(statement, variableId, usages);
    }
  }

  /**
   * Traverse a statement to find variable usages
   */
  private traverseStatementForVariable(
    statement: Statement,
    variableId: number | string,
    usages: Array<{ line: number; character: number; length: number }>
  ): void {
    // Check if statement contains the variable
    if (statement instanceof AssignmentStatement) {
      const variable = statement.getVariable();
      if (variable.getId() === variableId) {
        const range = variable.getRange();
        usages.push({
          line: range.start.line,
          character: range.start.character,
          length: range.end.character - range.start.character,
        });
      }
      // Also check the value expression
      this.traverseExpressionForVariable(
        statement.getValue(),
        variableId,
        usages
      );
    } else if (statement instanceof BlockStatement) {
      for (const command of statement.getCommands()) {
        this.traverseStatementForVariable(command, variableId, usages);
      }
      const paramsBlock = statement.getParamsBlock();
      if (!paramsBlock) {
        return;
      }
      // Check parameters
      for (const paramValue of Object.values(paramsBlock.getParams())) {
        if (paramValue instanceof Expression) {
          this.traverseExpressionForVariable(
            paramValue,
            variableId,
            usages
          );
        }
      }
    } else if (statement instanceof CommandStatement) {
      const paramsBlock = statement.getParamsBlock();
      if (!paramsBlock) {
        return;
      }
      // Check parameters
      for (const paramValue of Object.values(paramsBlock.getParams())) {
        if (paramValue instanceof Expression) {
          this.traverseExpressionForVariable(
            paramValue,
            variableId,
            usages
          );
        }
      }
    }

    // Check conditionals
    if (
      statement instanceof IfStartConditional ||
      statement instanceof WhileStartConditional ||
      statement instanceof ElseIfConditional
    ) {
      this.traverseExpressionForVariable(
        statement.getCondition(),
        variableId,
        usages
      );
    }
  }

  /**
   * Traverse an expression to find variable usages
   */
  private traverseExpressionForVariable(
    expression: Expression,
    variableId: number | string,
    usages: Array<{ line: number; character: number; length: number }>
  ): void {
    if (!expression) return;

    // Check if this expression is the variable we're looking for
    if (
      expression instanceof BaseVariable &&
      expression.getId() === variableId
    ) {
      const range = expression.getRange();
      usages.push({
        line: range.start.line,
        character: range.start.character,
        length: range.end.character - range.start.character,
      });
    }

    // Traverse nested expressions
    if (
      expression instanceof BinaryExpression ||
      expression instanceof RelationalExpression
    ) {
      this.traverseExpressionForVariable(
        expression.getLeft(),
        variableId,
        usages
      );
      this.traverseExpressionForVariable(
        expression.getRight(),
        variableId,
        usages
      );
    } else if (expression instanceof UnaryExpression) {
      this.traverseExpressionForVariable(
        expression.getOperand(),
        variableId,
        usages
      );
    } else if (expression instanceof FuncCallExpression) {
      for (const arg of expression.getArgs()) {
        this.traverseExpressionForVariable(arg, variableId, usages);
      }
    }
  }
}
