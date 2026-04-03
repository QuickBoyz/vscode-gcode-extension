/**
 * Incremental Parsing Service
 *
 * Re-parses only the changed region of a G-code document and splices
 * the result into the existing AST, avoiding a full re-tokenize + re-parse.
 *
 * Strategy: line-level invalidation with statement splicing.
 *
 * 1. Map the edit's line range to the affected top-level statement indices.
 * 2. Re-tokenize + re-parse only the affected text region.
 * 3. Splice new statements into the old AST.
 * 4. Shift positions of all subsequent (unaffected) statements via visitor.
 * 5. Fall back to full re-parse when block structure changes.
 */
import { DialectType } from '../constants';
import { BLOCK_STRUCTURE_KEYWORDS } from '../lexer/constants';
import { LexerFactory } from '../lexer/LexerFactory';
import { AstTraverser } from './AstTraverser';
import { BaseAstVisitor } from './BaseAstVisitor';
import {
  AstNode,
  AxisParameterNode,
  BinaryExpressionNode,
  CommentNode,
  ElseClauseNode,
  ErrorNode,
  ExpressionNode,
  FunctionCallNode,
  IfClauseNode,
  IfStatementNode,
  LineNumberNode,
  LiteralExpressionNode,
  MotionCommandNode,
  ProgramNode,
  Range,
  ReturnStatementNode,
  StatementNode,
  SubroutineCallNode,
  SubroutineDefinitionNode,
  SubroutineLabelNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  VariableReferenceNode,
  WhileStatementNode,
} from './nodes';
import { ParserFactory } from './ParserFactory';

/**
 * Describes a single content change event from the LSP.
 * All positions are 0-based (LSP convention).
 */
export interface ContentChange {
  /** 0-based start line of the replaced range */
  readonly startLine: number;
  /** 0-based start character */
  readonly startCharacter: number;
  /** 0-based end line of the replaced range */
  readonly endLine: number;
  /** 0-based end character */
  readonly endCharacter: number;
  /** Net change in line count (positive = lines added, negative = removed) */
  readonly lineDelta: number;
}

/**
 * Result of an incremental parse attempt.
 */
export interface IncrementalParseResult {
  /** Whether incremental parsing succeeded */
  readonly success: boolean;
  /** New AST if successful */
  readonly ast?: ProgramNode;
}

/**
 * Regex that matches any block-structure keyword as a whole word (case-insensitive).
 * Used for fast detection of structural changes in the edited text.
 */
const BLOCK_KEYWORD_PATTERN = new RegExp(`\\b(${[...BLOCK_STRUCTURE_KEYWORDS].join('|')})\\b`, 'i');

/**
 * Visitor that shifts the range of every visited node by a line delta.
 * Used after incremental parsing to fix positions of statements that
 * follow the edited region.
 */
class PositionShiftVisitor extends BaseAstVisitor<void> {
  constructor(private lineDelta: number) {
    super();
  }

  protected defaultValue(): void {
    return;
  }

  private shiftNode(node: AstNode): void {
    const range = node.getRange();
    node.setRange(
      Range.create(
        range.start.line + this.lineDelta,
        range.start.character,
        range.end.line + this.lineDelta,
        range.end.character
      )
    );
  }

  visitProgram(_node: ProgramNode): void {
    // ProgramNode does not extend AstNode and has no range to shift.
    // Its child statements are visited individually by the traverser.
  }

  visitVariableAssignment(node: VariableAssignmentNode): void {
    this.shiftNode(node);
  }

  visitFunctionCall(node: FunctionCallNode): void {
    this.shiftNode(node);
  }

  visitWhileStatement(node: WhileStatementNode): void {
    this.shiftNode(node);
  }

  visitIfStatement(node: IfStatementNode): void {
    this.shiftNode(node);
  }

  visitIfClause(node: IfClauseNode): void {
    this.shiftNode(node);
  }

  visitElseClause(node: ElseClauseNode): void {
    this.shiftNode(node);
  }

  visitExpression(node: ExpressionNode): void {
    this.shiftNode(node);
  }

  visitVariableReference(node: VariableReferenceNode): void {
    this.shiftNode(node);
  }

  visitBinaryExpression(node: BinaryExpressionNode): void {
    this.shiftNode(node);
  }

  visitUnaryExpression(node: UnaryExpressionNode): void {
    this.shiftNode(node);
  }

  visitLiteralExpression(node: LiteralExpressionNode): void {
    this.shiftNode(node);
  }

  visitAxisParameter(node: AxisParameterNode): void {
    this.shiftNode(node);
  }

  visitMotionCommand(node: MotionCommandNode): void {
    this.shiftNode(node);
  }

  visitComment(node: CommentNode): void {
    this.shiftNode(node);
  }

  visitError(node: ErrorNode): void {
    this.shiftNode(node);
  }

  visitLineNumber(node: LineNumberNode): void {
    this.shiftNode(node);
  }

  visitSubroutineLabel(node: SubroutineLabelNode): void {
    this.shiftNode(node);
  }

  visitSubroutineDefinition(node: SubroutineDefinitionNode): void {
    this.shiftNode(node);
  }

  visitSubroutineCall(node: SubroutineCallNode): void {
    this.shiftNode(node);
  }

  visitReturnStatement(node: ReturnStatementNode): void {
    this.shiftNode(node);
  }

  visitStatement(node: StatementNode): void {
    this.shiftNode(node);
  }
}

export class IncrementalParsingService {
  /**
   * Attempt to incrementally re-parse the document after a content change.
   *
   * @param oldAst     - Previous AST
   * @param newText    - Full document text after the change
   * @param oldText    - Full document text before the change
   * @param change     - Description of what changed
   * @param dialect    - G-code dialect
   * @returns Result with success=true and new AST, or success=false for fallback
   */
  tryIncrementalParse(
    oldAst: ProgramNode,
    newText: string,
    oldText: string,
    change: ContentChange,
    dialect: DialectType
  ): IncrementalParseResult {
    const statements = oldAst.statements;

    // No statements in old AST — full parse is cheap anyway
    if (statements.length === 0) {
      return { success: false };
    }

    // Check if the changed text introduces or removes block structure keywords.
    // Compare the old and new text in the edit region for structural changes.
    if (this.hasBlockStructureChange(oldText, newText, change)) {
      return { success: false };
    }

    // Find the range of top-level statements affected by the edit
    const { firstIndex, lastIndex } = this.findAffectedStatementRange(statements, change);

    // Determine the text region to re-parse
    const regionStart = statements[firstIndex].getRange().start.line;
    const regionEnd = this.getRegionEndLine(statements, lastIndex, change.lineDelta, newText);

    // Extract the region text from the new document
    const lines = newText.split(/\n/);
    const regionLines = lines.slice(regionStart, regionEnd + 1);
    const regionText = regionLines.join('\n');

    // Tokenize the region with correct line offsets (scanner uses 1-based lines)
    const lexer = LexerFactory.create(dialect);
    const regionByteOffset = this.computeByteOffset(newText, regionStart);
    const tokens = lexer.tokenize(regionText, {
      startLine: regionStart + 1, // Convert 0-based to 1-based
      startCol: 1,
      startOffset: regionByteOffset,
    });

    // Parse the region
    const parser = ParserFactory.create(dialect, tokens, regionText);
    const regionAst = parser.parseProgram();
    const newStatements = regionAst.statements;

    // Splice: replace old statements with new ones
    const before = statements.slice(0, firstIndex);
    const after = statements.slice(lastIndex + 1);

    // Shift positions of all nodes in statements after the edit region
    if (change.lineDelta !== 0) {
      const shiftVisitor = new PositionShiftVisitor(change.lineDelta);
      for (const stmt of after) {
        const traverser = new AstTraverser(shiftVisitor);
        traverser.traverseProgram(new ProgramNode([stmt], false, false));
      }
    }

    // Build new ProgramNode
    const allStatements = [...before, ...newStatements, ...after];
    const ast = new ProgramNode(allStatements, oldAst.hasStartDelimiter, oldAst.hasEndDelimiter);

    return { success: true, ast };
  }

  /**
   * Check if the edit introduces or removes block-structure keywords.
   *
   * Falls back to full re-parse if block keywords differ between the old
   * and new edit regions, since the block nesting may have changed.
   */
  private hasBlockStructureChange(
    oldText: string,
    newText: string,
    change: ContentChange
  ): boolean {
    // Extract the old text in the changed region
    const oldLines = oldText.split(/\n/);
    const oldRegion = oldLines.slice(change.startLine, change.endLine + 1).join('\n');

    // Extract the new text in the changed region
    const newLines = newText.split(/\n/);
    const newEndLine = change.endLine + change.lineDelta;
    const newRegion = newLines.slice(change.startLine, newEndLine + 1).join('\n');

    // Extract all block keywords from each region and compare
    const oldKeywords = this.extractBlockKeywords(oldRegion);
    const newKeywords = this.extractBlockKeywords(newRegion);

    // If the set of block keywords changed at all, structure may have changed
    if (oldKeywords.length !== newKeywords.length) return true;
    for (let i = 0; i < oldKeywords.length; i++) {
      if (oldKeywords[i] !== newKeywords[i]) return true;
    }
    return false;
  }

  /**
   * Extract all block-structure keywords from a text region, in order.
   */
  private extractBlockKeywords(text: string): string[] {
    const keywords: string[] = [];
    const globalPattern = new RegExp(BLOCK_KEYWORD_PATTERN.source, 'gi');
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(text)) !== null) {
      keywords.push(match[1].toUpperCase());
    }
    return keywords;
  }

  /**
   * Find the first and last top-level statement indices that overlap
   * with the changed line range.
   */
  private findAffectedStatementRange(
    statements: readonly StatementNode[],
    change: ContentChange
  ): { firstIndex: number; lastIndex: number } {
    const editStart = change.startLine;
    const editEnd = change.endLine;

    let firstIndex = -1;
    let lastIndex = -1;

    for (let i = 0; i < statements.length; i++) {
      const stmtRange = statements[i].getRange();
      const stmtStart = stmtRange.start.line;
      const stmtEnd = stmtRange.end.line;

      // Statement overlaps with the edit range
      if (stmtEnd >= editStart && stmtStart <= editEnd) {
        if (firstIndex === -1) firstIndex = i;
        lastIndex = i;
      }
    }

    // If no overlap found, the edit is in whitespace/comments between statements
    // or beyond all statements. In these cases, find the insertion point.
    if (firstIndex === -1) {
      // Edit is after all statements or in a gap — find nearest
      for (let i = 0; i < statements.length; i++) {
        const stmtEnd = statements[i].getRange().end.line;
        if (stmtEnd >= editStart) {
          firstIndex = i;
          lastIndex = i;
          break;
        }
      }

      // Edit is after all statements
      if (firstIndex === -1) {
        firstIndex = statements.length - 1;
        lastIndex = statements.length - 1;
      }
    }

    return { firstIndex, lastIndex };
  }

  /**
   * Get the 0-based end line for the re-parse region.
   * Accounts for line delta when the edit changed line count.
   */
  private getRegionEndLine(
    statements: readonly StatementNode[],
    lastIndex: number,
    lineDelta: number,
    newText: string
  ): number {
    const originalEnd = statements[lastIndex].getRange().end.line;
    const adjustedEnd = originalEnd + lineDelta;
    const totalLines = newText.split(/\n/).length - 1;
    return Math.max(0, Math.min(adjustedEnd, totalLines));
  }

  /**
   * Compute the byte offset of a given 0-based line in the text.
   */
  private computeByteOffset(text: string, line: number): number {
    let offset = 0;
    let currentLine = 0;
    for (let i = 0; i < text.length && currentLine < line; i++) {
      if (text[i] === '\n') {
        currentLine++;
      }
      offset = i + 1;
    }
    return currentLine < line ? text.length : offset;
  }
}
