import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import { AstTraverser } from '../parser/AstTraverser';
import { IfStatementNode, SubroutineLabelNode, WhileStatementNode } from '../parser/nodes';
import { DocumentStateManager, GCodeSettings } from './DocumentStateManager';

/**
 * Provides code folding ranges for G-code control structures.
 *
 * Traverses the AST using the visitor pattern and collects folding ranges for:
 * - IF/ENDIF blocks
 * - WHILE/ENDWHILE blocks
 * - O-block subroutine labels
 */
export class FoldingRangeProvider extends BaseAstVisitor<void> {
  private foldingRanges: FoldingRange[] = [];
  private subroutineLabels: SubroutineLabelNode[] = [];

  protected defaultValue(): void {
    return;
  }

  visitIfStatement(node: IfStatementNode): void {
    const startLine = node.ifClause.keywordTokenRange.start.line;
    const endLine = node.endIfTokenRange.end.line;

    if (startLine < endLine) {
      this.foldingRanges.push({
        startLine,
        endLine,
        kind: FoldingRangeKind.Region,
      });
    }
  }

  visitWhileStatement(node: WhileStatementNode): void {
    const startLine = node.getRange().start.line;
    const endLine = node.getRange().end.line;

    if (startLine < endLine) {
      this.foldingRanges.push({
        startLine,
        endLine,
        kind: FoldingRangeKind.Region,
      });
    }
  }

  visitSubroutineLabel(node: SubroutineLabelNode): void {
    this.subroutineLabels.push(node);
  }

  private computeSubroutineRanges(totalLines: number): void {
    for (let i = 0; i < this.subroutineLabels.length; i++) {
      const label = this.subroutineLabels[i];
      const startLine = label.getRange().start.line;
      const nextLabel = this.subroutineLabels[i + 1];
      const endLine = nextLabel ? nextLabel.getRange().start.line - 1 : totalLines - 1;

      if (startLine < endLine) {
        this.foldingRanges.push({
          startLine,
          endLine,
          kind: FoldingRangeKind.Region,
        });
      }
    }
  }

  /**
   * Provide folding ranges for a document.
   *
   * @param document - The text document to provide folding ranges for
   * @param documentStateManager - Used to retrieve the cached parsed AST
   * @param settings - Document settings including dialect
   * @returns Array of folding ranges for control structures and subroutine labels
   */
  provideFoldingRanges(
    document: TextDocument,
    documentStateManager: DocumentStateManager,
    settings: GCodeSettings
  ): FoldingRange[] {
    this.foldingRanges = [];
    this.subroutineLabels = [];

    const state = documentStateManager.getOrParseDocumentFromTextDocument(document, settings);
    const traverser = new AstTraverser(this);
    traverser.traverseProgram(state.ast);
    this.computeSubroutineRanges(document.lineCount);
    return this.foldingRanges;
  }
}
