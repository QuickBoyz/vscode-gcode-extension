/**
 * G-code formatter that converts AST back to formatted G-code
 */
import { ParamValue, ParamBlock } from "../entities/statements";
import {
  Number as NumberExpression,
  Variable,
  Binary,
  Relational,
  FuncCall,
  Unary,
  Expression,
} from "../entities/expressions";
import {
  Block,
  Param,
  Comment,
  Assignment,
  Goto,
  SubprogramCall,
  OBlock,
  WhileStart,
  WhileEnd,
  IfStart,
  IfGoto,
  ElseIf,
  Else,
  EndIf,
  Statement,
  EmptyLine,
  ProgramDelimiter,
  LineNumber,
} from "../entities/statements";
import { CommentStyle } from "../entities/statements/types";
import { Program } from "../entities";
import { FormatterOptions } from "./types";
import {
  GCODE_SYMBOLS,
  GCODE_KEYWORDS,
  DEFAULTS,
  DEFAULT_FORMATTER_OPTIONS,
  SPECIAL_MCODES,
} from "../constants";
import { Command } from "../entities/statements/Command";

class GCodeFormatter {
  private options: FormatterOptions;
  private currentLineNumber: number;
  private indentLevel: number;

  /**
   * Static formatting methods for use throughout the codebase
   */
  public formatLineNumber(num: number): string {
    return `${GCODE_SYMBOLS.LINE_NUMBER_PREFIX}${num}`;
  }

  public formatNumericVariable(num: number): string {
    return `${GCODE_SYMBOLS.VARIABLE_PREFIX}${num}`;
  }

  public formatNamedVariable(name: string): string {
    return `${GCODE_SYMBOLS.NAMED_VAR_OPEN}${name}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`;
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

    for (const statement of program.getBody()) {
      // Handle empty lines based on options
      if (statement instanceof EmptyLine) {
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
    switch (true) {
      case statement instanceof WhileEnd:
      case statement instanceof EndIf:
      case statement instanceof Else:
      case statement instanceof ElseIf:
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
      case statement instanceof WhileStart:
      case statement instanceof IfStart:
      case statement instanceof Else:
      case statement instanceof ElseIf:
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
      parts.push(this.formatLineNumber(this.currentLineNumber));
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

    return parts.join(GCODE_SYMBOLS.SPACE);
  }

  /**
   * Format the content of a statement (without line number or trailing comment)
   */
  formatStatementContent<T extends Statement>(statement: T): string {
    switch (true) {
      case statement instanceof Command:
        return this.formatCode(statement);
      case statement instanceof Block:
        return this.formatBlock(statement);
      case statement instanceof Param:
        return this.formatParamOnly(statement);
      case statement instanceof Comment:
        return this.formatComment(statement);
      case statement instanceof Assignment:
        return this.formatAssignment(statement);
      case statement instanceof Goto:
        return this.formatGoto(statement);
      case statement instanceof SubprogramCall:
        return this.formatSubprogramCall(statement);
      case statement instanceof OBlock:
        return this.formatOBlock(statement);
      case statement instanceof WhileStart:
        return this.formatWhileStart(statement);
      case statement instanceof WhileEnd:
        return this.formatWhileEnd(statement);
      case statement instanceof IfStart:
        return this.formatIfStart(statement);
      case statement instanceof IfGoto:
        return this.formatIfGoto(statement);
      case statement instanceof ElseIf:
        return this.formatElseIf(statement);
      case statement instanceof Else:
        return this.formatElse(statement);
      case statement instanceof EndIf:
        return this.formatEndIf(statement);
      case statement instanceof ProgramDelimiter:
        return this.formatProgramDelimiter();
      case statement instanceof LineNumber:
        return this.formatLineNumber(statement.getPosition().line);
      case statement instanceof EmptyLine:
        return GCODE_SYMBOLS.EMPTY_STRING;
      default:
        return GCODE_SYMBOLS.EMPTY_STRING;
    }
  }

  /**
   * Format a G-code command (G0, G1, G2, etc.)
   */
  private formatCode(stmt: Command): string {
    const code = this.formatCommandCode(stmt);
    const params = this.formatParams(stmt.getParams());
    return params ? `${code}${GCODE_SYMBOLS.SPACE}${params}` : code;
  }

  /**
   * Format a block with multiple G/M codes
   */
  private formatBlock(stmt: Block): string {
    const codes = stmt
      .getCodes()
      .map((c) => this.formatCode(c))
      .join(GCODE_SYMBOLS.SPACE);
    const params = this.formatParams(stmt.getParams());
    return params ? `${codes}${GCODE_SYMBOLS.SPACE}${params}` : codes;
  }

  /**
   * Format a command code with optional pretty-printing (G1 -> G01)
   */
  private formatCommandCode(command: Command): string {
    const prefix = command.getCodeLetter();
    if (
      this.options.prettyPrintCommands &&
      command.getCode() < DEFAULTS.PRETTY_PRINT_CODE_THRESHOLD
    ) {
      return `${prefix}0${command.getCode()}`;
    }
    return `${prefix}${command.getCode()}`;
  }

  /**
   * Format parameter-only statement
   */
  private formatParamOnly(stmt: Param): string {
    return this.formatParams(stmt.getParams());
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
  public formatExpression(expr: Expression): string {
    switch (true) {
      case expr instanceof NumberExpression:
        return this.formatNumber(expr.getValue());

      case expr instanceof Variable:
        if (expr.getName() !== undefined) {
          return this.formatNamedVariable(expr.getName()!);
        }
        return this.formatNumericVariable(expr.getId()!);

      case expr instanceof Binary:
        return `${this.formatExpression(expr.getLeft())}${
          GCODE_SYMBOLS.SPACE
        }${expr.getOperator()}${
          GCODE_SYMBOLS.SPACE
        }${this.formatExpression(expr.getRight())}`;

      case expr instanceof Relational:
        return `${this.formatExpression(expr.getLeft())}${
          GCODE_SYMBOLS.SPACE
        }${expr.getOperator()}${
          GCODE_SYMBOLS.SPACE
        }${this.formatExpression(expr.getRight())}`;

      case expr instanceof FuncCall:
        const args = expr
          .getArgs()
          .map((a) => this.formatExpression(a))
          .join(", ");
        return `${expr.getFunctionName()}${
          GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
        }${args}${GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE}`;

      case expr instanceof Unary:
        return `${expr.getOperator()}${this.formatExpression(
          expr.getOperand()
        )}`;

      default:
        return GCODE_SYMBOLS.EMPTY_STRING;
    }
  }

  /**
   * Format a comment-only statement
   */
  private formatComment(stmt: Comment): string {
    const value = stmt.getValue();
    const style = stmt.getStyle();

    if (style === CommentStyle.Semicolon) {
      return `${GCODE_SYMBOLS.SEMICOLON_COMMENT}${value}`;
    } else {
      // Parenthetical comment
      return `${GCODE_SYMBOLS.PARENTHETICAL_COMMENT_OPEN}${value}${GCODE_SYMBOLS.PARENTHETICAL_COMMENT_CLOSE}`;
    }
  }

  /**
   * Format variable assignment
   */
  private formatAssignment(stmt: Assignment): string {
    let variable = stmt.getVariable();
    if (typeof variable === "string") {
      // Named variable: #<name>
      variable = this.formatNamedVariable(variable);
    } else if (typeof variable === "number") {
      // Numeric variable: #123
      variable = this.formatNumericVariable(variable);
    } else {
      // Computed variable: #[expression]
      variable = `${
        GCODE_SYMBOLS.COMPUTED_VAR_OPEN
      }${this.formatExpression(variable)}${
        GCODE_SYMBOLS.COMPUTED_VAR_CLOSE
      }`;
    }
    return `${variable}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.ASSIGNMENT_OPERATOR
    }${GCODE_SYMBOLS.SPACE}${this.formatExpression(stmt.getValue())}`;
  }

  /**
   * Format GOTO statement
   */
  private formatGoto(stmt: Goto): string {
    return `${GCODE_KEYWORDS.GOTO}${
      GCODE_SYMBOLS.SPACE
    }${stmt.getTarget()}`;
  }

  /**
   * Format subprogram call (M98)
   */
  private formatSubprogramCall(stmt: SubprogramCall): string {
    return `${GCODE_SYMBOLS.MCODE_PREFIX}${
      SPECIAL_MCODES.SUBPROGRAM_CALL
    }${GCODE_SYMBOLS.SPACE}${stmt.getId()}`;
  }

  /**
   * Format O-block statement
   */
  private formatOBlock(
    stmt:
      | OBlock
      | WhileStart
      | WhileEnd
      | IfStart
      | IfGoto
      | Else
      | ElseIf
      | EndIf
  ): string {
    const label = stmt.getLabel();
    return label !== null
      ? `${GCODE_SYMBOLS.OBLOCK_PREFIX}${label}`
      : "";
  }

  /**
   * Format WHILE start
   */
  private formatWhileStart(stmt: WhileStart): string {
    const label = stmt.getLabel();
    const condition = stmt.getCondition();
    const labelText =
      label !== null
        ? `${this.formatOBlock(stmt)}${GCODE_SYMBOLS.SPACE}`
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
  private formatWhileEnd(stmt: WhileEnd): string {
    const label = stmt.getLabel();
    const labelText =
      label !== null
        ? `${this.formatOBlock(stmt)}${GCODE_SYMBOLS.SPACE}`
        : GCODE_SYMBOLS.EMPTY_STRING;
    return `${labelText}${GCODE_KEYWORDS.END}`;
  }

  /**
   * Format IF start
   */
  private formatIfStart(stmt: IfStart): string {
    const label = stmt.getLabel();
    const condition = stmt.getCondition();
    const labelText =
      label !== null
        ? `${this.formatOBlock(stmt)}${GCODE_SYMBOLS.SPACE}`
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
  private formatIfGoto(stmt: IfGoto): string {
    return `${GCODE_KEYWORDS.IF}${GCODE_SYMBOLS.SPACE}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_OPEN
    }${this.formatExpression(stmt.getCondition())}${
      GCODE_SYMBOLS.EXPRESSION_BRACKET_CLOSE
    }${GCODE_SYMBOLS.SPACE}${GCODE_KEYWORDS.GOTO}${
      GCODE_SYMBOLS.SPACE
    }${stmt.getTarget()}`;
  }

  /**
   * Format ELSEIF
   */
  private formatElseIf(stmt: ElseIf): string {
    const label = stmt.getLabel();
    const condition = stmt.getCondition();
    const labelText =
      label !== null
        ? `${this.formatOBlock(stmt)}${GCODE_SYMBOLS.SPACE}`
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
  private formatElse(stmt: Else): string {
    const label = stmt.getLabel();
    const labelText =
      label !== null
        ? `${this.formatOBlock(stmt)}${GCODE_SYMBOLS.SPACE}`
        : GCODE_SYMBOLS.EMPTY_STRING;
    return `${labelText}${GCODE_KEYWORDS.ELSE}`;
  }

  /**
   * Format ENDIF
   */
  private formatEndIf(stmt: EndIf): string {
    const label = stmt.getLabel();
    const labelText =
      label !== null
        ? `${this.formatOBlock(stmt)}${GCODE_SYMBOLS.SPACE}`
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
