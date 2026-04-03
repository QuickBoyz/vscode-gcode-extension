/**
 * Incremental Parsing Service
 *
 * Re-parses only the changed region of a G-code document and splices
 * the result into the existing AST, avoiding a full re-tokenize + re-parse.
 *
 * Strategy: line-level invalidation with statement splicing.
 *
 * 1. Map the edit's line range to the affected top-level statement indices.
 * 2. Expand the region to block boundaries (IF/WHILE) if needed.
 * 3. Re-tokenize + re-parse only the affected text region.
 * 4. Splice new statements into the old AST.
 * 5. Shift positions of all subsequent (unaffected) statements.
 * 6. Fall back to full re-parse when block structure changes.
 */
import { DialectType } from '../constants';
import { BLOCK_STRUCTURE_KEYWORDS } from '../lexer/constants';
import { LexerFactory } from '../lexer/LexerFactory';
import { BlockStatementNode, ProgramNode, Range, StatementNode } from '../parser/nodes';
import { ParserFactory } from '../parser/ParserFactory';

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
    const affected = this.findAffectedStatementRange(statements, change);
    if (!affected) {
      return { success: false };
    }

    const { firstIndex, lastIndex } = affected;

    // Expand to block boundaries — if any affected statement is a block,
    // ensure we re-parse the entire block
    const expanded = this.expandToBlockBoundaries(statements, firstIndex, lastIndex);

    // Determine the text region to re-parse
    const regionStart = this.getRegionStartLine(statements, expanded.firstIndex);
    const regionEnd = this.getRegionEndLine(
      statements,
      expanded.lastIndex,
      change.lineDelta,
      newText
    );

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
    const before = statements.slice(0, expanded.firstIndex);
    const after = statements.slice(expanded.lastIndex + 1);

    // Shift positions of statements after the edit region
    if (change.lineDelta !== 0) {
      for (const stmt of after) {
        this.shiftNodePositions(stmt, change.lineDelta);
      }
    }

    // Build new ProgramNode
    const allStatements = [...before, ...newStatements, ...after];
    const ast = new ProgramNode(allStatements, oldAst.hasStartDelimiter, oldAst.hasEndDelimiter);

    return { success: true, ast };
  }

  /**
   * Check if the edit introduces or removes block-structure keywords.
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

    const oldHasBlock = BLOCK_KEYWORD_PATTERN.test(oldRegion);
    const newHasBlock = BLOCK_KEYWORD_PATTERN.test(newRegion);

    // If block keywords appeared or disappeared, structure may have changed
    return oldHasBlock !== newHasBlock;
  }

  /**
   * Find the first and last top-level statement indices that overlap
   * with the changed line range.
   */
  private findAffectedStatementRange(
    statements: readonly StatementNode[],
    change: ContentChange
  ): { firstIndex: number; lastIndex: number } | null {
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
   * If any of the affected statements is a block statement, expand
   * the range to include the entire block.
   */
  private expandToBlockBoundaries(
    statements: readonly StatementNode[],
    firstIndex: number,
    lastIndex: number
  ): { firstIndex: number; lastIndex: number } {
    let expanded = false;
    const newFirst = firstIndex;
    const newLast = lastIndex;

    // Check if any affected statement is inside a larger block
    // (top-level statements that are block statements stay as-is,
    //  but we need to re-parse the whole block)
    for (let i = newFirst; i <= newLast; i++) {
      if (statements[i] instanceof BlockStatementNode) {
        expanded = true;
      }
    }

    // If we have blocks, also include adjacent statements that
    // might be part of the same logical group
    if (expanded) {
      // Ensure the re-parse region covers the full block range
      // (already guaranteed since blocks are top-level statements)
    }

    return { firstIndex: newFirst, lastIndex: newLast };
  }

  /**
   * Get the 0-based start line for the re-parse region.
   */
  private getRegionStartLine(statements: readonly StatementNode[], firstIndex: number): number {
    return statements[firstIndex].getRange().start.line;
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
    return Math.min(adjustedEnd, totalLines);
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

  /**
   * Recursively shift all position data in a statement by a line delta.
   */
  private shiftNodePositions(node: StatementNode, lineDelta: number): void {
    this.shiftRange(node, lineDelta);

    // Recurse into block statement bodies
    if (node instanceof BlockStatementNode) {
      for (const child of node.body) {
        this.shiftNodePositions(child, lineDelta);
      }
    }
  }

  /**
   * Shift a node's range by a line delta.
   */
  private shiftRange(
    node: { getRange(): Range; setRange(range: Range): void },
    lineDelta: number
  ): void {
    const range = node.getRange();
    node.setRange(
      Range.create(
        range.start.line + lineDelta,
        range.start.character,
        range.end.line + lineDelta,
        range.end.character
      )
    );
  }
}
