import { AstNode } from './AstNode';

export abstract class StatementNode extends AstNode {
  /**
   * Whether this statement represents a program delimiter (%).
   * Used by the parser to detect trailing delimiters without instanceof.
   */
  isProgramDelimiter(): boolean {
    return false;
  }
}
