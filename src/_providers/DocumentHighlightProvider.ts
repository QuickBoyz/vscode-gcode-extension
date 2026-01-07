/**
 * Document Highlight Provider
 *
 * Provides highlighting for all occurrences of a variable when the cursor
 * is positioned on it. Used for rename previews.
 */
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  DocumentHighlight,
  DocumentHighlightKind,
} from "vscode-languageserver/node";
import { AstTraverser } from "../_parser/AstTraverser";
import { Position, VariableAssignmentNode } from "../_parser/nodes";
import {
  DocumentStateManager,
  GCodeSettings,
} from "./DocumentStateManager";
import { getVariableNameRange } from "./RenameUtils";
import { VariableSymbolCollector } from "./VariableSymbolCollector";

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
    const state = this.stateManager.getOrParseDocumentFromTextDocument(
      document,
      settings
    );

    const collector = new VariableSymbolCollector();
    const traverser = new AstTraverser(collector);
    traverser.traverseProgram(state.ast);

    const symbol = collector.findSymbolAtPosition(position);
    if (!symbol) {
      return null;
    }

    // Get all symbols (definition + references)
    const allSymbols = collector.getAllSymbols(symbol.name);
    if (allSymbols.length === 0) {
      return null;
    }

    // Create highlights
    const highlights: DocumentHighlight[] = [];

    for (const symbol of allSymbols) {
      const variableRange = getVariableNameRange(symbol);
      if (!variableRange) {
        continue;
      }

      // All assignments are Write, all references are Read
      const kind =
        symbol instanceof VariableAssignmentNode
          ? DocumentHighlightKind.Write
          : DocumentHighlightKind.Read;

      highlights.push({
        range: variableRange,
        kind,
      });
    }

    return highlights;
  }
}
