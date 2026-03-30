import { AstVisitor } from '../../AstVisitor';
import { AstNode } from '../AstNode';
import { BlockStatementNode } from '../BlockStatementNode';
import { ExpressionNode } from '../expressions';
import { Range } from '../Range';
import { StatementNode } from '../StatementNode';

/**
 * Discriminator for whether an IfClauseNode represents the initial IF
 * or a subsequent ELSEIF clause.
 */
export enum IfClauseKind {
  IF = 'IF',
  ELSEIF = 'ELSEIF',
}

export class IfClauseNode extends BlockStatementNode {
  constructor(
    range: Range,
    readonly kind: IfClauseKind,
    readonly condition: ExpressionNode,
    body: StatementNode[],
    readonly keywordTokenRange: Range,
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
