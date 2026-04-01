/**
 * Document Symbol Provider
 *
 * Provides hierarchical symbol information for the outline view.
 * Traverses the AST to build a symbol tree with subroutines, control flow,
 * variables, calls, and returns.
 */
import { DocumentSymbol } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { AstTraverser } from '../parser/AstTraverser';
import { ExpressionFormatter } from '../formatter/ExpressionFormatter';
import { GCodeSettings } from './DocumentStateManager';
import { BaseProvider } from './BaseProvider';
import { DocumentSymbolVisitor } from './DocumentSymbolVisitor';

/**
 * Document Symbol Provider
 *
 * Provides hierarchical symbol information for outline view and breadcrumbs.
 */
export class DocumentSymbolProvider extends BaseProvider {
  provideDocumentSymbols(document: TextDocument, settings: GCodeSettings): DocumentSymbol[] {
    const state = this.getDocumentState(document, settings),
      visitor = new DocumentSymbolVisitor(new ExpressionFormatter(), document.getText()),
      traverser = new AstTraverser(visitor);
    traverser.traverseProgram(state.ast);
    return visitor.getSymbols();
  }
}
