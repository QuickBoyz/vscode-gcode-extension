/**
 * Variable Symbol Collector
 *
 * Visitor that collects all variable definitions and references from the AST.
 * Provides fast lookup methods for finding variables by name or position.
 */
import { AstTraverser } from "../parser/AstTraverser";
import { AstVisitor } from "../parser/AstVisitor";
import {
  Position,
  ProgramNode,
  Range,
  VariableAssignmentNode,
  VariableReferenceNode,
} from "../parser/nodes";

export enum VariableSymbolKind {
  Definition = "definition",
  Reference = "reference",
}

/**
 * Represents a variable symbol (definition or reference)
 */
export interface VariableSymbol {
  name: string | number;
  range: Range;
  kind: VariableSymbolKind;
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
  private definitions = new Map<
    string | number,
    VariableAssignmentNode[]
  >();
  private references = new Map<
    string | number,
    VariableReferenceNode[]
  >();
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
    const existing = this.getAllDefinitionsForVariable(node.name);
    existing.push(node);
    this.definitions.set(node.name, existing);
    this.allSymbols.push({
      name: node.name,
      range: node.getRange(),
      kind: VariableSymbolKind.Definition,
      node,
    });
  }

  /**
   * Visit variable reference
   */
  visitVariableReference(node: VariableReferenceNode): void {
    const existing = this.getReferences(node.name);
    existing.push(node);
    this.references.set(node.name, existing);
    this.allSymbols.push({
      name: node.name,
      range: node.getRange(),
      kind: VariableSymbolKind.Reference,
      node,
    });
  }

  /**
   * Get the first definition for a variable name (O(1) lookup)
   * Returns the first assignment found, or undefined if none exists
   */
  getDefinition(
    name: string | number
  ): VariableAssignmentNode | undefined {
    const definitions = this.getAllDefinitionsForVariable(name);
    return definitions.length > 0 ? definitions[0] : undefined;
  }

  /**
   * Get all definitions (assignments) for a variable name
   */
  getAllDefinitionsForVariable(
    name: string | number
  ): VariableAssignmentNode[] {
    return this.definitions.get(name) || [];
  }

  /**
   * Get all references for a variable name
   */
  getReferences(name: string | number): VariableReferenceNode[] {
    return this.references.get(name) || [];
  }

  /**
   * Get all symbols (all definitions/assignments + all references) for a variable name
   */
  getAllSymbols(
    name: string | number
  ): Array<VariableAssignmentNode | VariableReferenceNode> {
    const result: Array<
      VariableAssignmentNode | VariableReferenceNode
    > = [];
    // Add all assignments (definitions)
    result.push(...this.getAllDefinitionsForVariable(name));
    // Add all references
    result.push(...this.getReferences(name));
    return result;
  }

  /**
   * Get all variable names that have definitions
   */
  getAllVariableNames(): Array<string | number> {
    return Array.from(this.definitions.keys());
  }

  /**
   * Find symbol at a specific LSP position
   * Returns the symbol with the smallest (most specific) range if multiple match
   */
  findSymbolAtPosition(position: Position): VariableSymbol | null {
    let bestMatch: VariableSymbol | null = null;
    let smallestRangeSize = Infinity;

    for (const symbol of this.allSymbols) {
      if (Range.isPositionInRange(position, symbol.range)) {
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
