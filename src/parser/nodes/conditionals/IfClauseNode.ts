import { AstVisitor } from '../../AstVisitor';
import { AstNode } from '../AstNode';
import { BlockStatementNode } from '../BlockStatementNode';
import { ExpressionNode } from '../expressions';
import { Range } from '../Range';
import { StatementNode } from '../StatementNode';
import { TokenType } from '../tokens';

export class IfClauseNode extends BlockStatementNode {
  constructor(
    range: Range,
    readonly kind: TokenType.IF | TokenType.ELSEIF,
    readonly condition: ExpressionNode,
    body: StatementNode[],
    readonly thenTokenRange?: Range,
    readonly label?: string,
    parent?: AstNode
  ) {
    super(range, body, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitIfClause(this);
  }
}
