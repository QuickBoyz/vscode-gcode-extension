/**
 * Variable Tracker
 *
 * Tracks variable definitions and usages in G-code programs.
 * Provides functionality to find variable definitions and get variable information.
 */
import { Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Program } from "../entities";
import { Expression } from "../entities/expressions";
import { Assign } from "../entities/statements";
import { GCODE_SYMBOLS, REGEX_PATTERNS } from "../constants";

/**
 * Information about a variable definition
 */
export interface VariableDefinition {
  /**
   * Variable identifier (number for #123, string for #<name>)
   */
  identifier: number | string;

  /**
   * Line number where variable is defined (0-based)
   */
  line: number;

  /**
   * Column position where variable starts (0-based)
   */
  column: number;

  /**
   * The assignment statement that defines this variable
   */
  statement: Assign;

  /**
   * The value expression assigned to the variable
   */
  value: Expression;
}

/**
 * Variable tracker that analyzes G-code programs to find variable definitions
 */
export class VariableTracker {
  /**
   * Build a regex pattern for matching a variable identifier
   */
  private buildVariablePattern(
    identifier: number | string,
    global: boolean = false
  ): RegExp {
    return typeof identifier === "string"
      ? new RegExp(
          `${GCODE_SYMBOLS.NAMED_VAR_OPEN}${identifier.replace(
            REGEX_PATTERNS.REGEX_SPECIAL_CHARS,
            "\\$&"
          )}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`,
          global ? "g" : ""
        )
      : new RegExp(
          `${GCODE_SYMBOLS.VARIABLE_PREFIX}${identifier}${REGEX_PATTERNS.WORD_BOUNDARY}`,
          global ? "g" : ""
        );
  }
  /**
   * Find all variable definitions in a program
   */
  public findDefinitions(
    program: Program,
    document: TextDocument
  ): VariableDefinition[] {
    const definitions: VariableDefinition[] = [];
    const text = document.getText();
    const lines = text.split(REGEX_PATTERNS.NEWLINE);

    // Extract all assignment statements from the AST
    const assignments: Array<{
      statement: Assign;
      identifier: number | string;
    }> = [];
    for (const statement of program.body) {
      if (statement instanceof Assign) {
        // All assignment statements are now class instances
        assignments.push({
          statement,
          identifier: statement.getVariable(),
        });
      }
    }

    // Find each assignment in the document text
    for (const { statement, identifier } of assignments) {
      // Use regex for both numeric and named variables for consistency
      const varPattern = this.buildVariablePattern(identifier);

      // Search through all lines
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        // Use regex matching for both variable types
        const match = line.match(varPattern);
        if (match && match.index !== undefined) {
          // Check if it's followed by = (assignment)
          const afterVar = line
            .slice(match.index + match[0].length)
            .trim();
          if (afterVar.startsWith(GCODE_SYMBOLS.ASSIGNMENT_OPERATOR)) {
            // Found the assignment, add to definitions
            definitions.push({
              identifier,
              line: lineIndex,
              column: match.index,
              statement,
              value: statement.value,
            });
            break; // Found this assignment, move to next
          }
        }
      }
    }

    return definitions;
  }

  /**
   * Find the definition of a variable at a given position
   */
  public findDefinitionAtPosition(
    program: Program,
    document: TextDocument,
    position: Position
  ): VariableDefinition | null {
    const line = document.getText().split(REGEX_PATTERNS.NEWLINE)[
      position.line
    ];
    if (!line) return null;

    // Find variable at cursor position
    const variable = this.findVariableAtPosition(
      line,
      position.character
    );
    if (!variable) return null;

    // Find all definitions
    const definitions = this.findDefinitions(program, document);

    // Find matching definition
    return (
      definitions.find((def) => {
        if (
          typeof variable.identifier === "string" &&
          typeof def.identifier === "string"
        ) {
          return variable.identifier === def.identifier;
        }
        if (
          typeof variable.identifier === "number" &&
          typeof def.identifier === "number"
        ) {
          return variable.identifier === def.identifier;
        }
        return false;
      }) || null
    );
  }

  /**
   * Find variable at a specific character position in a line
   */
  public findVariableAtPosition(
    line: string,
    character: number
  ): {
    identifier: number | string;
    start: number;
    end: number;
  } | null {
    // Match numeric variables: #123
    const numericVarRegex = REGEX_PATTERNS.NUMERIC_VARIABLE;
    let match: RegExpExecArray | null;

    while ((match = numericVarRegex.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (character >= start && character < end) {
        return {
          identifier: Number(match[1]),
          start,
          end,
        };
      }
    }

    // Match named variables: #<name>
    const namedVarRegex = REGEX_PATTERNS.NAMED_VARIABLE;
    while ((match = namedVarRegex.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (character >= start && character < end) {
        return {
          identifier: match[1],
          start,
          end,
        };
      }
    }

    return null;
  }

  /**
   * Find all usages of a variable in the document
   */
  public findUsages(
    program: Program,
    document: TextDocument,
    identifier: number | string
  ): Array<{ line: number; character: number; length: number }> {
    const usages: Array<{
      line: number;
      character: number;
      length: number;
    }> = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Determine the pattern to search for
    const varPattern = this.buildVariablePattern(identifier, true);

    // Search through all lines
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let match: RegExpExecArray | null;

      // Reset regex lastIndex for each line
      varPattern.lastIndex = 0;

      while ((match = varPattern.exec(line)) !== null) {
        usages.push({
          line: lineIndex,
          character: match.index,
          length: match[0].length,
        });
      }
    }

    return usages;
  }
}
