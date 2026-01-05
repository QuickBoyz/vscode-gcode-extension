import { AstVisitor } from "../../AstVisitor";
import { AstNode } from "../AstNode";
import { BlockStatementNode } from "../BlockStatementNode";
import { StatementNode } from "../StatementNode";
import { Range } from "../Range";

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
