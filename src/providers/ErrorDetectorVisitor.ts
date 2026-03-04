import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import { ErrorNode, ProgramNode } from '../parser/nodes';
import { AstTraverser } from '../parser/AstTraverser';

/**
 * Detects syntax errors in the AST.
 * Traverses the entire AST and returns true if any ErrorNode is found.
 *
 * Used by formatter to block formatting when syntax errors exist,
 * matching the behavior of VS Code's built-in JavaScript formatter.
 */
export class ErrorDetectorVisitor extends BaseAstVisitor<void> {
  private foundErrors = false;

  protected defaultValue(): void {
    return;
  }

  visitError(_node: ErrorNode): void {
    this.foundErrors = true;
  }

  /**
   * Check if the program AST contains any parse errors.
   *
   * @param program - The parsed program AST
   * @returns true if any ErrorNode exists in the tree, false otherwise
   */
  hasErrors(program: ProgramNode): boolean {
    this.foundErrors = false;
    const traverser = new AstTraverser(this);
    traverser.traverseProgram(program);
    return this.foundErrors;
  }
}
