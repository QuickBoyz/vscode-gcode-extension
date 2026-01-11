/**
 * Document Symbol Provider
 *
 * Provides symbol information for the outline view.
 * Lists all variable definitions in the document.
 */
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DocumentStateManager, GCodeSettings } from './DocumentStateManager';
import { formatVariableName } from './RenameUtils';

/**
 * Document Symbol Provider
 *
 * Provides symbol information for variables in the document.
 */
export class DocumentSymbolProvider {
  constructor(private stateManager: DocumentStateManager) {}

  /**
   * Provide document symbols (variable definitions) for the outline view
   */
  provideDocumentSymbols(document: TextDocument, settings: GCodeSettings): DocumentSymbol[] {
    const analysis = this.stateManager.getAnalysisFromTextDocument(document, settings),
      symbols: DocumentSymbol[] = [];

    // Get all variable names and their definitions for the outline
    for (const [name, variableSymbol] of analysis.variables) {
      if (variableSymbol.definitions.length === 0) continue;

      // Use the first definition for the outline view
      const definition = variableSymbol.definitions[0],
        fullRange = definition.getRange(),
        // For selection range, we want just the variable name part
        formattedName = formatVariableName(name),
        selectionRange = {
          start: fullRange.start,
          end: {
            line: fullRange.start.line,
            character: fullRange.start.character + formattedName.length,
          },
        };

      symbols.push({
        name: formattedName,
        kind: SymbolKind.Variable,
        range: fullRange,
        selectionRange,
        detail: this.getVariableDetail(),
      });
    }

    // Sort by line number
    symbols.sort((a, b) => {
      if (a.range.start.line !== b.range.start.line) {
        return a.range.start.line - b.range.start.line;
      }
      return a.range.start.character - b.range.start.character;
    });

    return symbols;
  }

  /**
   * Get detail information for a variable (optional value info)
   */
  private getVariableDetail(): string | undefined {
    // TODO: Extract value information if needed
    // For now, return undefined
    return undefined;
  }
}
