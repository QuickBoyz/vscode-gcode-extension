import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export class ProgramDelimiterNode extends StatementNode {
  constructor(range: Range, parent?: AstNode) {
    super(range, parent);
  }

  override isProgramDelimiter(): boolean {
    return true;
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitProgramDelimiter(this);
  }
}
