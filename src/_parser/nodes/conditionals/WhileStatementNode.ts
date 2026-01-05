import { AstVisitor } from "../../AstVisitor";
import { AstNode } from "../AstNode";
import { BlockStatementNode } from "../BlockStatementNode";
import { ExpressionNode } from "../expressions";
import { Range } from "../Range";
import { StatementNode } from "../StatementNode";

export class WhileStatementNode extends BlockStatementNode {
  constructor(
    range: Range,
    readonly condition: ExpressionNode,
    readonly body: StatementNode[],
    readonly label?: string,
    parent?: AstNode
  ) {
    super(range, body, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitWhileStatement(this);
  }
}
