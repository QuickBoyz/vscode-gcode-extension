/**
 * Rename Provider
 *
 * Provides variable renaming functionality for G-code files.
 * Supports both numeric (#1) and named (#<foo>) variables.
 */
import {
  Position,
  Range,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentStateManager } from "./DocumentStateManager";
import { VariableSymbolCollector } from "./VariableSymbolCollector";
import {
  formatVariableName,
  validateVariableName,
  astRangeToLspRange,
} from "./RenameUtils";
import { AstTraverser } from "../_parser/AstTraverser";
import {
  VariableAssignmentNode,
  VariableReferenceNode,
} from "../_parser/nodes";
import { DEFAULT_FORMATTER_SETTINGS } from "../constants";

/**
 * Rename Provider
 *
 * Handles variable renaming requests from the language server.
 */
export class RenameProvider {
  constructor(private stateManager: DocumentStateManager) {}

  /**
   * Prepare rename - check if position is on a variable and return range/placeholder
   */
  prepareRename(
    document: TextDocument,
    position: Position
  ): Range | { range: Range; placeholder: string } | null {
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

    const range = astRangeToLspRange(symbol.range);
    const placeholder = formatVariableName(symbol.name);

    return { range, placeholder };
  }

  /**
   * Provide rename edits - create TextEdits for all occurrences
   */
  provideRenameEdits(
    document: TextDocument,
    position: Position,
    newName: string
  ): WorkspaceEdit | null {
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

    const oldName = symbol.name;
    const isNumeric = typeof oldName === "number";

    // Validate new name
    if (!validateVariableName(newName, isNumeric)) {
      return null;
    }

    // Check if renaming to a different type (numeric to named or vice versa)
    if (isNumeric && typeof oldName === "number") {
      const newNum = parseInt(newName, 10);
      if (isNaN(newNum)) {
        return null; // Cannot rename numeric to named
      }
    } else if (!isNumeric && typeof oldName === "string") {
      if (/^\d+$/.test(newName)) {
        return null; // Cannot rename named to numeric
      }
    }

    // Get all symbols (definition + references)
    const allSymbols = collector.getAllSymbols(oldName);
    if (allSymbols.length === 0) {
      return null;
    }

    // Check for conflicts with existing variables
    if (isNumeric) {
      const newNum = parseInt(newName, 10);
      const existingDef = collector.getDefinition(newNum);
      if (existingDef && newNum !== oldName) {
        return null; // Conflict with existing variable
      }
    } else {
      const existingDef = collector.getDefinition(newName);
      if (existingDef && newName !== oldName) {
        return null; // Conflict with existing variable
      }
    }

    // Create text edits
    const edits = this.createTextEdits(allSymbols, newName, isNumeric, document);

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
    isNumeric: boolean,
    document: TextDocument
  ): TextEdit[] {
    const edits: TextEdit[] = [];
    const formattedNewName = formatVariableName(
      isNumeric ? parseInt(newName, 10) : newName
    );

    for (const symbol of symbols) {
      const range = astRangeToLspRange(symbol.getRange());
      edits.push(TextEdit.replace(range, formattedNewName));
    }

    return edits;
  }
}

