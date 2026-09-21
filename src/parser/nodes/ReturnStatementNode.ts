import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { ExpressionNode } from './expressions';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export class ReturnStatementNode extends StatementNode {
  constructor(
    range: Range,
    readonly label: string | undefined,
    readonly returnTokenRange: Range,
    readonly returnValue?: ExpressionNode,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitReturnStatement(this);
  }
}
