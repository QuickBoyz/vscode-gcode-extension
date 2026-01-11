/**
 * Document Highlight Provider
 *
 * Provides highlighting for all occurrences of a variable when the cursor
 * is positioned on it. Used for rename previews.
 */
import { DocumentHighlight, DocumentHighlightKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { Position, Range } from '../parser/nodes';
import { DocumentStateManager, GCodeSettings } from './DocumentStateManager';
import { getVariableNameRange } from './RenameUtils';

/**
 * Document Highlight Provider
 *
 * Highlights all occurrences of a variable at the cursor position.
 */
export class DocumentHighlightProvider {
  constructor(private stateManager: DocumentStateManager) {}

  /**
   * Provide document highlights for a variable at the given position
   */
  provideDocumentHighlights(
    document: TextDocument,
    position: Position,
    settings: GCodeSettings
  ): DocumentHighlight[] | null {
    const analysis = this.stateManager.getAnalysisFromTextDocument(document, settings),
      symbol = this.findSymbolAtPosition(analysis, position);

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
      const variableRange = getVariableNameRange(definition);
      if (variableRange) {
        highlights.push({
          range: variableRange,
          kind: DocumentHighlightKind.Write,
        });
      }
    }

    // Add highlights for references
    for (const ref of variableSymbol.references) {
      const variableRange = getVariableNameRange(ref);
      if (variableRange) {
        highlights.push({
          range: variableRange,
          kind: DocumentHighlightKind.Read,
        });
      }
    }

    return highlights;
  }

  /**
   * Find symbol at position from analysis results
   */
  private findSymbolAtPosition(
    analysis: import('./AnalysisResults').AnalysisResults,
    position: Position
  ): { name: string | number } | null {
    for (const [name, symbol] of analysis.variables) {
      // Check all definitions - use the variable name range, not the full assignment range
      for (const definition of symbol.definitions) {
        const variableRange = getVariableNameRange(definition);
        if (variableRange && Range.isPositionInRange(position, variableRange)) {
          return { name };
        }
      }

      // Check references
      for (const ref of symbol.references) {
        if (Range.isPositionInRange(position, ref.getRange())) {
          return { name };
        }
      }
    }
    return null;
  }
}
