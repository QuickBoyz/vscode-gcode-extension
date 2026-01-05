import { AstVisitor } from "../../AstVisitor";
import { AstNode } from "../AstNode";
import { BlockStatementNode } from "../BlockStatementNode";
import { ExpressionNode } from "../expressions";
import { StatementNode } from "../StatementNode";
import { Range } from "../Range";
import { TokenType } from "../../../entities/tokens";

export class IfClauseNode extends BlockStatementNode {
  constructor(
    range: Range,
    readonly kind: TokenType.IF | TokenType.ELSEIF,
    readonly condition: ExpressionNode,
    readonly body: StatementNode[],
    readonly label?: string,
    parent?: AstNode
  ) {
    super(range, body, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitIfClause(this);
  }
}
