/**
 * Document Highlight Provider
 *
 * Provides highlighting for all occurrences of a variable when the cursor
 * is positioned on it. Used for rename previews.
 */
import { DocumentHighlight, DocumentHighlightKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { Position } from '../parser/nodes';
import { GCodeSettings } from './DocumentStateManager';
import { BaseProvider } from './BaseProvider';
import { VariableAnalysisService } from './VariableAnalysisService';

/**
 * Document Highlight Provider
 *
 * Highlights all occurrences of a variable at the cursor position.
 */
export class DocumentHighlightProvider extends BaseProvider {
  private readonly variableAnalysisService = new VariableAnalysisService();

  /**
   * Provide document highlights for a variable at the given position
   */
  provideDocumentHighlights(
    document: TextDocument,
    position: Position,
    settings: GCodeSettings
  ): DocumentHighlight[] | null {
    const analysis = this.getAnalysis(document, settings),
      symbol = this.variableAnalysisService.findSymbolAtPosition(analysis, position);

    if (!symbol) {
      return null;
    }

    // Get variable symbol from analysis
    const variableSymbol = analysis.variables.get(symbol.name);
    if (!variableSymbol) {
      return null;
    }

    // Create highlights
    const highlights: DocumentHighlight[] = [];

    // Add highlights for all definitions
    for (const definition of variableSymbol.definitions) {
      const variableRange = this.variableAnalysisService.getVariableNameRange(definition);
      if (variableRange) {
        highlights.push({
          range: variableRange,
          kind: DocumentHighlightKind.Write,
        });
      }
    }

    // Add highlights for references
    for (const ref of variableSymbol.references) {
      const variableRange = this.variableAnalysisService.getVariableNameRange(ref);
      if (variableRange) {
        highlights.push({
          range: variableRange,
          kind: DocumentHighlightKind.Read,
        });
      }
    }

    return highlights;
  }
}
