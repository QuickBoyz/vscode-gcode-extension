/**
 * Document Symbol Provider
 *
 * Provides symbol information for the outline view.
 * Lists all variable definitions in the document.
 */
import {
  DocumentSymbol,
  SymbolKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentStateManager } from "./DocumentStateManager";
import { VariableSymbolCollector } from "./VariableSymbolCollector";
import { formatVariableName, astRangeToLspRange } from "./RenameUtils";
import { AstTraverser } from "../_parser/AstTraverser";
import { DEFAULT_FORMATTER_SETTINGS } from "../constants";
import { VariableAssignmentNode } from "../_parser/nodes";

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
  provideDocumentSymbols(document: TextDocument): DocumentSymbol[] {
    const state = this.stateManager.getOrParseDocumentFromTextDocument(
      document,
      { formatter: DEFAULT_FORMATTER_SETTINGS }
    );

    const collector = new VariableSymbolCollector();
    const traverser = new AstTraverser(collector);
    traverser.traverseProgram(state.ast);

    const definitions = collector.getAllDefinitions();
    const symbols: DocumentSymbol[] = [];

    for (const [name, definition] of definitions.entries()) {
      const fullRange = astRangeToLspRange(definition.getRange());
      
      // For selection range, we want just the variable name part
      // The variable name is at the start of the range
      const variableNameRange = astRangeToLspRange(definition.getRange());
      // Adjust selection range to just the variable name
      // For #<x> = 10, we want to select just #<x>
      const formattedName = formatVariableName(name);
      const selectionRange = {
        start: variableNameRange.start,
        end: {
          line: variableNameRange.start.line,
          character: variableNameRange.start.character + formattedName.length,
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
  private getVariableDetail(definition: VariableAssignmentNode): string | undefined {
    // Could extract value information if needed
    // For now, return undefined
    return undefined;
  }
}

