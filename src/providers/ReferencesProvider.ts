/**
 * References Provider
 *
 * Provides Find All References functionality for G-code variables.
 * Returns all locations where a variable is defined and/or referenced.
 */
import { Location } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { Position, VariableAssignmentNode, VariableReferenceNode } from '../parser/nodes';
import { GCodeSettings } from './DocumentStateManager';
import { BaseProvider } from './BaseProvider';
import { VariableAnalysisService } from './VariableAnalysisService';

/**
 * References Provider
 *
 * Handles Find All References requests for variable symbols.
 * Returns locations of all definitions and/or references of the variable
 * at the cursor position.
 */
export class ReferencesProvider extends BaseProvider {
  private readonly variableAnalysisService = new VariableAnalysisService();

  /**
   * Provide all reference locations for a variable at the given position
   *
   * @param document - The text document
   * @param position - Cursor position
   * @param settings - G-code settings (formatter, dialect)
   * @param includeDeclaration - Whether to include definition locations
   * @returns Array of locations sorted by line number, or empty array if not on a variable
   */
  provideReferences(
    document: TextDocument,
    position: Position,
    settings: GCodeSettings,
    includeDeclaration: boolean
  ): Location[] {
    const analysis = this.getAnalysis(document, settings),
      symbol = this.variableAnalysisService.findSymbolAtPosition(analysis, position);

    if (!symbol) {
      return [];
    }

    // Get variable symbol from analysis to access all definitions and references
    const variableSymbol = analysis.variables.get(symbol.name);
    if (!variableSymbol) {
      return [];
    }

    // Collect all relevant nodes
    const nodes: ReadonlyArray<VariableAssignmentNode | VariableReferenceNode> = includeDeclaration
      ? [...variableSymbol.definitions, ...variableSymbol.references]
      : [...variableSymbol.references];

    // Convert to locations, filtering out any without valid ranges
    const locations: Location[] = [];
    for (const node of nodes) {
      const range = this.variableAnalysisService.getVariableNameRange(node);
      if (range) {
        locations.push({ uri: document.uri, range });
      }
    }

    // Sort by line number, then by character position
    locations.sort((a, b) => {
      const lineDiff = a.range.start.line - b.range.start.line;
      if (lineDiff !== 0) {
        return lineDiff;
      }
      return a.range.start.character - b.range.start.character;
    });

    return locations;
  }
}
