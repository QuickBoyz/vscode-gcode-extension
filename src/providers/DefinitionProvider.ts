/**
 * Definition Provider
 *
 * Provides Go to Definition functionality for G-code variables.
 * Navigates from variable references to their first definition (assignment).
 */
import { Location } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { Position } from '../parser/nodes';
import { GCodeSettings } from './DocumentStateManager';
import { BaseProvider } from './BaseProvider';
import { VariableAnalysisService } from './VariableAnalysisService';

/**
 * Definition Provider
 *
 * Handles Go to Definition requests for variable symbols.
 * Returns the location of the first definition (assignment) of the variable
 * at the cursor position.
 */
export class DefinitionProvider extends BaseProvider {
  private readonly variableAnalysisService = new VariableAnalysisService();

  /**
   * Provide the definition location for a variable at the given position
   *
   * @param document - The text document
   * @param position - Cursor position
   * @param settings - G-code settings (formatter, dialect)
   * @returns Location of the first definition, or null if not on a variable or no definitions exist
   */
  provideDefinition(
    document: TextDocument,
    position: Position,
    settings: GCodeSettings
  ): Location | null {
    const analysis = this.getAnalysis(document, settings);
    const symbol = this.variableAnalysisService.findSymbolAtPosition(analysis, position);

    if (!symbol) {
      return null;
    }

    // Get variable symbol from analysis to access all definitions
    const variableSymbol = analysis.variables.get(symbol.name);
    if (!variableSymbol || variableSymbol.definitions.length === 0) {
      return null;
    }

    // Return the first definition location
    const firstDefinition = variableSymbol.definitions[0];
    const range = this.variableAnalysisService.getVariableNameRange(firstDefinition);

    if (!range) {
      return null;
    }

    return { uri: document.uri, range };
  }
}
