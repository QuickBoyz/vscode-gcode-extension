/**
 * Document Symbol Provider
 *
 * Provides symbol information for the outline view.
 * Lists all variable definitions in the document.
 */
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";
import { AstTraverser } from "../_parser/AstTraverser";
import { VariableAssignmentNode } from "../_parser/nodes";
import {
  DocumentStateManager,
  GCodeSettings,
} from "./DocumentStateManager";
import { formatVariableName } from "./RenameUtils";
import { VariableSymbolCollector } from "./VariableSymbolCollector";

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
  provideDocumentSymbols(
    document: TextDocument,
    settings: GCodeSettings
  ): DocumentSymbol[] {
    const state = this.stateManager.getOrParseDocumentFromTextDocument(
      document,
      settings
    );

    const collector = new VariableSymbolCollector();
    const traverser = new AstTraverser(collector);
    traverser.traverseProgram(state.ast);

    const symbols: DocumentSymbol[] = [];

    // Get all variable names and their first definition for the outline
    for (const name of collector.getAllVariableNames()) {
      const allDefinitions =
        collector.getAllDefinitionsForVariable(name);
      if (allDefinitions.length === 0) continue;

      // Use the first definition for the outline view
      const definition = allDefinitions[0];
      const fullRange = definition.getRange();

      // For selection range, we want just the variable name part
      // The variable name is at the start of the range
      const variableNameRange = definition.getRange();
      // Adjust selection range to just the variable name
      // For #<x> = 10, we want to select just #<x>
      const formattedName = formatVariableName(name);
      const selectionRange = {
        start: variableNameRange.start,
        end: {
          line: variableNameRange.start.line,
          character:
            variableNameRange.start.character + formattedName.length,
        },
      };

      symbols.push({
        name: formattedName,
        kind: SymbolKind.Variable,
        range: fullRange,
        selectionRange,
        detail: this.getVariableDetail(definition),
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
  private getVariableDetail(
    definition: VariableAssignmentNode
  ): string | undefined {
    // TODO: Extract value information if needed
    // For now, return undefined
    return undefined;
  }
}
