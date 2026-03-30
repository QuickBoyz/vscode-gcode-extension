import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export class ReturnStatementNode extends StatementNode {
  constructor(
    range: Range,
    readonly label?: string,
    readonly returnTokenRange?: Range,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitReturnStatement(this);
  }
}
