/**
 * Hover Provider
 *
 * Provides hover information for G-code elements including variables, G/M codes, and functions.
 * Extracts hover logic from the main server file for better organization and reusability.
 */

import {
  Hover,
  MarkupKind,
  Position,
  Range,
} from "vscode-languageserver";
import { GCODE_SYMBOLS } from "../constants";
import { Program } from "../entities";
import { FuncCallExpression } from "../entities/expressions";
import { CommandStatement } from "../entities/statements";
import { getHoveredToken } from "./astPositionFinder";
import { ASTTraverser } from "./astTraverser";
import {
  formatCodeDescription,
  formatFunctionDescription,
} from "./codeDescriptions";
import { VariableTracker } from "./variableTracker";
import { BaseVariable } from "../entities/expressions/variables/BaseVariable";

/**
 * Hover Provider for G-code language features
 */
export class HoverProvider extends ASTTraverser {
  constructor(variableTracker: VariableTracker) {
    super(variableTracker);
  }

  /**
   * Get hover information for a position in the document
   */
  public getHover(program: Program, position: Position): Hover | null {
    try {
      // First, check for variable references at the position (for variable usages)
      const variableReferenceAtPosition =
        this.variableTracker.getProgramVariableReferenceAtPosition(
          program,
          position
        );
      if (variableReferenceAtPosition) {
        return this.getVariableHoverFromAST(
          program,
          variableReferenceAtPosition
        );
      }

      // Check for variable expressions at the position (for variable declarations)
      const variableAtPosition =
        this.variableTracker.getProgramVariableAtPosition(
          program,
          position
        );
      if (variableAtPosition) {
        return this.getVariableHoverFromAST(
          program,
          variableAtPosition
        );
      }

      // Use AST to find what's at the hover position for other tokens
      const hoveredToken = getHoveredToken(program, position);
      if (hoveredToken) {
        if (hoveredToken instanceof CommandStatement) {
          return this.createHoverContents(
            hoveredToken.getRange(),
            formatCodeDescription(hoveredToken)
          );
        }

        if (hoveredToken instanceof FuncCallExpression) {
          return this.createHoverContents(
            hoveredToken.getRange(),
            formatFunctionDescription(hoveredToken)
          );
        }

        // Check if it's a variable expression/reference (fallback)
        if (hoveredToken instanceof BaseVariable) {
          return this.getVariableHoverFromAST(program, hoveredToken);
        }
      }

      return null;
    } catch (error) {
      console.error(
        `Hover error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    }
  }

  /**
   * Get hover information for variables using AST
   */
  private getVariableHoverFromAST(
    program: Program,
    variable: BaseVariable
  ): Hover | null {
    // Find the assignment for this variable
    const assignments = this.variableTracker.findAssignments(program);
    const assignment = assignments.find((a) => {
      const assignmentVariable = a.getVariable();
      if (!assignmentVariable) return false;
      return assignmentVariable.getId() === variable.getId();
    });

    if (!assignment) {
      return null;
    }

    const varName = variable.toString();
    const valueStr = assignment.getValue().toString();

    // Get line number for display
    const lineNumber = `Line ${assignment.getPosition().line + 1}`;

    // Build hover content
    const contents = [
      `\`${varName}\``,
      `**Value:** \`${valueStr}\``,
      `**Defined at:** ${lineNumber}`,
    ];

    // Use the range from the variable expression for accurate highlighting
    const range = variable.getRange();

    return {
      contents: {
        kind: "markdown",
        value: contents.join(
          `${GCODE_SYMBOLS.NEWLINE}${GCODE_SYMBOLS.NEWLINE}`
        ),
      },
      range,
    };
  }

  /**
   * Create hover contents with consistent formatting
   */
  private createHoverContents(
    range: Range,
    description: string
  ): Hover {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: description,
      },
      range,
    };
  }
}
