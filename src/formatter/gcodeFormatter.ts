/**
 * G-code formatter that converts AST back to formatted G-code
 */
import {
  Program,
  Statement,
  Expression,
  ParamValue,
  ParamBlock,
  GCodeStatement,
  MCodeStatement,
  BlockStatement,
  ParamStatement,
  CommentStatement,
  AssignStatement,
  GotoStatement,
  SubprogramCallStatement,
  OBlockStatement,
  WhileStartStatement,
  WhileEndStatement,
  IfStartStatement,
  ElseIfStatement,
  ElseStatement,
  EndIfStatement,
} from "../types/ast";
import { FormatterOptions, defaultFormatterOptions } from "./types";

export class GCodeFormatter {
  private options: FormatterOptions;
  private currentLineNumber: number;
  private indentLevel: number;

  constructor(options: Partial<FormatterOptions> = {}) {
    this.options = { ...defaultFormatterOptions, ...options };
    this.currentLineNumber = this.options.lineNumberStart;
    this.indentLevel = 0;
  }

  /**
   * Format a parsed AST program back to G-code string
   */
  public format(program: Program): string {
    // Reset state for each format call
    this.currentLineNumber = this.options.lineNumberStart;
    this.indentLevel = 0;

    const lines: string[] = [];
    let lastWasEmptyLine = false;

    for (const statement of program.body) {
      // Handle empty lines based on options
      if (statement.type === "EmptyLine") {
        // In compact mode, skip all empty lines
        if (this.options.compactOutput) {
          continue;
        }
        // When preserving empty lines, collapse consecutive empty lines to one
        if (this.options.preserveEmptyLines && !lastWasEmptyLine) {
          lines.push("");
          lastWasEmptyLine = true;
        }
        continue;
      }

      lastWasEmptyLine = false;

      // Adjust indent level based on statement type (before formatting)
      this.adjustIndentBefore(statement);

      const line = this.formatStatement(statement);
      lines.push(line);

      // Adjust indent level for next statement (after formatting)
      this.adjustIndentAfter(statement);
    }

    return lines.join("\n");
  }

  /**
   * Adjust indent level before formatting a statement
   */
  private adjustIndentBefore(statement: Statement): void {
    switch (statement.type) {
      case "WhileEnd":
      case "EndIf":
      case "Else":
      case "ElseIf":
        this.indentLevel = Math.max(0, this.indentLevel - 1);
        break;
    }
  }

  /**
   * Adjust indent level after formatting a statement
   */
  private adjustIndentAfter(statement: Statement): void {
    switch (statement.type) {
      case "WhileStart":
      case "IfStart":
      case "Else":
      case "ElseIf":
        this.indentLevel++;
        break;
    }
  }

  /**
   * Get the current indentation string
   */
  private getIndent(): string {
    // If indentation is disabled, return empty string
    if (!this.options.indent) {
      return "";
    }
    const char = this.options.useTabs
      ? "\t"
      : " ".repeat(this.options.indentSize);
    return char.repeat(this.indentLevel);
  }

  /**
   * Format a single statement
   */
  private formatStatement(statement: Statement): string {
    const parts: string[] = [];

    // Add line number if enabled
    if (this.options.addLineNumbers) {
      parts.push(`N${this.currentLineNumber}`);
      this.currentLineNumber += this.options.lineNumberIncrement;
    }

    // Add indentation (only to the content, not the line number)
    const indent = this.getIndent();

    // Format the statement content
    const content = this.formatStatementContent(statement);
    if (content) {
      if (parts.length > 0) {
        // Line number present: add space then indent then content
        parts.push(indent + content);
      } else {
        // No line number: just indent and content
        parts.push(indent + content);
      }
    }

    // Add comment if present and not a comment-only statement
    if (statement.type !== "Comment" && statement.comment) {
      if (statement.commentStyle === "parenthetical") {
        parts.push(`(${statement.comment})`);
      } else {
        parts.push(`;${statement.comment}`);
      }
    }

    return parts.join(" ");
  }

  /**
   * Format the content of a statement (without line number or trailing comment)
   */
  private formatStatementContent(statement: Statement): string {
    switch (statement.type) {
      case "GCode":
        return this.formatGCode(statement);
      case "MCode":
        return this.formatMCode(statement);
      case "Block":
        return this.formatBlock(statement);
      case "Param":
        return this.formatParamOnly(statement);
      case "Comment":
        return this.formatComment(statement);
      case "Assign":
        return this.formatAssign(statement);
      case "Goto":
        return this.formatGoto(statement);
      case "SubprogramCall":
        return this.formatSubprogramCall(statement);
      case "OBlock":
        return this.formatOBlock(statement);
      case "WhileStart":
        return this.formatWhileStart(statement);
      case "WhileEnd":
        return this.formatWhileEnd(statement);
      case "IfStart":
        return this.formatIfStart(statement);
      case "IfGoto":
        return this.formatIfGoto(statement);
      case "ElseIf":
        return this.formatElseIf(statement);
      case "Else":
        return this.formatElse(statement);
      case "EndIf":
        return this.formatEndIf(statement);
      case "ProgramDelimiter":
        return this.formatProgramDelimiter();
      case "Label":
        return `N${statement.lineNumber}`;
      case "EmptyLine":
        return "";
      default:
        return "";
    }
  }

  /**
   * Format a G-code command (G0, G1, G2, etc.)
   */
  private formatGCode(stmt: GCodeStatement): string {
    const code = this.formatCommandCode("G", stmt.code);
    const params = this.formatParams(stmt.params);
    return params ? `${code} ${params}` : code;
  }

  /**
   * Format an M-code command (M3, M5, M30, etc.)
   */
  private formatMCode(stmt: MCodeStatement): string {
    const code = this.formatCommandCode("M", stmt.code);
    const params = this.formatParams(stmt.params);
    return params ? `${code} ${params}` : code;
  }

  /**
   * Format a block with multiple G/M codes
   */
  private formatBlock(stmt: BlockStatement): string {
    const codes = stmt.codes
      .map((c) => this.formatCommandCode(c.type, c.code))
      .join(" ");
    const params = this.formatParams(stmt.params);
    return params ? `${codes} ${params}` : codes;
  }

  /**
   * Format a command code with optional pretty-printing (G1 -> G01)
   */
  private formatCommandCode(prefix: string, code: number): string {
    if (this.options.prettyPrintCommands && code < 10) {
      return `${prefix}0${code}`;
    }
    return `${prefix}${code}`;
  }

  /**
   * Format parameter-only statement
   */
  private formatParamOnly(stmt: ParamStatement): string {
    return this.formatParams(stmt.params);
  }

  /**
   * Format a parameter block
   */
  private formatParams(params: ParamBlock): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      parts.push(`${key}${this.formatParamValue(value)}`);
    }

    return parts.join(" ");
  }

  /**
   * Format a parameter value (number or expression)
   */
  private formatParamValue(value: ParamValue): string {
    if (typeof value === "number") {
      return this.formatNumber(value);
    }
    // Expression - wrap in brackets with no spaces
    return `[${this.formatExpression(value)}]`;
  }

  /**
   * Format a number with optional decimal point
   */
  private formatNumber(value: number): string {
    if (this.options.prettyPrintNumbers) {
      // Always include at least one decimal place
      if (Number.isInteger(value)) {
        return `${value}.0`;
      }
      return value.toString();
    }
    return value.toString();
  }

  /**
   * Format an expression
   */
  private formatExpression(expr: Expression): string {
    switch (expr.type) {
      case "Number":
        return this.formatNumber(expr.value);

      case "Variable":
        if (expr.name !== undefined) {
          return `#<${expr.name}>`;
        }
        return `#${expr.id}`;

      case "Binary":
        return `${this.formatExpression(expr.left)} ${
          expr.operator
        } ${this.formatExpression(expr.right)}`;

      case "Relational":
        return `${this.formatExpression(expr.left)} ${
          expr.operator
        } ${this.formatExpression(expr.right)}`;

      case "FuncCall":
        const args = expr.args
          .map((a) => this.formatExpression(a))
          .join(", ");
        return `${expr.name}[${args}]`;

      case "Unary":
        return `-${this.formatExpression(expr.operand)}`;

      default:
        return "";
    }
  }

  /**
   * Format a comment-only statement
   */
  private formatComment(stmt: CommentStatement): string {
    if (stmt.style === "parenthetical") {
      return `(${stmt.value})`;
    }
    return `;${stmt.value}`;
  }

  /**
   * Format variable assignment
   */
  private formatAssign(stmt: AssignStatement): string {
    let variable: string;
    if (typeof stmt.variable === "string") {
      // Named variable: #<name>
      variable = `#<${stmt.variable}>`;
    } else if (typeof stmt.variable === "number") {
      // Numeric variable: #123
      variable = `#${stmt.variable}`;
    } else {
      // Computed variable: #[expression]
      variable = `#[${this.formatExpression(stmt.variable)}]`;
    }
    return `${variable} = ${this.formatExpression(stmt.value)}`;
  }

  /**
   * Format GOTO statement
   */
  private formatGoto(stmt: GotoStatement): string {
    return `GOTO ${stmt.target}`;
  }

  /**
   * Format subprogram call (M98)
   */
  private formatSubprogramCall(stmt: SubprogramCallStatement): string {
    return `M98 ${stmt.id}`;
  }

  /**
   * Format O-block statement
   */
  private formatOBlock(stmt: OBlockStatement): string {
    return `O${stmt.id}`;
  }

  /**
   * Format WHILE start
   */
  private formatWhileStart(stmt: WhileStartStatement): string {
    const label = stmt.label !== null ? `O${stmt.label} ` : "";
    return `${label}WHILE [${this.formatExpression(
      stmt.condition
    )}] DO`;
  }

  /**
   * Format WHILE end
   */
  private formatWhileEnd(stmt: WhileEndStatement): string {
    const label = stmt.label !== null ? `O${stmt.label} ` : "";
    return `${label}END`;
  }

  /**
   * Format IF start
   */
  private formatIfStart(stmt: IfStartStatement): string {
    const label = stmt.label !== null ? `O${stmt.label} ` : "";
    return `${label}IF [${this.formatExpression(stmt.condition)}] THEN`;
  }

  /**
   * Format ternary IF GOTO
   */
  private formatIfGoto(stmt: {
    condition: any;
    target: number;
  }): string {
    return `IF [${this.formatExpression(stmt.condition)}] GOTO ${
      stmt.target
    }`;
  }

  /**
   * Format ELSEIF
   */
  private formatElseIf(stmt: ElseIfStatement): string {
    const label = stmt.label !== null ? `O${stmt.label} ` : "";
    return `${label}ELSEIF [${this.formatExpression(
      stmt.condition
    )}] THEN`;
  }

  /**
   * Format ELSE
   */
  private formatElse(stmt: ElseStatement): string {
    const label = stmt.label !== null ? `O${stmt.label} ` : "";
    return `${label}ELSE`;
  }

  /**
   * Format ENDIF
   */
  private formatEndIf(stmt: EndIfStatement): string {
    const label = stmt.label !== null ? `O${stmt.label} ` : "";
    return `${label}ENDIF`;
  }

  /**
   * Format program delimiter (%)
   */
  private formatProgramDelimiter(): string {
    return "%";
  }
}
