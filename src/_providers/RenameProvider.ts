/**
 * Rename Provider
 *
 * Provides variable renaming functionality for G-code files.
 * Supports both numeric (#1) and named (#<foo>) variables.
 */
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit, WorkspaceEdit } from "vscode-languageserver/node";
import { AstTraverser } from "../_parser/AstTraverser";
import {
  Position,
  Range,
  VariableAssignmentNode,
  VariableReferenceNode,
} from "../_parser/nodes";
import {
  DocumentStateManager,
  GCodeSettings,
} from "./DocumentStateManager";
import {
  formatVariableName,
  getVariableNameRange,
  validateVariableName,
} from "./RenameUtils";
import {
  VariableSymbol,
  VariableSymbolCollector,
  VariableSymbolKind,
} from "./VariableSymbolCollector";

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
    position: Position,
    settings: GCodeSettings
  ): Range | { range: Range; placeholder: string } | null {
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

    // Get the range of just the variable name (not the entire assignment)
    const range = this.getVariableNameRangeFromSymbol(symbol);
    if (!range) {
      return null;
    }

    // Return just the variable name as placeholder (e.g., "col_count" not "#<col_count>")
    const placeholder =
      typeof symbol.name === "number"
        ? symbol.name.toString()
        : symbol.name;

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
    const edits = this.createTextEdits(allSymbols, newName, isNumeric);

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
    const edits: TextEdit[] = [];
    const formattedNewName = formatVariableName(
      isNumeric ? parseInt(newName, 10) : newName
    );

    for (const symbol of symbols) {
      const range = getVariableNameRange(symbol);
      if (range) {
        edits.push(TextEdit.replace(range, formattedNewName));
      }
    }

    return edits;
  }

  /**
   * Get the AST range of just the variable name from a symbol
   */
  private getVariableNameRangeFromSymbol(
    symbol: VariableSymbol
  ): Range | null {
    const fullRange = symbol.range;

    // For references, the range is already just the variable
    if (symbol.kind === VariableSymbolKind.Reference) {
      return fullRange;
    }

    // For definitions (assignments), we need to extract just the variable name part
    const formattedName = formatVariableName(symbol.name);
    return Range.create(
      fullRange.start.line,
      fullRange.start.character,
      fullRange.start.line,
      fullRange.start.character + formattedName.length
    );
  }
}
