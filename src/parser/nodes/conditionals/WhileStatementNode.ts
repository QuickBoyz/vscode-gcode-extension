import { AstVisitor } from '../../AstVisitor';
import { AstNode } from '../AstNode';
import { BlockStatementNode } from '../BlockStatementNode';
import { ExpressionNode } from '../expressions';
import { Range } from '../Range';
import { StatementNode } from '../StatementNode';

export class WhileStatementNode extends BlockStatementNode {
  constructor(
    range: Range,
    readonly condition: ExpressionNode,
    body: StatementNode[],
    readonly whileTokenRange: Range,
    readonly endWhileTokenRange: Range,
    readonly doTokenRange?: Range,
    readonly label?: string,
    parent?: AstNode
  ) {
    super(range, body, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitWhileStatement(this);
  }
}
