/**
 * Hover Provider
 *
 * Provides hover information for G-code elements including variables, G/M codes, and functions.
 * Extracts hover logic from the main server file for better organization and reusability.
 */

import { TextDocument } from "vscode-languageserver-textdocument";
import { Position, Range, Hover, MarkupKind } from "vscode-languageserver";
import { Program } from "../entities";
import { Statement } from "../entities/statements";
import { Expression } from "../entities/expressions";
import { Command } from "../entities/statements";
import { FuncCall } from "../entities/expressions";
import { ASTTraverser } from "./astTraverser";
import { VariableTracker } from "./variableTracker";
import { gcodeFormatter } from "../formatter";
import { GCODE_SYMBOLS, REGEX_PATTERNS } from "../constants";
import {
  formatCodeDescription,
  formatFunctionDescription,
} from "./codeDescriptions";
import { getHoveredToken } from "./astPositionFinder";

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
  public getHover(
    program: Program,
    document: TextDocument,
    position: Position
  ): Hover | null {
    try {
      const text = document.getText();
      const lines = text.split(REGEX_PATTERNS.NEWLINE);
      const line = lines[position.line];

      // Use parser/AST to find what's at the hover position
      const hoveredToken = getHoveredToken(program, position);
      if (hoveredToken) {
        if (hoveredToken instanceof Command) {
          return this.createHoverContents(
            hoveredToken.getRange(),
            formatCodeDescription(hoveredToken)
          );
        }

        if (hoveredToken instanceof FuncCall) {
          return this.createHoverContents(
            hoveredToken.getRange(),
            formatFunctionDescription(hoveredToken)
          );
        }
      }

      // If not a G/M code or function, check for variables
      return this.getVariableHover(program, document, position, line);
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
   * Get hover information for variables
   */
  private getVariableHover(
    program: Program,
    document: TextDocument,
    position: Position,
    line: string
  ): Hover | null {
    const definition = this.variableTracker.findDefinitionAtPosition(
      program,
      document,
      position
    );

    if (!definition) {
      return null;
    }

    // Format variable identifier
    const varName =
      typeof definition.identifier === "string"
        ? gcodeFormatter.formatNamedVariable(definition.identifier)
        : gcodeFormatter.formatNumericVariable(definition.identifier);

    // Format value
    const valueStr = gcodeFormatter.formatExpression(
      definition.statement.getValue()
    );

    // Get line number for display
    const lineNumber =
      definition.statement.getPosition().line + 1
        ? gcodeFormatter.formatLineNumber(
            definition.statement.getPosition().line + 1
          )
        : `Line ${definition.statement.getPosition().line + 1}`;

    // Build hover content
    const contents = [
      `\`${varName}\``,
      `**Value:** \`${valueStr}\``,
      `**Defined at:** ${lineNumber}`,
    ];

    // Find the variable range in the current line for highlighting
    const varMatch = line.match(
      typeof definition.identifier === "string"
        ? new RegExp(
            `${
              GCODE_SYMBOLS.NAMED_VAR_OPEN
            }${definition.identifier.replace(
              REGEX_PATTERNS.REGEX_SPECIAL_CHARS,
              "\\$&"
            )}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`
          )
        : new RegExp(
            `${GCODE_SYMBOLS.VARIABLE_PREFIX}${definition.identifier}${REGEX_PATTERNS.WORD_BOUNDARY}`
          )
    );

    let range: Range | undefined;
    if (varMatch && varMatch.index !== undefined) {
      range = Range.create(
        position.line,
        varMatch.index,
        position.line,
        varMatch.index + varMatch[0].length
      );
    }

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
  private createHoverContents(range: Range, description: string): Hover {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: description,
      },
      range,
    };
  }

  // Implement abstract methods from ASTTraverser (not used in hover provider)
  protected processStatement(
    statement: Statement,
    document: TextDocument,
    context?: any
  ): void {
    // Not used in hover provider
  }

  protected processExpression(
    expression: Expression,
    document: TextDocument,
    context?: any
  ): void {
    // Not used in hover provider
  }
}
