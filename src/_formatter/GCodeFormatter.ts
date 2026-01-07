import { AstTraverser } from "../_parser/AstTraverser";
import { AstVisitor } from "../_parser/AstVisitor";
import {
  AxisParameterNode,
  BinaryExpressionNode,
  BlockStatementNode,
  CommentNode,
  ErrorNode,
  ExpressionNode,
  FunctionCallNode,
  IfStatementNode,
  LiteralExpressionNode,
  MotionCommandNode,
  ProgramNode,
  StatementNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  VariableReferenceNode,
  WhileStatementNode,
  IfClauseNode,
  ElseClauseNode,
} from "../_parser/nodes";
import {
  GCodeSymbols,
  GCodeKeywords,
  DEFAULTS,
  DEFAULT_FORMATTER_SETTINGS,
} from "../constants";
import { TokenType } from "../_parser/nodes/tokens";
import { FormatterSettings } from "../_formatter/types";

export class GCodeFormatter extends AstVisitor<void> {
  private lines: string[] = [];
  private currentIndent = 0;
  // current formatted line number
  private currentFormattedLineNumber: number;
  // last formatted line number
  private lastFormattedLineNumber: number = 0;
  // last source line number that was formatted (0-based, from original source)
  private lastSourceLineNumber: number = -1;
  private settings: FormatterSettings;

  constructor(settings: Partial<FormatterSettings> = {}) {
    super();
    this.settings = { ...DEFAULT_FORMATTER_SETTINGS, ...settings };
    this.currentFormattedLineNumber =
      this.settings.lineNumberStart ?? DEFAULTS.LINE_NUMBER_START;
  }

  public setOptions(settings: Partial<FormatterSettings>): void {
    this.settings = {
      ...DEFAULT_FORMATTER_SETTINGS,
      ...settings,
    };
  }

  formatGCode(programNode: ProgramNode, traverser: AstTraverser<void>) {
    this.lastSourceLineNumber = -1;
    traverser.traverseProgram(programNode);
    return this.getOutput();
  }

  private indentString() {
    return this.settings.indent && this.currentIndent > 0
      ? this.settings.useTabs
        ? GCodeSymbols.TAB.repeat(this.currentIndent)
        : GCodeSymbols.SPACE.repeat(
            this.currentIndent * this.settings.indentSize
          )
      : GCodeSymbols.EMPTY_STRING;
  }

  private decrementIndent() {
    this.currentIndent = Math.max(0, this.currentIndent - 1);
  }
  private incrementIndent() {
    this.currentIndent++;
  }

  private linePrefix(): string {
    return this.settings.addLineNumbers
      ? `N${this.currentFormattedLineNumber} `
      : GCodeSymbols.EMPTY_STRING;
  }

  /**
   * Determines if content from the given source line should be merged
   * with the last formatted line.
   */
  private shouldMergeWithLastLine(sourceLineNumber: number): boolean {
    return (
      this.lastFormattedLineNumber === sourceLineNumber &&
      this.lines.length > 0
    );
  }

  /**
   * Adds a new line with proper indentation and line number handling.
   */
  private addLine(line: string) {
    const isEmpty = !line.trim();

    if (this.settings.compactOutput && isEmpty) return;

    this.lines.push(
      `${this.linePrefix()}${this.indentString()}${line}`
    );

    this.lastFormattedLineNumber = this.currentFormattedLineNumber;

    if (this.settings.addLineNumbers) {
      this.currentFormattedLineNumber +=
        this.settings.lineNumberIncrement;
    }
  }

  /**
   * Merges content to the last line without re-applying indentation.
   * The last line already has proper formatting (prefix, indentation).
   */
  private mergeContentToLastLine(content: string) {
    if (this.lines.length === 0) {
      this.addLine(content);
      return;
    }

    const lastLine = this.lines.pop()!;
    // Don't append to empty lines - they should remain empty
    if (lastLine.trim() === "") {
      this.lines.push(lastLine);
      this.addLine(content);
    } else {
      this.lines.push(`${lastLine} ${content.trim()}`);
    }
  }

  /**
   * Adds content, handling source line merging separately from indentation.
   * If content should be merged with the last line (same source line),
   * it merges without re-applying indentation. Otherwise, adds a new line.
   */
  private appendToLastLine(sourceLineNumber: number, content: string) {
    if (this.shouldMergeWithLastLine(sourceLineNumber)) {
      this.mergeContentToLastLine(content);
    } else {
      this.addLine(content);
    }

    this.lastFormattedLineNumber = sourceLineNumber;
  }

  /**
   * Check for gaps in source line numbers and add empty lines if needed.
   * This preserves empty lines from the original source.
   */
  private handleLineGap(currentSourceLine: number) {
    if (this.lastSourceLineNumber === -1) {
      this.lastSourceLineNumber = currentSourceLine;
      return;
    }

    // Only process gap if this is a new line (not the same line we just processed)
    if (currentSourceLine <= this.lastSourceLineNumber) {
      return;
    }

    const gap = currentSourceLine - this.lastSourceLineNumber;
    // gap > 1 means there's at least one empty line between the statements
    // gap === 2 means exactly one empty line, gap === 3 means two empty lines, etc.
    if (gap > 1 && !this.settings.compactOutput) {
      // Always add exactly one empty line (collapses multiple empty lines to one)
      this.addLine(GCodeSymbols.EMPTY_STRING);
    }

    this.lastSourceLineNumber = currentSourceLine;
  }

  visitProgram(node: ProgramNode) {}

  visitStatement(node: StatementNode) {}

  visitBlockStatement(node: BlockStatementNode) {}

  visitExpression(node: ExpressionNode) {}

  visitLiteralExpression(node: LiteralExpressionNode) {}

  visitBinaryExpression(node: BinaryExpressionNode) {}

  visitUnaryExpression(node: UnaryExpressionNode) {}

  visitVariableReference(node: VariableReferenceNode) {}

  visitAxisParameter(node: AxisParameterNode) {
    this.handleLineGap(node.getRange().start.line);
    const value = this.formatAxisParameter(node);
    this.appendToLastLine(node.getRange().start.line, value);
  }

  visitIfClause(node: IfClauseNode) {
    this.handleLineGap(node.getRange().start.line);
    const isElseIf = node.kind === TokenType.ELSEIF;
    const keyword = isElseIf ? GCodeKeywords.ELSEIF : GCodeKeywords.IF;

    if (isElseIf) {
      this.decrementIndent();
    }
    this.addLine(
      `${this.formatLabel(
        node.label
      )}${keyword} [${this.formatExpression(node.condition)}]${
        !isElseIf ? ` ${GCodeKeywords.THEN}` : GCodeSymbols.EMPTY_STRING
      }`
    );
    this.incrementIndent();
  }

  visitElseClause(node: ElseClauseNode) {
    this.handleLineGap(node.getRange().start.line);
    this.decrementIndent();
    this.addLine(
      `${this.formatLabel(node.label)}${GCodeKeywords.ELSE}`
    );
    this.incrementIndent();
  }

  visitIfStatementEnd(node: IfStatementNode) {
    this.handleLineGap(node.getRange().end.line);
    this.decrementIndent();
    this.addLine(
      `${this.formatLabel(node.label)}${GCodeKeywords.ENDIF}`
    );
  }

  visitWhileStatementEnd(node: WhileStatementNode) {
    this.handleLineGap(node.getRange().end.line);
    this.decrementIndent();
    this.addLine(`${this.formatLabel(node.label)}${GCodeKeywords.END}`);
  }

  visitComment(node: CommentNode) {
    this.handleLineGap(node.getRange().start.line);
    this.appendToLastLine(node.getRange().start.line, node.text);
  }

  visitVariableAssignment(node: VariableAssignmentNode) {
    this.handleLineGap(node.getRange().start.line);
    const valueStr = this.formatExpression(node.value);
    this.addLine(`${this.formatVariableName(node.name)} = ${valueStr}`);
  }

  visitFunctionCall(node: FunctionCallNode) {
    const argStr = this.formatExpression(node.argument);
    return `${node.name}[${argStr}]`;
  }

  visitWhileStatement(node: WhileStatementNode) {
    this.handleLineGap(node.getRange().start.line);
    const condition = this.formatExpression(node.condition);
    this.addLine(
      `${this.formatLabel(node.label)}${
        GCodeKeywords.WHILE
      } [${condition}] ${GCodeKeywords.DO}`
    );
    this.incrementIndent();
  }

  private formatLabel(label?: string): string {
    return label
      ? `${label?.toUpperCase()} `
      : GCodeSymbols.EMPTY_STRING;
  }

  visitMotionCommand(node: MotionCommandNode) {
    this.handleLineGap(node.getRange().start.line);
    const cmd = this.formatCommand(node);
    this.appendToLastLine(node.getRange().start.line, cmd);
  }

  private formatCommand(node: MotionCommandNode): string {
    let cmd = node.command.toUpperCase();

    if (this.settings.prettyPrintCommands) {
      // G1 → G01, M3 → M03
      const letter = cmd[0];
      const number = parseFloat(cmd.slice(1));
      if (!isNaN(number)) {
        cmd = `${letter}${number.toString().padStart(2, "0")}`;
      }
    }

    return cmd;
  }
  visitError(node: ErrorNode) {
    this.handleLineGap(node.getRange().start.line);
    this.appendToLastLine(
      node.getRange().start.line,
      `(ERROR: ${node.message})`
    );
  }

  visitIfStatement(node: IfStatementNode) {}

  // --- Helpers ---

  private formatAxisParameter(node: AxisParameterNode): string {
    const axis = node.axis;
    const valueNode = node.value;

    const value = this.formatExpression(valueNode);

    // Wrap binary expressions and function calls in brackets
    const needsBrackets =
      valueNode instanceof BinaryExpressionNode ||
      valueNode instanceof FunctionCallNode ||
      (valueNode instanceof UnaryExpressionNode &&
        (valueNode.operand instanceof BinaryExpressionNode ||
          valueNode.operand instanceof FunctionCallNode));

    if (needsBrackets) {
      return `${axis}[${value}]`;
    }

    return `${axis}${value}`;
  }

  private formatVariableName(name: string | number): string {
    if (typeof name === "number") {
      return `${GCodeSymbols.VARIABLE_PREFIX}${name}`;
    }
    return `${GCodeSymbols.NAMED_VAR_OPEN}${name}${GCodeSymbols.NAMED_VAR_CLOSE}`;
  }

  private formatExpression(node: ExpressionNode): string {
    if (node instanceof LiteralExpressionNode) {
      if (
        this.settings.prettyPrintNumbers &&
        !node.value.toString().includes(".")
      ) {
        return `${node.value}.0`;
      }
      return node.value.toString();
    }

    if (node instanceof VariableReferenceNode) {
      return this.formatVariableName(node.name);
    }

    if (node instanceof UnaryExpressionNode) {
      return `${node.operator}${this.formatExpression(node.operand)}`;
    }

    if (node instanceof BinaryExpressionNode) {
      return `${this.formatExpression(node.left)} ${
        node.operator
      } ${this.formatExpression(node.right)}`;
    }

    if (node instanceof FunctionCallNode) {
      return `${node.name}[${this.formatExpression(node.argument)}]`;
    }

    return GCodeSymbols.EMPTY_STRING;
  }

  // --- Output ---
  getOutput(): string {
    if (this.lines.length === 0) {
      return GCodeSymbols.EMPTY_STRING;
    }
    if (this.settings.addProgramDelimiters) {
      if (!this.lines[0].startsWith(GCodeSymbols.PROGRAM_DELIMITER)) {
        this.lines.unshift(GCodeSymbols.PROGRAM_DELIMITER);
      }
      if (
        !this.lines[this.lines.length - 1].endsWith(
          GCodeSymbols.PROGRAM_DELIMITER
        )
      ) {
        this.lines.push(GCodeSymbols.PROGRAM_DELIMITER);
      }
    }
    return this.lines.join(GCodeSymbols.NEWLINE);
  }
}
