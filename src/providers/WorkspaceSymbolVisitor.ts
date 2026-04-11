/**
 * Workspace Symbol Visitor
 *
 * AST visitor that extracts workspace-level symbols from a G-code AST.
 * Collects subroutine definitions, subroutine labels, line numbers,
 * and variable definitions (first assignment only) for cross-file search.
 */
import { SymbolKind } from 'vscode-languageserver/node';

import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import {
  LineNumberNode,
  SubroutineDefinitionNode,
  SubroutineLabelNode,
  VariableAssignmentNode,
} from '../parser/nodes';
import { Range } from '../parser/nodes/Range';
import { formatVariableName } from './RenameUtils';

/**
 * Represents a symbol extracted from a workspace file.
 * Contains enough information to build an LSP SymbolInformation.
 */
export interface WorkspaceSymbol {
  /** Display name of the symbol (e.g. "O100", "N50", "#<feed>") */
  readonly name: string;
  /** LSP symbol kind */
  readonly kind: SymbolKind;
  /** Range of the symbol in the source file */
  readonly range: Range;
  /** URI of the file containing this symbol */
  readonly fileUri: string;
}

/**
 * AST visitor that collects workspace-level symbols.
 *
 * Extracts:
 * - Subroutine definitions (O-blocks with SUB/ENDSUB, PROC)
 * - Subroutine labels (standalone O-block labels)
 * - Line numbers (N-blocks)
 * - Variable definitions (first assignment of each variable)
 */
export class WorkspaceSymbolVisitor extends BaseAstVisitor<void> {
  private readonly symbols: WorkspaceSymbol[] = [];
  private readonly seenVariables = new Set<string | number>();

  constructor(private readonly fileUri: string) {
    super();
  }

  protected defaultValue(): void {
    return;
  }

  getSymbols(): readonly WorkspaceSymbol[] {
    return this.symbols;
  }

  visitSubroutineDefinition(node: SubroutineDefinitionNode): void {
    this.symbols.push({
      name: node.label,
      kind: SymbolKind.Function,
      range: node.labelTokenRange,
      fileUri: this.fileUri,
    });
  }

  visitSubroutineLabel(node: SubroutineLabelNode): void {
    this.symbols.push({
      name: node.label,
      kind: SymbolKind.Module,
      range: node.getRange(),
      fileUri: this.fileUri,
    });
  }

  visitLineNumber(node: LineNumberNode): void {
    this.symbols.push({
      name: node.lineNumber,
      kind: SymbolKind.Constant,
      range: node.getRange(),
      fileUri: this.fileUri,
    });
  }

  visitVariableAssignment(node: VariableAssignmentNode): void {
    // Only record the first assignment of each variable
    if (this.seenVariables.has(node.name)) {
      return;
    }
    this.seenVariables.add(node.name);

    this.symbols.push({
      name: formatVariableName(node.name),
      kind: SymbolKind.Variable,
      range: node.variableTokenRange,
      fileUri: this.fileUri,
    });
  }
}
