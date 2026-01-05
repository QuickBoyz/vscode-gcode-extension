import { AstVisitor } from "../AstVisitor";
import { AstNode } from "./AstNode";
import { ExpressionNode } from "./expressions";
import { Range } from "./Range";

export class VariableReferenceNode extends ExpressionNode {
  constructor(
    range: Range,
    readonly name: string | number,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitVariableReference(this);
  }
}
