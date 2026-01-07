import { ExpressionNode } from "./expressions";
import { Range } from "./Range";
import { AstVisitor } from "../AstVisitor";
import { AstNode } from "./AstNode";

export class FunctionCallNode extends ExpressionNode {
  constructor(
    range: Range,
    public readonly name: string,
    public readonly argument: ExpressionNode,
    public readonly funcTokenRange: Range,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitFunctionCall(this);
  }
}
