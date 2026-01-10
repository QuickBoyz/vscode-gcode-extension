import { AstVisitor } from '../../AstVisitor';
import { AstNode } from '../AstNode';
import { BlockStatementNode } from '../BlockStatementNode';
import { Range } from '../Range';
import { ElseClauseNode } from './ElseClauseNode';
import { IfClauseNode } from './IfClauseNode';

export class IfStatementNode extends BlockStatementNode {
  constructor(
    range: Range,
    readonly ifClause: IfClauseNode,
    readonly endIfTokenRange: Range,
    readonly elseClause?: ElseClauseNode,
    readonly elseIfClauses?: IfClauseNode[],
    readonly label?: string,
    parent?: AstNode
  ) {
    super(range, [], parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitIfStatement(this);
  }
}
