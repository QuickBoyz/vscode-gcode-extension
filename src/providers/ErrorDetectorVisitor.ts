import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import { DiagnosticCategory, ErrorNode, ProgramNode } from '../parser/nodes';
import { AstTraverser } from '../parser/AstTraverser';

/**
 * Detects syntax errors in the AST.
 * Traverses the entire AST and returns true if any Error-category ErrorNode is found.
 * Non-error categories (Warning, Information, Hint) do not block formatting.
 *
 * Used by formatter to block formatting when syntax errors exist,
 * matching the behavior of VS Code's built-in JavaScript formatter.
 */
export class ErrorDetectorVisitor extends BaseAstVisitor<void> {
  private foundErrors = false;

  protected defaultValue(): void {
    return;
  }

  visitError(node: ErrorNode): void {
    if (node.category === DiagnosticCategory.Error) {
      this.foundErrors = true;
    }
  }

  /**
   * Check if the program AST contains any parse errors.
   *
   * @param program - The parsed program AST
   * @returns true if any Error-category ErrorNode exists in the tree, false otherwise
   */
  hasErrors(program: ProgramNode): boolean {
    this.foundErrors = false;
    const traverser = new AstTraverser(this);
    traverser.traverseProgram(program);
    return this.foundErrors;
  }
}
