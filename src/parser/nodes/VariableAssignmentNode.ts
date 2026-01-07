import { StatementNode } from "./StatementNode";
import { ExpressionNode } from "./expressions";
import { Range } from "./Range";
import { AstVisitor } from "../AstVisitor";
import { AstNode } from "./AstNode";

export class VariableAssignmentNode extends StatementNode {
  constructor(
    range: Range,
    public readonly name: string | number,
    public readonly value: ExpressionNode,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitVariableAssignment(this);
  }
}
