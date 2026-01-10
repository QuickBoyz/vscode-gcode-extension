import { AstVisitor } from '../../AstVisitor';
import { AstNode } from '../AstNode';
import { BlockStatementNode } from '../BlockStatementNode';
import { Range } from '../Range';
import { StatementNode } from '../StatementNode';

export class ElseClauseNode extends BlockStatementNode {
  constructor(
    range: Range,
    readonly body: StatementNode[],
    readonly label?: string,
    parent?: AstNode
  ) {
    super(range, body, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitElseClause(this);
  }
}
