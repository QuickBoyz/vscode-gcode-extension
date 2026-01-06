/**
 * Variable Symbol Collector
 *
 * Visitor that collects all variable definitions and references from the AST.
 * Provides fast lookup methods for finding variables by name or position.
 */
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position } from "vscode-languageserver/node";
import { AstVisitor } from "../_parser/AstVisitor";
import { AstTraverser } from "../_parser/AstTraverser";
import {
  ProgramNode,
  VariableAssignmentNode,
  VariableReferenceNode,
} from "../_parser/nodes";
import { Range } from "../_parser/nodes/Range";

/**
 * Represents a variable symbol (definition or reference)
 */
export interface VariableSymbol {
  name: string | number;
  range: Range;
  kind: "definition" | "reference";
  node: VariableAssignmentNode | VariableReferenceNode;
}

/**
 * Variable Symbol Collector
 *
 * Collects all variable definitions and references from the AST
 * using the visitor pattern. Provides O(1) lookup for definitions
 * and grouped references by variable name.
 */
export class VariableSymbolCollector extends AstVisitor<void> {
  private definitions = new Map<string | number, VariableAssignmentNode>();
  private references = new Map<string | number, VariableReferenceNode[]>();
  private allSymbols: VariableSymbol[] = [];

  /**
   * Collect all symbols from a program by traversing the AST
   */
  collect(program: ProgramNode): void {
    // Reset state
    this.definitions.clear();
    this.references.clear();
    this.allSymbols = [];

    // Traverse the AST
    const traverser = new AstTraverser(this);
    traverser.traverseProgram(program);
  }

  /**
   * Visit variable assignment (definition)
   */
  visitVariableAssignment(node: VariableAssignmentNode): void {
    this.definitions.set(node.name, node);
    this.allSymbols.push({
      name: node.name,
      range: node.getRange(),
      kind: "definition",
      node,
    });
  }

  /**
   * Visit variable reference
   */
  visitVariableReference(node: VariableReferenceNode): void {
    const existing = this.references.get(node.name) || [];
    existing.push(node);
    this.references.set(node.name, existing);
    this.allSymbols.push({
      name: node.name,
      range: node.getRange(),
      kind: "reference",
      node,
    });
  }

  /**
   * Get definition for a variable name (O(1) lookup)
   */
  getDefinition(
    name: string | number
  ): VariableAssignmentNode | undefined {
    return this.definitions.get(name);
  }

  /**
   * Get all references for a variable name
   */
  getReferences(name: string | number): VariableReferenceNode[] {
    return this.references.get(name) || [];
  }

  /**
   * Get all symbols (definition + references) for a variable name
   */
  getAllSymbols(
    name: string | number
  ): Array<VariableAssignmentNode | VariableReferenceNode> {
    const result: Array<VariableAssignmentNode | VariableReferenceNode> = [];
    const definition = this.getDefinition(name);
    if (definition) {
      result.push(definition);
    }
    result.push(...this.getReferences(name));
    return result;
  }

  /**
   * Get all definitions as a Map
   */
  getAllDefinitions(): Map<string | number, VariableAssignmentNode> {
    return new Map(this.definitions);
  }

  /**
   * Find symbol at a specific LSP position
   * Returns the symbol with the smallest (most specific) range if multiple match
   */
  findSymbolAtPosition(
    position: Position,
    document: TextDocument
  ): VariableSymbol | null {
    let bestMatch: VariableSymbol | null = null;
    let smallestRangeSize = Infinity;

    for (const symbol of this.allSymbols) {
      if (this.isPositionInRange(position, symbol.range)) {
        const rangeSize =
          (symbol.range.end.line - symbol.range.start.line) * 1000 +
          (symbol.range.end.character - symbol.range.start.character);
        if (rangeSize < smallestRangeSize) {
          smallestRangeSize = rangeSize;
          bestMatch = symbol;
        }
      }
    }
    return bestMatch;
  }

  /**
   * Check if LSP position is within AST range
   */
  private isPositionInRange(position: Position, range: Range): boolean {
    const start = range.start;
    const end = range.end;

    // Check if position is after start
    if (position.line < start.line) {
      return false;
    }
    if (position.line === start.line && position.character < start.character) {
      return false;
    }

    // Check if position is before end
    if (position.line > end.line) {
      return false;
    }
    if (position.line === end.line && position.character > end.character) {
      return false;
    }

    return true;
  }

  // Required visitor methods - no-op for other node types
  visitFunctionCall(): void {}
  visitWhileStatement(): void {}
  visitWhileStatementEnd(): void {}
  visitIfStatement(): void {}
  visitIfClause(): void {}
  visitElseClause(): void {}
  visitIfStatementEnd(): void {}
  visitBlockStatement(): void {}
  visitExpression(): void {}
  visitStatement(): void {}
  visitProgram(): void {}
  visitBinaryExpression(): void {}
  visitUnaryExpression(): void {}
  visitLiteralExpression(): void {}
  visitAxisParameter(): void {}
  visitMotionCommand(): void {}
  visitComment(): void {}
  visitError(): void {}
}

