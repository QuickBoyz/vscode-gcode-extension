/**
 * Variable Completion Strategy
 *
 * Provides completions for document-defined variables (#<name> or #123).
 * Variables are derived from the document's AST analysis results.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';

import { DocumentStateManager, GCodeSettings } from '../DocumentStateManager';
import { ContextInfo } from '../CompletionContextDetector';
import { formatVariableName } from '../RenameUtils';
import { CompletionStrategy } from './CompletionStrategy';

export class VariableCompletionStrategy implements CompletionStrategy {
  constructor(private readonly documentStateManager: DocumentStateManager) {}

  provide(
    document: TextDocument,
    _contextInfo: ContextInfo,
    settings: GCodeSettings
  ): CompletionItem[] {
    const items: CompletionItem[] = [];
    const analysis = this.documentStateManager.getAnalysisFromTextDocument(document, settings);

    for (const [varName, symbol] of analysis.variables) {
      if (symbol.definitions.length === 0) continue;

      const displayName = formatVariableName(varName);

      items.push({
        label: displayName,
        kind: CompletionItemKind.Variable,
        detail: `${symbol.references.length} reference${symbol.references.length !== 1 ? 's' : ''}`,
        insertText: displayName,
      });
    }

    return items;
  }
}
