import { ExpressionType } from "./types";
import { Expression } from "./Expression";

/**
 * Unary expression
 */
export class Unary extends Expression {
  type: ExpressionType.Unary = ExpressionType.Unary;
  operator: "-";
  operand: Expression;

  constructor(operator: "-", operand: Expression) {
    super();
    this.operator = operator;
    this.operand = operand;
  }

  getType(): ExpressionType {
    return ExpressionType.Unary;
  }

  toString(): string {
    return `${this.operator}${this.operand.toString()}`;
  }
}
