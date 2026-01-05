import { ExpressionNode } from "./ExpressionNode";
import { AstNode } from "../AstNode";
import { Range } from "../Range";
import { AstVisitor } from "../../AstVisitor";
import { BinaryOperatorType } from "../../../entities/expressions";

export class BinaryExpressionNode extends ExpressionNode {
  constructor(
    range: Range,
    readonly left: ExpressionNode,
    readonly operator: BinaryOperatorType,
    readonly right: ExpressionNode,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitBinaryExpression(this);
  }
}
