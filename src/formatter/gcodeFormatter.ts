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
  StatementType,
  ExpressionType,
} from "../parser/types";
import {
  Statement as StatementClass,
  OBlockStatement,
  WhileStartStatement,
  WhileEndStatement,
  IfStartStatement,
  ElseIfStatement,
  ElseStatement,
  EndIfStatement,
} from "../parser/statements";
import { FormatterOptions } from "./types";
import {
  GCODE_SYMBOLS,
  GCODE_KEYWORDS,
  DEFAULTS,
  DEFAULT_FORMATTER_OPTIONS,
} from "../constants";

class GCodeFormatter {
  private options: FormatterOptions;
  private currentLineNumber: number;
  private indentLevel: number;

  /**
   * Static formatting methods for use throughout the codebase
   */
  public static formatLineNumber(num: number): string {
    return `${GCODE_SYMBOLS.LINE_NUMBER_PREFIX}${num}`;
  }

  public static formatGCode(num: number): string {
    return `${GCODE_SYMBOLS.GCODE_PREFIX}${num}`;
  }

  public static formatMCode(num: number): string {
    return `${GCODE_SYMBOLS.MCODE_PREFIX}${num}`;
  }

  public static formatOBlock(num: number): string {
    return `${GCODE_SYMBOLS.OBLOCK_PREFIX}${num}`;
  }

  public static formatNumericVariable(num: number): string {
    return `${GCODE_SYMBOLS.VARIABLE_PREFIX}${num}`;
  }

  public static formatNamedVariable(name: string): string {
    return `${GCODE_SYMBOLS.NAMED_VAR_OPEN}${name}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`;
  }

  /**
   * Format an expression for display (without formatter options)
   * Used for hover, completion, and other UI features
   */
  public static formatExpression(expr: Expression): string {
    switch (expr.type) {
      case ExpressionType.Number:
        return expr.value.toString();

      case ExpressionType.Variable:
        if (expr.name !== undefined) {
          return GCodeFormatter.formatNamedVariable(expr.name);
        }
        return GCodeFormatter.formatNumericVariable(expr.id!);

      case ExpressionType.Binary:
        return `${GCodeFormatter.formatExpression(expr.left)} ${
          expr.operator
        } ${GCodeFormatter.formatExpression(expr.right)}`;

      case ExpressionType.Unary:
        return `${expr.operator}${GCodeFormatter.formatExpression(
          expr.operand
        )}`;

      case ExpressionType.Relational:
        return `${GCodeFormatter.formatExpression(expr.left)} ${
          expr.operator
        } ${GCodeFormatter.formatExpression(expr.right)}`;

      case ExpressionType.FuncCall:
        const args = expr.args
          .map((arg) => GCodeFormatter.formatExpression(arg))
          .join(", ");
        return `${expr.name}(${args})`;

      default:
        return GCODE_SYMBOLS.UNKNOWN_VALUE;
    }
  }

  constructor(options: Partial<FormatterOptions> = {}) {
    this.options = { ...DEFAULT_FORMATTER_OPTIONS, ...options };
    this.currentLineNumber = this.options.lineNumberStart;
    this.indentLevel = DEFAULTS.MIN_INDENT_LEVEL;
  }

  public setOptions(options: Partial<FormatterOptions>): void {
    this.options = {
      ...DEFAULT_FORMATTER_OPTIONS,
      ...options,
    };
  }

  /**
   * Format a parsed AST program back to G-code string
   */
  public format(program: Program): string {
    // Reset state for each format call
    this.currentLineNumber = this.options.lineNumberStart;
    this.indentLevel = DEFAULTS.MIN_INDENT_LEVEL;

    const lines: string[] = [];
    let lastWasEmptyLine = false;

    for (const statement of program.body) {
      // Handle empty lines based on options
      if (statement.type === StatementType.EmptyLine) {
        // In compact mode, skip all empty lines
        // When preserving empty lines, collapse consecutive empty lines to one
        if (!this.options.compactOutput && !lastWasEmptyLine) {
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

    return lines.join(GCODE_SYMBOLS.NEWLINE);
  }

  /**
   * Adjust indent level before formatting a statement
   */
  private adjustIndentBefore(statement: Statement): void {
    switch (statement.type) {
      case StatementType.WhileEnd:
      case StatementType.EndIf:
      case StatementType.Else:
      case StatementType.ElseIf:
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
    switch (statement.type) {
      case StatementType.WhileStart:
      case StatementType.IfStart:
      case StatementType.Else:
      case StatementType.ElseIf:
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
      ? GCODE_SYMBOLS.TAB
      : GCODE_SYMBOLS.SPACE.repeat(this.options.indentSize);
    return char.repeat(this.indentLevel);
  }

  /**
   * Format a single statement
   */
  private formatStatement(statement: Statement): string {
    const parts: string[] = [];

    // Add line number if enabled
    if (this.options.addLineNumbers) {
      parts.push(
        GCodeFormatter.formatLineNumber(this.currentLineNumber)
      );
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
    if (statement.type !== StatementType.Comment && statement.comment) {
      if (statement.commentStyle === "parenthetical") {
        parts.push(
          `${GCODE_SYMBOLS.PARENTHETICAL_COMMENT_OPEN}${statement.comment}${GCODE_SYMBOLS.PARENTHETICAL_COMMENT_CLOSE}`
        );
      } else {
        parts.push(
          `${GCODE_SYMBOLS.SEMICOLON_COMMENT}${statement.comment}`
        );
      }
    }

    return parts.join(GCODE_SYMBOLS.SPACE);
  }

  /**
   * Format the content of a statement (without line number or trailing comment)
   */
  private formatStatementContent<T extends Statement>(
    statement: T
  ): string {
    switch (statement.type) {
      case StatementType.GCode:
        return this.formatGCode(statement);
      case StatementType.MCode:
        return this.formatMCode(statement);
      case StatementType.Block:
        return this.formatBlock(statement);
      case StatementType.Param:
        return this.formatParamOnly(statement);
      case StatementType.Comment:
        return this.formatComment(statement);
      case StatementType.Assign:
        return this.formatAssign(statement);
      case StatementType.Goto:
        return this.formatGoto(statement);
      case StatementType.SubprogramCall:
        return this.formatSubprogramCall(statement);
      case StatementType.OBlock:
        return this.formatOBlock(statement);
      case StatementType.WhileStart:
        return this.formatWhileStart(statement);
      case StatementType.WhileEnd:
        return this.formatWhileEnd(statement);
      case StatementType.IfStart:
        return this.formatIfStart(statement);
      case StatementType.IfGoto:
        return this.formatIfGoto(statement);
      case StatementType.ElseIf:
        return this.formatElseIf(statement);
      case StatementType.Else:
        return this.formatElse(statement);
      case StatementType.EndIf:
        return this.formatEndIf(statement);
      case StatementType.ProgramDelimiter:
        return this.formatProgramDelimiter();
      case StatementType.Label:
        return GCodeFormatter.formatLineNumber(statement.lineNumber!);
      case StatementType.EmptyLine:
        return GCODE_SYMBOLS.EMPTY_STRING;
      default:
        return GCODE_SYMBOLS.EMPTY_STRING;
    }
  }

  /**
   * Format a G-code command (G0, G1, G2, etc.)
   */
  private formatGCode(stmt: GCodeStatement): string {
    const code = this.formatCommandCode(
      GCODE_SYMBOLS.GCODE_PREFIX,
      stmt.code
    );
    const params = this.formatParams(stmt.params);
    return params ? `${code}${GCODE_SYMBOLS.SPACE}${params}` : code;
  }

  /**
   * Format an M-code command (M3, M5, M30, etc.)
   */
  private formatMCode(stmt: MCodeStatement): string {
    const code = this.formatCommandCode(
      GCODE_SYMBOLS.MCODE_PREFIX,
      stmt.code
    );
    const params = this.formatParams(stmt.params);
    return params ? `${code}${GCODE_SYMBOLS.SPACE}${params}` : code;
  }

  /**
   * Format a block with multiple G/M codes
   */
  private formatBlock(stmt: BlockStatement): string {
    const codes = stmt.codes
      .map((c) =>
        this.formatCommandCode(
          c.type === "G"
            ? GCODE_SYMBOLS.GCODE_PREFIX
            : GCODE_SYMBOLS.MCODE_PREFIX,
          c.code
        )
      )
      .join(GCODE_SYMBOLS.SPACE);
    const params = this.formatParams(stmt.params);
    return params ? `${codes}${GCODE_SYMBOLS.SPACE}${params}` : codes;
  }

  /**
   * Format a command code with optional pretty-printing (G1 -> G01)
   */
  private formatCommandCode(prefix: string, code: number): string {
    if (
      this.options.prettyPrintCommands &&
      code < DEFAULTS.PRETTY_PRINT_CODE_THRESHOLD
    ) {
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

    return parts.join(GCODE_SYMBOLS.SPACE);
  }

  /**
   * Format a parameter value (number or expression)
   */
  private formatParamValue(value: ParamValue): string {
    if (typeof value === "number") {
      return this.formatNumber(value);
    }
    // Expression - wrap in brackets with no spaces
    return `${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(value)}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    }`;
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
      case ExpressionType.Number:
        return this.formatNumber(expr.value);

      case ExpressionType.Variable:
        if (expr.name !== undefined) {
          return GCodeFormatter.formatNamedVariable(expr.name);
        }
        return GCodeFormatter.formatNumericVariable(expr.id!);

      case ExpressionType.Binary:
        return `${this.formatExpression(expr.left)}${
          GCODE_SYMBOLS.SPACE
        }${expr.operator}${GCODE_SYMBOLS.SPACE}${this.formatExpression(
          expr.right
        )}`;

      case ExpressionType.Relational:
        return `${this.formatExpression(expr.left)}${
          GCODE_SYMBOLS.SPACE
        }${expr.operator}${GCODE_SYMBOLS.SPACE}${this.formatExpression(
          expr.right
        )}`;

      case ExpressionType.FuncCall:
        const args = expr.args
          .map((a) => this.formatExpression(a))
          .join(", ");
        return `${expr.name}${GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN}${args}${GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE}`;

      case ExpressionType.Unary:
        return `${expr.operator}${this.formatExpression(expr.operand)}`;

      default:
        return GCODE_SYMBOLS.EMPTY_STRING;
    }
  }

  /**
   * Format a comment-only statement
   */
  private formatComment(stmt: CommentStatement): string {
    if (stmt.style === "parenthetical") {
      return `${GCODE_SYMBOLS.PARENTHETICAL_COMMENT_OPEN}${stmt.value}${GCODE_SYMBOLS.PARENTHETICAL_COMMENT_CLOSE}`;
    }
    return `${GCODE_SYMBOLS.SEMICOLON_COMMENT}${stmt.value}`;
  }

  /**
   * Format variable assignment
   */
  private formatAssign(stmt: AssignStatement): string {
    let variable: string;
    if (typeof stmt.variable === "string") {
      // Named variable: #<name>
      variable = GCodeFormatter.formatNamedVariable(stmt.variable);
    } else if (typeof stmt.variable === "number") {
      // Numeric variable: #123
      variable = GCodeFormatter.formatNumericVariable(stmt.variable);
    } else {
      // Computed variable: #[expression]
      variable = `${
        GCODE_SYMBOLS.COMPUTED_VAR_OPEN
      }${this.formatExpression(stmt.variable)}${
        GCODE_SYMBOLS.COMPUTED_VAR_CLOSE
      }`;
    }
    return `${variable}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.ASSIGNMENT_OPERATOR
    }${GCODE_SYMBOLS.SPACE}${this.formatExpression(stmt.value)}`;
  }

  /**
   * Format GOTO statement
   */
  private formatGoto(stmt: GotoStatement): string {
    return `${GCODE_KEYWORDS.GOTO}${GCODE_SYMBOLS.SPACE}${stmt.target}`;
  }

  /**
   * Format subprogram call (M98)
   */
  private formatSubprogramCall(stmt: SubprogramCallStatement): string {
    return `${GCODE_SYMBOLS.MCODE_PREFIX}98${GCODE_SYMBOLS.SPACE}${stmt.id}`;
  }

  /**
   * Format O-block statement
   */
  private formatOBlock(stmt: OBlockStatement | Statement): string {
    const label = (stmt as StatementClass).getLabel();
    return label !== null ? GCodeFormatter.formatOBlock(label) : "";
  }

  /**
   * Format WHILE start
   */
  private formatWhileStart(
    stmt: WhileStartStatement | Statement
  ): string {
    const label = (stmt as StatementClass).getLabel();
    const condition = (stmt as WhileStartStatement).condition;
    const labelText =
      label !== null
        ? `${GCodeFormatter.formatOBlock(label)}${GCODE_SYMBOLS.SPACE}`
        : GCODE_SYMBOLS.EMPTY_STRING;
    return `${labelText}${GCODE_KEYWORDS.WHILE}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(condition)}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    }${GCODE_SYMBOLS.SPACE}${GCODE_KEYWORDS.DO}`;
  }

  /**
   * Format WHILE end
   */
  private formatWhileEnd(stmt: WhileEndStatement | Statement): string {
    const label = (stmt as StatementClass).getLabel();
    const labelText =
      label !== null
        ? `${GCodeFormatter.formatOBlock(label)}${GCODE_SYMBOLS.SPACE}`
        : GCODE_SYMBOLS.EMPTY_STRING;
    return `${labelText}${GCODE_KEYWORDS.END}`;
  }

  /**
   * Format IF start
   */
  private formatIfStart(stmt: IfStartStatement | Statement): string {
    const label = (stmt as StatementClass).getLabel();
    const condition = (stmt as IfStartStatement).condition;
    const labelText =
      label !== null
        ? `${GCodeFormatter.formatOBlock(label)}${GCODE_SYMBOLS.SPACE}`
        : GCODE_SYMBOLS.EMPTY_STRING;
    return `${labelText}${GCODE_KEYWORDS.IF}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(condition)}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    }${GCODE_SYMBOLS.SPACE}${GCODE_KEYWORDS.THEN}`;
  }

  /**
   * Format ternary IF GOTO
   */
  private formatIfGoto(stmt: {
    condition: any;
    target: number;
  }): string {
    return `${GCODE_KEYWORDS.IF}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(stmt.condition)}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    }${GCODE_SYMBOLS.SPACE}${GCODE_KEYWORDS.GOTO}${
      GCODE_SYMBOLS.SPACE
    }${stmt.target}`;
  }

  /**
   * Format ELSEIF
   */
  private formatElseIf(stmt: ElseIfStatement | Statement): string {
    const label = (stmt as StatementClass).getLabel();
    const condition = (stmt as ElseIfStatement).condition;
    const labelText =
      label !== null
        ? `${GCodeFormatter.formatOBlock(label)}${GCODE_SYMBOLS.SPACE}`
        : GCODE_SYMBOLS.EMPTY_STRING;
    return `${labelText}${GCODE_KEYWORDS.ELSEIF}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(condition)}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    }${GCODE_SYMBOLS.SPACE}${GCODE_KEYWORDS.THEN}`;
  }

  /**
   * Format ELSE
   */
  private formatElse(stmt: ElseStatement | Statement): string {
    const label = (stmt as StatementClass).getLabel();
    const labelText =
      label !== null
        ? `${GCodeFormatter.formatOBlock(label)}${GCODE_SYMBOLS.SPACE}`
        : GCODE_SYMBOLS.EMPTY_STRING;
    return `${labelText}${GCODE_KEYWORDS.ELSE}`;
  }

  /**
   * Format ENDIF
   */
  private formatEndIf(stmt: EndIfStatement | Statement): string {
    const label = (stmt as StatementClass).getLabel();
    const labelText =
      label !== null
        ? `${GCodeFormatter.formatOBlock(label)}${GCODE_SYMBOLS.SPACE}`
        : GCODE_SYMBOLS.EMPTY_STRING;
    return `${labelText}${GCODE_KEYWORDS.ENDIF}`;
  }

  /**
   * Format program delimiter (%)
   */
  private formatProgramDelimiter(): string {
    return GCODE_SYMBOLS.PROGRAM_DELIMITER;
  }
}

export const gcodeFormatter = new GCodeFormatter();
export { GCodeFormatter };
