/**
 * G-code formatter that converts AST back to formatted G-code
 */

import { Range } from "vscode-languageserver";
import {
  DEFAULTS,
  DEFAULT_FORMATTER_SETTINGS,
  GCODE_SYMBOLS,
} from "../constants";
import { Program } from "../entities";
import {
  ElseIfConditional,
  IfStartConditional,
  WhileStartConditional,
} from "../entities/conditionals";
import {
  ElseStatement,
  EmptyLineStatement,
  EndIfStatement,
  LineNumberStatement,
  ParenthicalCommentStatement,
  SemicolonCommentStatement,
  Statement,
  WhileEndStatement,
} from "../entities/statements";
import { FormatterSettings } from "./types";

class GCodeFormatter {
  private settings: FormatterSettings;
  private currentLineNumber: number;
  private indentLevel: number;

  constructor(settings: Partial<FormatterSettings> = {}) {
    this.settings = { ...DEFAULT_FORMATTER_SETTINGS, ...settings };
    this.currentLineNumber = this.settings.lineNumberStart;
    this.indentLevel = DEFAULTS.MIN_INDENT_LEVEL;
  }

  public setOptions(settings: Partial<FormatterSettings>): void {
    this.settings = {
      ...DEFAULT_FORMATTER_SETTINGS,
      ...settings,
    };
  }

  /**
   * Format a parsed AST program back to G-code string
   */
  public format(program: Program): string {
    // Reset state for each format call
    this.currentLineNumber = this.settings.lineNumberStart;
    this.indentLevel = DEFAULTS.MIN_INDENT_LEVEL;

    // Group statements by line number (work with a copy to avoid mutations)
    const statementsByLine = this.groupStatementsByLine([
      ...program.getBody(),
    ]);

    const lines: string[] = [];
    if (program.getHasStartDelimiter()) {
      lines.push(GCODE_SYMBOLS.PROGRAM_DELIMITER);
    }

    let lastWasEmptyLine = false;

    for (const [lineNumber, statements] of statementsByLine) {
      // Handle empty lines based on settings
      const hasEmptyLine = statements.some(
        (s) => s instanceof EmptyLineStatement
      );
      if (hasEmptyLine) {
        // In compact mode, skip all empty lines
        if (this.settings.compactOutput) {
          continue;
        }
        // When preserving empty lines, collapse consecutive empty lines to one
        if (!lastWasEmptyLine) {
          lines.push("");
          lastWasEmptyLine = true;
        }
        continue;
      }

      lastWasEmptyLine = false;

      // Format all statements on this line together
      const formattedLine = this.formatLine(statements, lineNumber);
      if (formattedLine) {
        lines.push(formattedLine);
      }
    }

    if (program.getHasEndDelimiter()) {
      lines.push(GCODE_SYMBOLS.PROGRAM_DELIMITER);
    }

    return lines.join(GCODE_SYMBOLS.NEWLINE);
  }

  /**
   * Group statements by their line number
   */
  private groupStatementsByLine(
    statements: Statement[]
  ): Map<number, Statement[]> {
    const grouped = new Map<number, Statement[]>();

    for (const statement of statements) {
      const lineNumber = statement.getPosition().line;
      if (!grouped.has(lineNumber)) {
        grouped.set(lineNumber, []);
      }
      grouped.get(lineNumber)!.push(statement);
    }

    // Sort by line number
    return new Map(
      Array.from(grouped.entries()).sort((a, b) => a[0] - b[0])
    );
  }

  /**
   * Format all statements on a single line
   */
  private formatLine(
    statements: Statement[],
    lineNumber: number
  ): string {
    const parts: string[] = [];
    let mainStatement: Statement | null = null;
    let commentStatement: Statement | null = null;

    // Separate main statements from comments
    for (const statement of statements) {
      if (
        statement instanceof SemicolonCommentStatement ||
        statement instanceof ParenthicalCommentStatement
      ) {
        commentStatement = statement;
      } else if (!(statement instanceof LineNumberStatement)) {
        // LineNumberStatement is handled separately
        mainStatement = statement;
      }
    }

    // Adjust indent level based on main statement type (before formatting)
    if (mainStatement) {
      this.adjustIndentBefore(mainStatement);
    }

    // Add line number if enabled
    if (this.settings.addLineNumbers) {
      parts.push(
        new LineNumberStatement(
          Range.create(lineNumber, 0, lineNumber, lineNumber + 1),
          this.currentLineNumber
        ).toString()
      );
      this.currentLineNumber += this.settings.lineNumberIncrement;
    }

    // Format main statement
    if (mainStatement) {
      const indent = this.getIndent();
      const content = mainStatement.toString();
      if (content) {
        if (parts.length > 0) {
          // Line number present: add space then indent then content
          parts.push(indent + content);
        } else {
          // No line number: just indent and content
          parts.push(indent + content);
        }
      }
    }

    // Add comment if present (on the same line)
    if (commentStatement) {
      const commentContent = commentStatement.toString();
      if (commentContent) {
        parts.push(commentContent);
      }
    }

    // Adjust indent level for next statement (after formatting)
    if (mainStatement) {
      this.adjustIndentAfter(mainStatement);
    }

    return parts.join(GCODE_SYMBOLS.SPACE);
  }

  /**
   * Adjust indent level before formatting a statement
   */
  private adjustIndentBefore(statement: Statement): void {
    switch (true) {
      case statement instanceof WhileEndStatement:
      case statement instanceof EndIfStatement:
      case statement instanceof ElseStatement:
      case statement instanceof ElseIfConditional:
        this.indentLevel = Math.max(
          DEFAULTS.MIN_INDENT_LEVEL,
          this.indentLevel - 1
        );
        break;
    }
  }

  /**
   * Adjust indent level after formatting a statement
   */
  private adjustIndentAfter(statement: Statement): void {
    switch (true) {
      case statement instanceof WhileStartConditional:
      case statement instanceof IfStartConditional:
      case statement instanceof ElseStatement:
      case statement instanceof ElseIfConditional:
        this.indentLevel++;
        break;
    }
  }

  /**
   * Get the current indentation string
   */
  private getIndent(): string {
    // If indentation is disabled, return empty string
    if (!this.settings.indent) {
      return "";
    }
    const char = this.settings.useTabs
      ? GCODE_SYMBOLS.TAB
      : GCODE_SYMBOLS.SPACE.repeat(this.settings.indentSize);
    return char.repeat(this.indentLevel);
  }

  /**
   * Format a number with optional decimal point
   */
  public formatNumber(value: number): string {
    if (this.settings.prettyPrintNumbers) {
      // Always include at least one decimal place
      if (Number.isInteger(value)) {
        return `${value}.0`;
      }
      return value.toString();
    }
    return value.toString();
  }

  /**
   * Format a command code with optional padding to two digits
   */
  public formatCode(code: number): string {
    if (this.settings.prettyPrintCommands) {
      return code.toString().padStart(2, "0");
    }
    return code.toString();
  }

  /**
   * Get the current line number for formatting
   */
  public getCurrentLineNumber(): number {
    return this.currentLineNumber;
  }
}

export const gcodeFormatter = new GCodeFormatter();
