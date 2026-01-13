import { DEFAULT_FORMATTER_SETTINGS, DEFAULTS, GCodeKeywords, GCodeSymbols } from '../constants';
import { AstTraverser } from '../parser/AstTraverser';
import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import {
  AxisParameterNode,
  BinaryExpressionNode,
  CommentNode,
  ElseClauseNode,
  ErrorNode,
  FunctionCallNode,
  IfClauseNode,
  IfStatementNode,
  MotionCommandNode,
  ProgramNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  WhileStatementNode,
} from '../parser/nodes';
import { TokenType } from '../parser/nodes/tokens';
import { FormatterSettings } from './types';
import { ExpressionFormatter } from './ExpressionFormatter';

export class GCodeFormatter extends BaseAstVisitor<void> {
  private lines: string[] = [];
  private currentIndent = 0;
  // Current formatted line number
  private currentFormattedLineNumber: number;
  // Last formatted line number
  private lastFormattedLineNumber: number = 0;
  // Last source line number that was formatted (0-based, from original source)
  private lastSourceLineNumber: number = -1;
  private settings: FormatterSettings;
  private expressionFormatter: ExpressionFormatter;

  constructor(settings: Partial<FormatterSettings> = {}) {
    super();
    this.settings = { ...DEFAULT_FORMATTER_SETTINGS, ...settings };
    this.currentFormattedLineNumber = this.settings.lineNumberStart ?? DEFAULTS.LINE_NUMBER_START;

    // Create expression formatter with settings
    this.expressionFormatter = new ExpressionFormatter({
      prettyPrintNumbers: this.settings.prettyPrintNumbers,
      fallbackString: GCodeSymbols.EMPTY_STRING,
    });
  }

  protected defaultValue(): void {
    // No-op default
  }

  public setOptions(settings: Partial<FormatterSettings>): void {
    this.settings = {
      ...DEFAULT_FORMATTER_SETTINGS,
      ...settings,
    };

    // Update formatter options instead of recreating
    this.expressionFormatter.setOptions({
      prettyPrintNumbers: this.settings.prettyPrintNumbers,
      fallbackString: GCodeSymbols.EMPTY_STRING,
    });
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
        : GCodeSymbols.SPACE.repeat(this.currentIndent * this.settings.indentSize)
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
    return this.lastFormattedLineNumber === sourceLineNumber && this.lines.length > 0;
  }

  /**
   * Adds a new line with proper indentation and line number handling.
   */
  private addLine(line: string) {
    const isEmpty = !line.trim();

    if (this.settings.compactOutput && isEmpty) return;

    this.lines.push(`${this.linePrefix()}${this.indentString()}${line}`);

    this.lastFormattedLineNumber = this.currentFormattedLineNumber;

    if (this.settings.addLineNumbers) {
      this.currentFormattedLineNumber += this.settings.lineNumberIncrement;
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

    const lastLine = this.lines.pop();
    // Don't append to empty lines - they should remain empty
    if (lastLine?.trim() === GCodeSymbols.EMPTY_STRING) {
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
    // Gap > 1 means there's at least one empty line between the statements
    // Gap === 2 means exactly one empty line, gap === 3 means two empty lines, etc.
    if (gap > 1 && !this.settings.compactOutput) {
      // Always add exactly one empty line (collapses multiple empty lines to one)
      this.addLine(GCodeSymbols.EMPTY_STRING);
    }

    this.lastSourceLineNumber = currentSourceLine;
  }

  visitAxisParameter(node: AxisParameterNode) {
    this.handleLineGap(node.getRange().start.line);
    const value = this.formatAxisParameter(node);
    this.appendToLastLine(node.getRange().start.line, value);
  }

  visitIfClause(node: IfClauseNode) {
    this.handleLineGap(node.getRange().start.line);
    const isElseIf = node.kind === TokenType.ELSEIF,
      keyword = isElseIf ? GCodeKeywords.ELSEIF : GCodeKeywords.IF;

    if (isElseIf) {
      this.decrementIndent();
    }
    this.addLine(
      `${this.formatLabel(node.label)}${keyword} [${this.expressionFormatter.format(node.condition)}]${
        !isElseIf ? ` ${GCodeKeywords.THEN}` : GCodeSymbols.EMPTY_STRING
      }`
    );
    this.incrementIndent();
  }

  visitElseClause(node: ElseClauseNode) {
    this.handleLineGap(node.getRange().start.line);
    this.decrementIndent();
    this.addLine(`${this.formatLabel(node.label)}${GCodeKeywords.ELSE}`);
    this.incrementIndent();
  }

  visitIfStatementEnd(node: IfStatementNode) {
    this.handleLineGap(node.getRange().end.line);
    this.decrementIndent();
    this.addLine(`${this.formatLabel(node.label)}${GCodeKeywords.ENDIF}`);
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
    const valueStr = this.expressionFormatter.format(node.value);
    this.addLine(`${this.formatVariableName(node.name)} = ${valueStr}`);
  }

  visitFunctionCall(node: FunctionCallNode) {
    const argStr = this.expressionFormatter.format(node.argument);
    return `${node.name}[${argStr}]`;
  }

  visitWhileStatement(node: WhileStatementNode) {
    this.handleLineGap(node.getRange().start.line);
    const condition = this.expressionFormatter.format(node.condition);
    this.addLine(
      `${this.formatLabel(node.label)}${GCodeKeywords.WHILE} [${condition}] ${GCodeKeywords.DO}`
    );
    this.incrementIndent();
  }

  private formatLabel(label?: string): string {
    return label ? `${label?.toUpperCase()} ` : GCodeSymbols.EMPTY_STRING;
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
      const letter = cmd[0],
        number = parseFloat(cmd.slice(1));
      if (!isNaN(number)) {
        cmd = `${letter}${number.toString().padStart(2, '0')}`;
      }
    }

    return cmd;
  }
  visitError(node: ErrorNode) {
    this.handleLineGap(node.getRange().start.line);
    this.appendToLastLine(node.getRange().start.line, `(ERROR: ${node.message})`);
  }

  // --- Helpers ---

  private formatAxisParameter(node: AxisParameterNode): string {
    const { axis } = node,
      valueNode = node.value,
      value = this.expressionFormatter.format(valueNode),
      // Wrap binary expressions and function calls in brackets
      needsBrackets =
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

  /**
   * Format variable name with appropriate prefix/wrapper.
   * Note: This is intentionally duplicated from RenameUtils.formatVariableName.
   * The GCodeFormatter operates at a lower level (AST visitor) and should not
   * depend on provider-layer utilities. This maintains clean layer separation
   * and keeps the formatter self-contained.
   */
  private formatVariableName(name: string | number): string {
    if (typeof name === 'number') {
      return `${GCodeSymbols.VARIABLE_PREFIX}${name}`;
    }
    return `${GCodeSymbols.NAMED_VAR_OPEN}${name}${GCodeSymbols.NAMED_VAR_CLOSE}`;
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
      if (!this.lines[this.lines.length - 1].endsWith(GCodeSymbols.PROGRAM_DELIMITER)) {
        this.lines.push(GCodeSymbols.PROGRAM_DELIMITER);
      }
    }
    return this.lines.join(GCodeSymbols.NEWLINE);
  }
}
