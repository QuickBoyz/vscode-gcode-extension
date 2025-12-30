import { ExpressionType, RelationalOperatorType } from "./types";
import { Expression } from "./Expression";

/**
 * Relational expression
 */
export class Relational extends Expression {
  type: ExpressionType.Relational = ExpressionType.Relational;
  operator: RelationalOperatorType;
  left: Expression;
  right: Expression;

  constructor(
    operator: RelationalOperatorType,
    left: Expression,
    right: Expression
  ) {
    super();
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  getType(): ExpressionType {
    return ExpressionType.Relational;
  }

  toString(): string {
    return `${this.left.toString()} ${
      this.operator
    } ${this.right.toString()}`;
  }
}
