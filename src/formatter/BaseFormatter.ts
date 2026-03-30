import { DEFAULTS, GCodeSymbols } from '../constants';
import { DEFAULT_GCODE_CONFIG } from '../config/defaults';
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
  LineNumberNode,
  MotionCommandNode,
  ProgramNode,
  ReturnStatementNode,
  SubroutineCallNode,
  SubroutineDefinitionNode,
  SubroutineLabelNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  WhileStatementNode,
} from '../parser/nodes';
import { IfClauseKind } from '../parser/nodes';
import { ExpressionFormatter } from './ExpressionFormatter';
import { normalizeCommand } from '../utils/GCodeNormalizer';
import { FormatterConfig, FormatterInterface } from './types';

/**
 * Base formatter implementation with common formatting logic.
 * Dialect-specific formatters extend this class and override keyword formatting methods.
 *
 * This class handles:
 * - Line management (indentation, line numbers, merging)
 * - Expression formatting
 * - Motion commands and parameters
 * - Comments and errors
 *
 * Subclasses override:
 * - Control flow keyword formatting (IF/WHILE/END/etc.)
 * - Label formatting
 */
export abstract class BaseFormatter extends BaseAstVisitor<void> implements FormatterInterface {
  protected lines: string[] = [];
  protected currentIndent = 0;
  protected currentFormattedLineNumber: number;
  protected lastFormattedLineNumber: number = 0;
  protected lastSourceLineNumber: number = -1;
  protected settings: FormatterConfig;
  protected expressionFormatter: ExpressionFormatter;

  constructor(settings: Partial<FormatterConfig> = {}) {
    super();
    this.settings = { ...DEFAULT_GCODE_CONFIG.formatter, ...settings };
    this.currentFormattedLineNumber = this.settings.lineNumberStart ?? DEFAULTS.LINE_NUMBER_START;

    this.expressionFormatter = new ExpressionFormatter({
      prettyPrintNumbers: this.settings.prettyPrintNumbers,
      fallbackString: GCodeSymbols.EMPTY_STRING,
    });
  }

  protected defaultValue(): void {
    // No-op default
  }

  public setOptions(settings: Partial<FormatterConfig>): void {
    this.settings = {
      ...DEFAULT_GCODE_CONFIG.formatter,
      ...settings,
    };

    this.expressionFormatter.setOptions({
      prettyPrintNumbers: this.settings.prettyPrintNumbers,
      fallbackString: GCodeSymbols.EMPTY_STRING,
    });
  }

  public formatGCode(programNode: ProgramNode, traverser: AstTraverser<void>): string {
    this.lastSourceLineNumber = -1;
    traverser.traverseProgram(programNode);
    return this.getOutput();
  }

  // --- Protected helper methods ---

  protected indentString(): string {
    return this.settings.indent && this.currentIndent > 0
      ? this.settings.useTabs
        ? GCodeSymbols.TAB.repeat(this.currentIndent)
        : GCodeSymbols.SPACE.repeat(this.currentIndent * this.settings.indentSize)
      : GCodeSymbols.EMPTY_STRING;
  }

  protected decrementIndent(): void {
    this.currentIndent = Math.max(0, this.currentIndent - 1);
  }

  protected incrementIndent(): void {
    this.currentIndent++;
  }

  protected linePrefix(): string {
    return this.settings.addLineNumbers
      ? `N${this.currentFormattedLineNumber} `
      : GCodeSymbols.EMPTY_STRING;
  }

  protected shouldMergeWithLastLine(sourceLineNumber: number): boolean {
    return this.lastFormattedLineNumber === sourceLineNumber && this.lines.length > 0;
  }

  protected addLine(line: string): void {
    const isEmpty = !line.trim();

    if (this.settings.compactOutput && isEmpty) return;

    this.lines.push(`${this.linePrefix()}${this.indentString()}${line}`);

    this.lastFormattedLineNumber = this.currentFormattedLineNumber;

    if (this.settings.addLineNumbers) {
      this.currentFormattedLineNumber += this.settings.lineNumberIncrement;
    }
  }

  protected mergeContentToLastLine(content: string): void {
    if (this.lines.length === 0) {
      this.addLine(content);
      return;
    }

    const lastLine = this.lines.pop();
    if (lastLine?.trim() === GCodeSymbols.EMPTY_STRING) {
      this.lines.push(lastLine);
      this.addLine(content);
    } else {
      this.lines.push(`${lastLine} ${content.trim()}`);
    }
  }

  protected appendToLastLine(sourceLineNumber: number, content: string): void {
    if (this.shouldMergeWithLastLine(sourceLineNumber)) {
      this.mergeContentToLastLine(content);
    } else {
      this.addLine(content);
    }

    this.lastFormattedLineNumber = sourceLineNumber;
  }

  protected handleLineGap(currentSourceLine: number): void {
    if (this.lastSourceLineNumber === -1) {
      this.lastSourceLineNumber = currentSourceLine;
      return;
    }

    const gap = currentSourceLine - this.lastSourceLineNumber;
    if (gap > 1 && !this.settings.compactOutput) {
      // Preserve at most one empty line (collapse multiple empty lines)
      this.addLine(GCodeSymbols.EMPTY_STRING);
    }

    this.lastSourceLineNumber = currentSourceLine;
  }

  protected formatAxisParameter(node: AxisParameterNode): string {
    const { axis } = node,
      valueNode = node.value,
      value = this.expressionFormatter.format(valueNode),
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

  protected formatVariableName(name: string | number): string {
    if (typeof name === 'number') {
      return `${GCodeSymbols.VARIABLE_PREFIX}${name}`;
    }
    return `${GCodeSymbols.NAMED_VAR_OPEN}${name}${GCodeSymbols.NAMED_VAR_CLOSE}`;
  }

  protected formatCommand(node: MotionCommandNode): string {
    if (this.settings.prettyPrintCommands) {
      return normalizeCommand(node.command);
    }
    return node.command.toUpperCase();
  }

  // --- Abstract methods for dialect-specific formatting ---

  /**
   * Format label for control structure.
   * Override in subclasses for dialect-specific label formatting.
   */
  protected abstract formatLabel(label?: string): string;

  /**
   * Get control flow keyword for dialect.
   * Override in subclasses for dialect-specific keywords.
   */
  protected abstract getIfKeyword(): string;
  protected abstract getElseIfKeyword(): string;
  protected abstract getElseKeyword(): string;
  protected abstract getEndIfKeyword(): string;
  protected abstract getThenKeyword(): string;
  protected abstract getWhileKeyword(): string;
  protected abstract getDoKeyword(): string;
  protected abstract getEndWhileKeyword(): string;

  // --- Visitor methods (common across dialects) ---

  visitAxisParameter(node: AxisParameterNode): void {
    this.handleLineGap(node.getRange().start.line);
    const value = this.formatAxisParameter(node);
    this.appendToLastLine(node.getRange().start.line, value);
  }

  visitComment(node: CommentNode): void {
    this.handleLineGap(node.getRange().start.line);
    this.appendToLastLine(node.getRange().start.line, node.text);
  }

  visitVariableAssignment(node: VariableAssignmentNode): void {
    this.handleLineGap(node.getRange().start.line);
    const valueStr = this.expressionFormatter.format(node.value);
    this.addLine(`${this.formatVariableName(node.name)} = ${valueStr}`);
  }

  visitFunctionCall(node: FunctionCallNode): string {
    const argStr = this.expressionFormatter.format(node.argument);
    return `${node.name}[${argStr}]`;
  }

  visitMotionCommand(node: MotionCommandNode): void {
    this.handleLineGap(node.getRange().start.line);
    const cmd = this.formatCommand(node);
    this.appendToLastLine(node.getRange().start.line, cmd);
  }

  visitError(node: ErrorNode): void {
    this.handleLineGap(node.getRange().start.line);
    // Output only the error annotation, not the problematic text
    // This prevents cascading errors on subsequent formats where the broken code would be re-parsed
    this.appendToLastLine(node.getRange().start.line, `(ERROR: ${node.message})`);
  }

  visitLineNumber(node: LineNumberNode): void {
    this.handleLineGap(node.getRange().start.line);
    this.appendToLastLine(node.getRange().start.line, node.lineNumber.toUpperCase());
  }

  visitSubroutineLabel(node: SubroutineLabelNode): void {
    this.handleLineGap(node.getRange().start.line);
    const formattedLabel = this.formatLabel(node.label).trim();
    this.addLine(formattedLabel);
  }

  // --- Control flow visitors (use abstract keyword methods) ---

  visitIfClause(node: IfClauseNode): void {
    this.handleLineGap(node.getRange().start.line);
    const isElseIf = node.kind === IfClauseKind.ELSEIF,
      keyword = isElseIf ? this.getElseIfKeyword() : this.getIfKeyword();

    if (isElseIf) {
      this.decrementIndent();
    }

    const thenKeyword = this.getThenKeyword();
    const conditionStr = `${this.formatLabel(node.label)}${keyword} [${this.expressionFormatter.format(node.condition)}]`;

    this.addLine(!isElseIf && thenKeyword ? `${conditionStr} ${thenKeyword}` : conditionStr);
    this.incrementIndent();
  }

  visitElseClause(node: ElseClauseNode): void {
    this.handleLineGap(node.getRange().start.line);
    this.decrementIndent();
    this.addLine(`${this.formatLabel(node.label)}${this.getElseKeyword()}`);
    this.incrementIndent();
  }

  visitIfStatementEnd(node: IfStatementNode): void {
    this.handleLineGap(node.getRange().end.line);
    this.decrementIndent();
    this.addLine(`${this.formatLabel(node.label)}${this.getEndIfKeyword()}`);
  }

  visitWhileStatement(node: WhileStatementNode): void {
    this.handleLineGap(node.getRange().start.line);
    const condition = this.expressionFormatter.format(node.condition);
    const doKeyword = this.getDoKeyword();
    const statementStr = `${this.formatLabel(node.label)}${this.getWhileKeyword()} [${condition}]`;

    this.addLine(doKeyword ? `${statementStr} ${doKeyword}` : statementStr);
    this.incrementIndent();
  }

  visitWhileStatementEnd(node: WhileStatementNode): void {
    this.handleLineGap(node.getRange().end.line);
    this.decrementIndent();
    this.addLine(`${this.formatLabel(node.label)}${this.getEndWhileKeyword()}`);
  }

  // TODO: --- Subroutine visitors (stubs for PR 3 dialect-specific formatting) ---

  visitSubroutineDefinition(_node: SubroutineDefinitionNode): void {
    // TODO: No-op: dialect-specific formatting to be added in PR 3
  }

  visitSubroutineDefinitionEnd(_node: SubroutineDefinitionNode): void {
    // TODO: No-op: dialect-specific formatting to be added in PR 3
  }

  visitSubroutineCall(_node: SubroutineCallNode): void {
    // TODO: No-op: dialect-specific formatting to be added in PR 3
  }

  visitReturnStatement(_node: ReturnStatementNode): void {
    // TODO: No-op: dialect-specific formatting to be added in PR 3
  }

  // --- Output ---

  protected getOutput(): string {
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
