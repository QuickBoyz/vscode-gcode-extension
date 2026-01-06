/**
 * Document Highlight Provider
 *
 * Provides highlighting for all occurrences of a variable when the cursor
 * is positioned on it. Used for rename previews.
 */
import {
  DocumentHighlight,
  DocumentHighlightKind,
  Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentStateManager } from "./DocumentStateManager";
import { VariableSymbolCollector } from "./VariableSymbolCollector";
import { astRangeToLspRange } from "./RenameUtils";
import { AstTraverser } from "../_parser/AstTraverser";
import { DEFAULT_FORMATTER_SETTINGS } from "../constants";

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
    position: Position
  ): DocumentHighlight[] | null {
    const state = this.stateManager.getOrParseDocumentFromTextDocument(
      document,
      { formatter: DEFAULT_FORMATTER_SETTINGS }
    );

    const collector = new VariableSymbolCollector();
    const traverser = new AstTraverser(collector);
    traverser.traverseProgram(state.ast);

    const symbol = collector.findSymbolAtPosition(position, document);
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

    for (const sym of allSymbols) {
      const range = astRangeToLspRange(sym.getRange());
      const kind =
        sym === collector.getDefinition(symbol.name)
          ? DocumentHighlightKind.Write
          : DocumentHighlightKind.Read;

      highlights.push({
        range,
        kind,
      });
    }

    return highlights;
  }
}

