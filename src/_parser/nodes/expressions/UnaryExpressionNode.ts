import { UnaryOperatorType } from "./types";
import { AstVisitor } from "../../AstVisitor";
import { AstNode } from "../AstNode";
import { ExpressionNode } from "./ExpressionNode";
import { Range } from "../Range";

export class UnaryExpressionNode extends ExpressionNode {
  constructor(
    range: Range,
    readonly operator: UnaryOperatorType,
    readonly operand: ExpressionNode,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitUnaryExpression(this);
  }
}
