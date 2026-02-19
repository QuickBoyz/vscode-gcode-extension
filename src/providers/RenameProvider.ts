/**
 * Rename Provider
 *
 * Provides variable renaming functionality for G-code files.
 * Supports both numeric (#1) and named (#<foo>) variables.
 */
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextEdit, WorkspaceEdit } from 'vscode-languageserver/node';

import { Position, Range, VariableAssignmentNode, VariableReferenceNode } from '../parser/nodes';
import { GCodeSettings } from './DocumentStateManager';
import { BaseProvider } from './BaseProvider';
import { VariableAnalysisService } from './VariableAnalysisService';

/**
 * Rename Provider
 *
 * Handles variable renaming requests from the language server.
 */
export class RenameProvider extends BaseProvider {
  private readonly variableAnalysisService = new VariableAnalysisService();

  /**
   * Prepare rename - check if position is on a variable and return range/placeholder
   */
  prepareRename(
    document: TextDocument,
    position: Position,
    settings: GCodeSettings
  ): Range | { range: Range; placeholder: string } | null {
    const analysis = this.getAnalysis(document, settings),
      symbol = this.variableAnalysisService.findSymbolAtPosition(analysis, position);

    if (!symbol) {
      return null;
    }

    // Get the range of just the variable name (not the entire assignment)
    const range = this.variableAnalysisService.getVariableNameRange(symbol.node);
    if (!range) {
      return null;
    }

    // Return just the variable name as placeholder (e.g., "col_count" not "#<col_count>")
    const placeholder = typeof symbol.name === 'number' ? symbol.name.toString() : symbol.name;

    return { range, placeholder };
  }

  /**
   * Provide rename edits - create TextEdits for all occurrences
   */
  provideRenameEdits(
    document: TextDocument,
    position: Position,
    newName: string,
    settings: GCodeSettings
  ): WorkspaceEdit | null {
    const analysis = this.getAnalysis(document, settings),
      symbol = this.variableAnalysisService.findSymbolAtPosition(analysis, position);

    if (!symbol) {
      return null;
    }

    const oldName = symbol.name,
      isNumeric = typeof oldName === 'number';

    // Validate new name
    if (!this.variableAnalysisService.validateVariableName(newName, isNumeric)) {
      return null;
    }

    // Check if renaming to a different type (numeric to named or vice versa)
    if (isNumeric && typeof oldName === 'number') {
      const newNum = parseInt(newName, 10);
      if (isNaN(newNum)) {
        return null; // Cannot rename numeric to named
      }
    } else if (!isNumeric && typeof oldName === 'string') {
      if (/^\d+$/.test(newName)) {
        return null; // Cannot rename named to numeric
      }
    }

    // Get all symbols (definition + references) from analysis
    const variableSymbol = analysis.variables.get(oldName);
    if (!variableSymbol) {
      return null;
    }

    const allNodes: Array<VariableAssignmentNode | VariableReferenceNode> = [];
    // Add all definitions
    allNodes.push(...variableSymbol.definitions);
    // Add all references
    allNodes.push(...variableSymbol.references);

    if (allNodes.length === 0) {
      return null;
    }

    // Check for conflicts with existing variables
    if (isNumeric) {
      const newNum = parseInt(newName, 10);
      const existingVar = analysis.variables.get(newNum);
      if (existingVar && existingVar.definitions.length > 0 && newNum !== oldName) {
        return null; // Conflict with existing variable
      }
    } else {
      const existingVar = analysis.variables.get(newName);
      if (existingVar && existingVar.definitions.length > 0 && newName !== oldName) {
        return null; // Conflict with existing variable
      }
    }

    // Create text edits
    const edits = this.createTextEdits(allNodes, newName, isNumeric);

    return {
      changes: {
        [document.uri]: edits,
      },
    };
  }

  /**
   * Create TextEdits for all symbol occurrences
   */
  private createTextEdits(
    symbols: Array<VariableAssignmentNode | VariableReferenceNode>,
    newName: string,
    isNumeric: boolean
  ): TextEdit[] {
    const edits: TextEdit[] = [],
      formattedNewName = this.variableAnalysisService.formatVariableName(
        isNumeric ? parseInt(newName, 10) : newName
      );

    for (const symbol of symbols) {
      const range = this.variableAnalysisService.getVariableNameRange(symbol);
      if (range) {
        edits.push(TextEdit.replace(range, formattedNewName));
      }
    }

    return edits;
  }
}
