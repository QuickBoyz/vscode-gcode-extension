import { GCodeKeywords, GCodeSymbols } from '../../constants';
import { AstTraverser } from '../../parser/AstTraverser';
import { BaseAstVisitor } from '../../parser/BaseAstVisitor';
import {
  ElseClauseNode,
  IfClauseNode,
  IfStatementNode,
  ProgramNode,
  WhileStatementNode,
} from '../../parser/nodes';
import { IfClauseKind } from '../../parser/nodes';
import { BaseFormatter } from '../BaseFormatter';

/**
 * LinuxCNC-specific formatter.
 *
 * LinuxCNC control flow syntax (per official documentation at linuxcnc.org):
 * - IF [condition] ... ELSEIF [condition] ... ELSE ... ENDIF (NO THEN keyword)
 * - WHILE [condition] ... ENDWHILE (NO DO keyword)
 * - DO ... WHILE [condition] (alternative loop syntax)
 * - REPEAT [count] ... ENDREPEAT
 * - Required O-number labels (o100, o200, etc.)
 * - Named variables using <angle brackets>: #<var_name>
 *
 * Reference: https://linuxcnc.org/docs/html/gcode/o-code.html
 */
export class LinuxCNCFormatter extends BaseFormatter {
  private oBlockCounter = 100;
  private readonly oBlockIncrement = 10;
  /**
   * Stack to track current statement label (for matching opening/closing labels).
   * Pushed when starting IF/WHILE, popped when ending.
   */
  private labelStack: string[] = [];

  /**
   * Override formatGCode to scan for existing O-blocks, reset counter, and clear label stack
   */
  public formatGCode(programNode: ProgramNode, traverser: AstTraverser<void>): string {
    this.scanExistingOBlocks(programNode);
    this.labelStack = [];
    return super.formatGCode(programNode, traverser);
  }

  /**
   * Scan the AST for existing O-block labels and set counter to avoid conflicts
   */
  private scanExistingOBlocks(programNode: ProgramNode): void {
    const scanner = new OBlockScanner();
    const scanTraverser = new AstTraverser(scanner);
    scanTraverser.traverseProgram(programNode);

    const highestOBlock = scanner.getHighestOBlockNumber();
    if (highestOBlock > 0) {
      // Start from the next available O-block number (rounded to increment)
      this.oBlockCounter =
        Math.ceil((highestOBlock + 1) / this.oBlockIncrement) * this.oBlockIncrement;
    } else {
      // No existing O-blocks, start from default
      this.oBlockCounter = 100;
    }
  }

  /**
   * Override IF clause visitor to push label onto stack
   */
  visitIfClause(node: IfClauseNode): void {
    // Only push for the initial IF, not ELSEIF
    if (node.kind === IfClauseKind.IF) {
      const label = node.label ?? this.generateOBlockLabel();
      this.labelStack.push(label);
    }
    super.visitIfClause(node);
  }

  /**
   * Override IF statement end visitor to pop label from stack
   */
  visitIfStatementEnd(node: IfStatementNode): void {
    super.visitIfStatementEnd(node);
    this.labelStack.pop();
  }

  /**
   * Override WHILE statement visitor to push label onto stack
   */
  visitWhileStatement(node: WhileStatementNode): void {
    const label = node.label ?? this.generateOBlockLabel();
    this.labelStack.push(label);
    super.visitWhileStatement(node);
  }

  /**
   * Override WHILE statement end visitor to pop label from stack
   */
  visitWhileStatementEnd(node: WhileStatementNode): void {
    super.visitWhileStatementEnd(node);
    this.labelStack.pop();
  }

  /**
   * Format O-block label for LinuxCNC control structures.
   * Uses the current label from the stack (auto-generated if not provided).
   */
  protected formatLabel(label?: string): string {
    // If label is explicitly provided, use it
    if (label) {
      return `${label.toUpperCase()} `;
    }

    // Otherwise, use the current statement label from the stack
    if (this.labelStack.length > 0) {
      const currentLabel = this.labelStack[this.labelStack.length - 1];
      return `${currentLabel.toUpperCase()} `;
    }

    // Fallback (shouldn't happen in normal traversal)
    return GCodeSymbols.EMPTY_STRING;
  }

  /**
   * Generate a new O-block label
   */
  private generateOBlockLabel(): string {
    const label = `O${this.oBlockCounter}`;
    this.oBlockCounter += this.oBlockIncrement;
    return label;
  }

  protected getIfKeyword(): string {
    return GCodeKeywords.IF;
  }

  protected getElseIfKeyword(): string {
    return GCodeKeywords.ELSEIF;
  }

  protected getElseKeyword(): string {
    return GCodeKeywords.ELSE;
  }

  protected getEndIfKeyword(): string {
    return GCodeKeywords.ENDIF;
  }

  protected getThenKeyword(): string {
    // LinuxCNC does NOT use THEN keyword
    return GCodeSymbols.EMPTY_STRING;
  }

  protected getWhileKeyword(): string {
    return GCodeKeywords.WHILE;
  }

  protected getDoKeyword(): string {
    // LinuxCNC does NOT use DO keyword
    return GCodeSymbols.EMPTY_STRING;
  }

  protected getEndWhileKeyword(): string {
    // LinuxCNC uses ENDWHILE instead of END
    return 'ENDWHILE';
  }
}

/**
 * Internal visitor to scan AST for existing O-block labels
 */
class OBlockScanner extends BaseAstVisitor<void> {
  private highestOBlockNumber = 0;

  protected defaultValue(): void {
    // No-op for void visitor
  }

  visitIfClause(node: IfClauseNode): void {
    this.extractOBlockNumber(node.label);
    super.visitIfClause(node);
  }

  visitElseClause(node: ElseClauseNode): void {
    this.extractOBlockNumber(node.label);
    super.visitElseClause(node);
  }

  visitWhileStatement(node: WhileStatementNode): void {
    this.extractOBlockNumber(node.label);
    super.visitWhileStatement(node);
  }

  /**
   * Extract numeric part from O-block label (e.g., "O100" -> 100)
   */
  private extractOBlockNumber(label: string | undefined): void {
    if (!label) {
      return;
    }

    // Match O followed by digits (case-insensitive)
    const match = /^o(\d+)$/i.exec(label.trim());
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > this.highestOBlockNumber) {
        this.highestOBlockNumber = num;
      }
    }
  }

  getHighestOBlockNumber(): number {
    return this.highestOBlockNumber;
  }
}
