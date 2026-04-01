/**
 * Document Symbol Provider
 *
 * Provides hierarchical symbol information for the outline view.
 * Traverses the AST to build a symbol tree with subroutines, control flow,
 * variables, calls, and returns.
 */
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import { AstTraverser } from '../parser/AstTraverser';
import {
  IfStatementNode,
  ReturnStatementNode,
  SubroutineCallNode,
  SubroutineDefinitionNode,
  SubroutineLabelNode,
  VariableAssignmentNode,
  WhileStatementNode,
} from '../parser/nodes';
import { ExpressionFormatter } from '../formatter/ExpressionFormatter';
import { GCodeSettings } from './DocumentStateManager';
import { formatVariableName } from './RenameUtils';
import { BaseProvider } from './BaseProvider';
import { Range as AstRange } from '../parser/nodes/Range';

/**
 * Convert parser Range to LSP Range.
 */
function toLspRange(range: AstRange): {
  start: { line: number; character: number };
  end: { line: number; character: number };
} {
  return {
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  };
}

/**
 * AST visitor that builds a hierarchical DocumentSymbol tree.
 *
 * Uses a parent stack: block nodes (SubroutineDefinition, IF, WHILE) push a
 * symbol, children are added to it during traversal, then it's popped on the
 * corresponding End visitor call.
 */
export class DocumentSymbolVisitor extends BaseAstVisitor<void> {
  private readonly rootSymbols: DocumentSymbol[] = [];
  private readonly parentStack: DocumentSymbol[] = [];
  private readonly sourceLines: string[];

  constructor(
    private readonly expressionFormatter: ExpressionFormatter,
    sourceText: string = ''
  ) {
    super();
    this.sourceLines = sourceText.split('\n');
  }

  protected defaultValue(): void {
    return;
  }

  /**
   * Extract text from source at the given single-line range.
   */
  private extractText(range: AstRange): string {
    const line = this.sourceLines[range.start.line];
    if (!line) return '';
    return line.substring(range.start.character, range.end.character);
  }

  getSymbols(): DocumentSymbol[] {
    return this.rootSymbols;
  }

  private currentChildren(): DocumentSymbol[] {
    if (this.parentStack.length > 0) {
      const parent = this.parentStack[this.parentStack.length - 1];
      if (!parent.children) {
        parent.children = [];
      }
      return parent.children;
    }
    return this.rootSymbols;
  }

  // --- Block nodes (push/pop) ---

  visitSubroutineDefinition(node: SubroutineDefinitionNode): void {
    const symbol: DocumentSymbol = {
      name: node.label,
      detail: 'subroutine',
      kind: SymbolKind.Function,
      range: toLspRange(node.getRange()),
      selectionRange: toLspRange(node.labelTokenRange),
    };
    this.currentChildren().push(symbol);
    this.parentStack.push(symbol);
  }

  visitSubroutineDefinitionEnd(): void {
    this.parentStack.pop();
  }

  visitIfStatement(node: IfStatementNode): void {
    const conditionStr = this.expressionFormatter.format(node.ifClause.condition);
    const symbol: DocumentSymbol = {
      name: `IF [${conditionStr}]`,
      kind: SymbolKind.Struct,
      range: toLspRange(node.getRange()),
      selectionRange: toLspRange(node.ifClause.keywordTokenRange),
    };
    this.currentChildren().push(symbol);
    this.parentStack.push(symbol);
  }

  visitIfStatementEnd(): void {
    this.parentStack.pop();
  }

  visitWhileStatement(node: WhileStatementNode): void {
    const conditionStr = this.expressionFormatter.format(node.condition);
    const symbol: DocumentSymbol = {
      name: `WHILE [${conditionStr}]`,
      kind: SymbolKind.Struct,
      range: toLspRange(node.getRange()),
      selectionRange: toLspRange(node.whileTokenRange),
    };
    this.currentChildren().push(symbol);
    this.parentStack.push(symbol);
  }

  visitWhileStatementEnd(): void {
    this.parentStack.pop();
  }

  // --- Leaf nodes ---

  visitVariableAssignment(node: VariableAssignmentNode): void {
    this.currentChildren().push({
      name: formatVariableName(node.name),
      kind: SymbolKind.Variable,
      range: toLspRange(node.getRange()),
      selectionRange: toLspRange(node.getRange()),
    });
  }

  visitSubroutineCall(node: SubroutineCallNode): void {
    const keyword = this.extractText(node.callTokenRange).toUpperCase();
    let name: string;

    if (keyword.startsWith('M')) {
      // Fanuc/Haas: M98 P{target}
      name = `${keyword} P${node.target}`;
    } else if (keyword === 'CALL') {
      // Siemens: CALL {target}
      name = `CALL ${node.target}`;
    } else {
      // LinuxCNC: {target} CALL (keyword is the O-block label)
      name = `${node.target} CALL`;
    }

    this.currentChildren().push({
      name,
      detail: 'call',
      kind: SymbolKind.Function,
      range: toLspRange(node.getRange()),
      selectionRange: toLspRange(node.callTokenRange),
    });
  }

  visitReturnStatement(node: ReturnStatementNode): void {
    const keyword = this.extractText(node.returnTokenRange).toUpperCase();
    const name = node.label ? `${node.label} ${keyword}` : keyword;

    this.currentChildren().push({
      name,
      kind: SymbolKind.Event,
      range: toLspRange(node.getRange()),
      selectionRange: toLspRange(node.returnTokenRange),
    });
  }

  visitSubroutineLabel(node: SubroutineLabelNode): void {
    this.currentChildren().push({
      name: node.label,
      kind: SymbolKind.Key,
      range: toLspRange(node.getRange()),
      selectionRange: toLspRange(node.getRange()),
    });
  }
}

/**
 * Document Symbol Provider
 *
 * Provides hierarchical symbol information for outline view and breadcrumbs.
 */
export class DocumentSymbolProvider extends BaseProvider {
  provideDocumentSymbols(document: TextDocument, settings: GCodeSettings): DocumentSymbol[] {
    const state = this.getDocumentState(document, settings),
      visitor = new DocumentSymbolVisitor(new ExpressionFormatter(), document.getText()),
      traverser = new AstTraverser(visitor);
    traverser.traverseProgram(state.ast);
    return visitor.getSymbols();
  }
}
